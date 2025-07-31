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

      // Step 7: Insert missing metadata headers using MetadataAutoInserter
      await this.metadataMenuAdapter.insertMissingFields(file, fileClass);

      // Step 8: Re-read the file content after MetadataMenu has inserted fields
      const updatedContent = await this.app.vault.read(file);
      const updatedParseResult = this.frontMatterService.parseFrontmatter(updatedContent);

      let updatedFrontmatter: any = {};
      let updatedBodyContent = updatedContent;

      if (updatedParseResult) {
        updatedFrontmatter = updatedParseResult.metadata || {};
        updatedBodyContent = updatedParseResult.restOfContent;
      }

      /** @todo missing sort */

      // Step 9: Add default values to properties
      const enrichedFrontmatter = await this.addDefaultValuesToProperties(
        updatedFrontmatter || {},
        file,
        fileClass
      );

      // Step 10: Write the updated content back to the file
      return this.frontMatterService.serializeFrontmatter(enrichedFrontmatter, updatedBodyContent);

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
      // Skip if property already has a value
      if (enrichedFrontmatter[script.propertyName] !== undefined) {
        continue;
      } else {
        // Ensure the property exists in frontmatter
        enrichedFrontmatter[script.propertyName] = null;
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
			const { fileClass, file, metadata, prompt, date, generateMarkdownLink, detectLanguage } = context;
			return (async () => {
				${script.script}
			})();
			`
    );

    return await executeScript(context);
  }

}
