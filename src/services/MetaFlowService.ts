import {App, TFile} from "obsidian";
import {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import {FrontMatterService} from "./FrontMatterService";
import {TemplaterAdapter} from "../externalApi/TemplaterAdapter";
import {ScriptContextService} from "./ScriptContextService";
import {MetaFlowSettings, PropertyDefaultValueScript} from "../settings/types";
import {MetaFlowException} from "../MetaFlowException";

export class MetaFlowService {
  private app: App;
  private metaFlowSettings: MetaFlowSettings;
  private scriptContextService: ScriptContextService;
  private metadataMenuAdapter: MetadataMenuAdapter;
  private frontMatterService: FrontMatterService;
  private templaterAdapter: TemplaterAdapter;

  constructor(app: App, metaFlowSettings: MetaFlowSettings) {
    this.app = app;
    this.metaFlowSettings = metaFlowSettings;
    this.scriptContextService = new ScriptContextService(app, this.metaFlowSettings);
    this.metadataMenuAdapter = new MetadataMenuAdapter(app, this.metaFlowSettings);
    this.frontMatterService = new FrontMatterService();
    this.templaterAdapter = new TemplaterAdapter(app, this.metaFlowSettings);
  }

  async processContent(content: string, file: TFile): Promise<string> {
    try {
      // Step 1: Check if MetadataMenu plugin is available
      if (!this.metadataMenuAdapter.isMetadataMenuAvailable()) {
        throw new MetaFlowException('MetadataMenu plugin not available');
      }

      // Step 2: Check if Templater plugin is available (if integration is enabled)
      if (this.metaFlowSettings.enableTemplaterIntegration && !this.templaterAdapter.isTemplaterAvailable()) {
        throw new MetaFlowException('Templater plugin not available');
      }

      // Step 3: parse frontmatter
      const parseResult = this.frontMatterService.parseFrontmatter(content);

      let frontmatter: any = {};
      let bodyContent = content;

      if (parseResult) {
        frontmatter = parseResult.metadata || {};
        bodyContent = parseResult.restOfContent;
      }

      // Step 4: Determine or validate fileClass
      let fileClass = this.metadataMenuAdapter.getFileClassFromMetadata(frontmatter);

      if (!fileClass) {
        // Try to deduce fileClass from folder/fileClass mapping
        fileClass = this.deduceFileClassFromPath(file.path);
        if (!fileClass) {
          throw new MetaFlowException(`No fileClass found for file "${file.name}" and no matching folder pattern.`);
        }
        if (!this.validateFileClassAgainstMapping(file.path, fileClass)) {
          throw new MetaFlowException(`FileClass "${fileClass}" does not match any folder/fileClass mapping.`);
        }
      }

      // Step 5: Validate fileClass exists in MetadataMenu, throw error if not found
      this.metadataMenuAdapter.getFileClassByName(fileClass);

      // Step 6: Insert missing metadata headers using MetadataAutoInserter
      let updatedFrontmatter: any = this.metadataMenuAdapter.insertMissingFields(frontmatter, fileClass);
      console.log(updatedFrontmatter);
      // Step 8: sort properties if autoSort is enabled
      if (this.metaFlowSettings.autoSort) {
        updatedFrontmatter = this.sortProperties(updatedFrontmatter, this.metaFlowSettings.sortUnknownPropertiesLast);
      }

      // Step 9: Add default values to properties
      const enrichedFrontmatter = await this.addDefaultValuesToProperties(
        updatedFrontmatter || {},
        file,
        fileClass
      );

      // Step 10: Write the updated content back to the file
      return this.frontMatterService.serializeFrontmatter(enrichedFrontmatter, bodyContent);
    } catch (error) {
      console.error('Error in auto update metadata fields:', error);
      throw new MetaFlowException(`Error updating metadata fields: ${error.message}`);
    }
  }

  async processSortContent(content: string, file: TFile): Promise<string> {
    try {
      // Step 1: parse frontmatter
      const parseResult = this.frontMatterService.parseFrontmatter(content);

      let frontmatter: any = {};
      let bodyContent = content;

      if (parseResult) {
        frontmatter = parseResult.metadata || {};
        bodyContent = parseResult.restOfContent;
      }
      frontmatter = this.sortProperties(frontmatter, this.metaFlowSettings.sortUnknownPropertiesLast);

      // Step 10: Write the updated content back to the file
      return this.frontMatterService.serializeFrontmatter(frontmatter, bodyContent);
    } catch (error) {
      console.error('Error in auto update metadata fields:', error);
      throw new MetaFlowException(`Error updating metadata fields: ${error.message}`);
    }
  }


  /**
     * Add default values to properties using the configured scripts
     */
  private async addDefaultValuesToProperties(
    frontmatter: {[key: string]: any},
    file: TFile,
    fileClass: string
  ): Promise<{[key: string]: any}> {
    const enrichedFrontmatter = {...frontmatter};

    // Ensure fileClass is set
    const fileClassAlias = this.metadataMenuAdapter.getFileClassAlias();
    enrichedFrontmatter[fileClassAlias] = fileClass;

    // Sort scripts by order (if specified) before processing
    const orderedScripts = [...this.metaFlowSettings.propertyDefaultValueScripts].sort((a, b) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

    // Process each property default value script in order
    for (const script of orderedScripts) {
      // Skip if property already has a value (not null, undefined, or empty string)
      if (
        enrichedFrontmatter[script.propertyName] !== undefined &&
        enrichedFrontmatter[script.propertyName] !== null &&
        enrichedFrontmatter[script.propertyName] !== ''
      ) {
        continue;
      }
      if (!script.enabled) continue;

      try {
        const defaultValue = await this.executePropertyScript(
          script,
          file,
          fileClass,
          enrichedFrontmatter
        );

        if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
          enrichedFrontmatter[script.propertyName] = defaultValue;
        }
      } catch (error) {
        throw new MetaFlowException(`Error executing script for property "${script.propertyName}": ${error.message}`);
      }
    }

    return enrichedFrontmatter;
  }

  /**
   * Validate that the determined fileClass matches the folder mapping
   */
  private validateFileClassAgainstMapping(filePath: string, fileClass: string): boolean {
    const deducedFileClass = this.deduceFileClassFromPath(filePath);
    return deducedFileClass === fileClass;
  }


  /**
   * Deduce fileClass from folder path using the mapping settings
   */
  private deduceFileClassFromPath(filePath: string): string | null {
    for (const mapping of this.metaFlowSettings.folderFileClassMappings) {
      if (this.matchesPattern(filePath, mapping.folderPattern, mapping.isRegex)) {
        return mapping.fileClass;
      }
    }
    return null;
  }

  /**
   * Check if a file path matches a pattern
   */
  private matchesPattern(filePath: string, pattern: string, isRegex: boolean = false): boolean {
    if (isRegex) {
      try {
        const regex = new RegExp(pattern);
        return regex.test(filePath);
      } catch (error) {
        console.error(`Invalid regex pattern: ${pattern}`, error);
        return false;
      }
    } else {
      // Simple glob-like matching
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(filePath);
    }
  }

  /**
   * Sort properties based on the order defined in propertyDefaultValueScripts
   */
  sortProperties(frontmatter: {[key: string]: any}, sortUnknownPropertiesLast: boolean): {[key: string]: any} {
    if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
      return frontmatter;
    }

    // Create a map of property names to their order from propertyDefaultValueScripts
    const propertyOrderMap = new Map<string, number>();

    // Sort scripts by order (if specified) to get the correct sequence
    const orderedScripts = [...this.metaFlowSettings.propertyDefaultValueScripts].sort((a, b) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

    // Build the property order map
    orderedScripts.forEach((script, index) => {
      propertyOrderMap.set(script.propertyName, script?.order || Number.MAX_SAFE_INTEGER);
    });

    // Get all property keys and sort them
    const sortedKeys = Object.keys(frontmatter).sort((a, b) => {
      const orderA = propertyOrderMap.get(a);
      const orderB = propertyOrderMap.get(b);

      // Both properties have defined order
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }

      // Only property A has defined order
      if (orderA !== undefined && orderB === undefined) {
        return sortUnknownPropertiesLast ? -1 : 1;
      }

      // Only property B has defined order
      if (orderA === undefined && orderB !== undefined) {
        return sortUnknownPropertiesLast ? 1 : -1;
      }

      // Neither property has defined order - sort alphabetically
      return a.localeCompare(b);
    });

    // Build the sorted frontmatter object
    const sortedFrontmatter: {[key: string]: any} = {};
    sortedKeys.forEach(key => {
      sortedFrontmatter[key] = frontmatter[key];
    });

    return sortedFrontmatter;
  }

  /**
   * Execute a property default value script
   */
  private async executePropertyScript(
    script: PropertyDefaultValueScript,
    file: TFile,
    fileClass: string,
    metadata: {[key: string]: any}
  ): Promise<any> {
    // Get utilities from ScriptContextService
    const context = this.scriptContextService.getScriptContext(
      file,
      fileClass,
      metadata
    );

    // Create a safe execution environment
    const executeScript = new Function(
      'context',
      `
			return (async (context) => {
				const { ${Object.keys(context).join(', ')} } = context;
				${script.script}
			})(context);
			`
    );

    return await executeScript(context);
  }

}
