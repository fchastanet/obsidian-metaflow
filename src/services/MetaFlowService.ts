import {App, CachedMetadata, Notice, TFile} from "obsidian";
import {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import {FrontMatterService} from "./FrontMatterService";
import {TemplaterAdapter} from "../externalApi/TemplaterAdapter";
import {ScriptContextService} from "./ScriptContextService";
import {MetaFlowSettings, PropertyDefaultValueScript} from "../settings/types";
import {MetaFlowException} from "../MetaFlowException";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";

export class MetaFlowService {
  private app: App;
  private metaFlowSettings: MetaFlowSettings;
  private scriptContextService: ScriptContextService;
  private metadataMenuAdapter: MetadataMenuAdapter;
  private frontMatterService: FrontMatterService;
  private templaterAdapter: TemplaterAdapter;
  private obsidianAdapter: ObsidianAdapter;

  constructor(app: App, metaFlowSettings: MetaFlowSettings) {
    this.app = app;
    this.metaFlowSettings = metaFlowSettings;
    this.scriptContextService = new ScriptContextService(app, this.metaFlowSettings);
    this.metadataMenuAdapter = new MetadataMenuAdapter(app);
    this.frontMatterService = new FrontMatterService();
    this.templaterAdapter = new TemplaterAdapter(app, this.metaFlowSettings);
    this.obsidianAdapter = new ObsidianAdapter(app, this.metaFlowSettings);
  }

  async handleFileClassChanged(
    file: TFile, cache: CachedMetadata | null, oldFileClass: string, newFileClass: string,
  ): Promise<void> {
    try {
      this.checkIfAutomaticMetadataInsertionEnabled();
      this.checkIfMetadataInsertionApplicable(file);
    } catch (error) {
      if (error instanceof MetaFlowException) {
        console.warn('MetaFlow:', error.message);
        return;
      } else {
        console.warn('Error checking file availability:', error);
        return;
      }
    }
    if (newFileClass === oldFileClass) {
      console.warn(`File class for "${file.name}" is already "${newFileClass}"`);
      return;
    }

    // Step 1: Determine or validate fileClass if not available
    let fileClass = newFileClass;
    if (!fileClass || fileClass.trim() === '') {
      // Try to deduce fileClass from folder/fileClass mapping
      const deducedFileClass = this.deduceFileClassFromPath(file.path);
      if (!deducedFileClass) {
        throw new MetaFlowException(`No fileClass found for file "${file.name}" and no matching folder pattern.`);
      }
      if (!this.validateFileClassAgainstMapping(file.path, deducedFileClass)) {
        throw new MetaFlowException(`FileClass "${deducedFileClass}" does not match any folder/fileClass mapping.`);
      }
      fileClass = deducedFileClass;
    }

    // Step 2: Validate fileClass exists in MetadataMenu, throw error if not found
    this.metadataMenuAdapter.getFileClassByName(fileClass);

    // Step 3: Insert missing metadata headers using MetadataAutoInserter
    let updatedFrontmatter: any = cache?.frontmatter || {};
    updatedFrontmatter = this.metadataMenuAdapter.insertMissingFields(updatedFrontmatter, fileClass);

    // Step 4: sort properties if autoSort is enabled
    if (this.metaFlowSettings.autoSort) {
      updatedFrontmatter = this.sortProperties(updatedFrontmatter, this.metaFlowSettings.sortUnknownPropertiesLast);
    }

    // Step 5: Add default values to properties
    const enrichedFrontmatter = this.addDefaultValuesToProperties(
      updatedFrontmatter || {},
      file,
      fileClass
    );

    setTimeout(async () => {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        // Remove all keys from frontmatter
        Object.keys(enrichedFrontmatter).forEach(key => delete frontmatter[key]);
        // Add keys back in desired order
        Object.keys(enrichedFrontmatter).forEach(key => {
          frontmatter[key] = enrichedFrontmatter[key];
        });
      }).then(() => {
        // Step 6: Move note to the right folder if autoMoveNoteToRightFolder is enabled
        try {
          const newFilePath = this.moveNoteToTheRightFolder(file, fileClass);
          if (newFilePath) {
            new Notice(`Moved note "${file.name}" with fileClass "${fileClass}" to ${newFilePath}.`);
          }
        } catch (error) {
          console.error(`Error moving note to the right folder for file ${file.path}:`, error);
          if (error instanceof MetaFlowException) {
            new Notice(error.message);
          }
        }
      });
    }, 500);
  }

  checkIfAutomaticMetadataInsertionEnabled(): void {
    if (!this.metaFlowSettings.enableAutoMetadataInsertion) {
      throw new MetaFlowException('Auto metadata insertion is disabled');
    }
  }

  checkIfMetadataInsertionApplicable(file: TFile): void {
    this.checkIfValidFile(file);
    this.checkIfExcluded(file);

    // Check if MetadataMenu plugin is available
    if (!this.metadataMenuAdapter.isMetadataMenuAvailable()) {
      throw new MetaFlowException('MetadataMenu plugin not available');
    }

    // Check if Templater plugin is available (if integration is enabled)
    if (!this.templaterAdapter.isTemplaterAvailable()) {
      throw new MetaFlowException('Templater plugin not available');
    }
  }

  checkIfExcluded(file: TFile): void {
    // Exclude files in excluded folders
    const excludeFolders = (this.metaFlowSettings.excludeFolders || []);
    if (excludeFolders.some(folder => file.path.startsWith(folder + '/'))) {
      throw new MetaFlowException(`File ${file.name} is in an excluded folder: ${file.path}`);
    }
  }

  checkIfAutoMoveNoteToRightFolderEnabled(): void {
    if (!this.metaFlowSettings.autoMoveNoteToRightFolder) {
      throw new MetaFlowException('Auto move note to right folder is disabled');
    }
  }

  checkIfValidFile(file: TFile): void {
    if (!file || !(file instanceof TFile)) {
      throw new MetaFlowException('Invalid file provided for class change');
    }
  }

  processContent(content: string, file: TFile): string {
    this.checkIfMetadataInsertionApplicable(file);
    try {
      // Step 1: parse frontmatter
      const parseResult = this.frontMatterService.parseFrontmatter(content);

      let frontmatter: any = {};
      let bodyContent = content;

      if (parseResult) {
        frontmatter = parseResult.metadata || {};
        bodyContent = parseResult.restOfContent;
      }

      // Step 2: Determine or validate fileClass
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

      // Step 3: Validate fileClass exists in MetadataMenu, throw error if not found
      this.metadataMenuAdapter.getFileClassByName(fileClass);

      // Step 4: Insert missing metadata headers using MetadataAutoInserter
      let updatedFrontmatter: any = this.metadataMenuAdapter.insertMissingFields(frontmatter, fileClass);
      // Step 5: sort properties if autoSort is enabled
      if (this.metaFlowSettings.autoSort) {
        updatedFrontmatter = this.sortProperties(updatedFrontmatter, this.metaFlowSettings.sortUnknownPropertiesLast);
      }

      // Step 6: Add default values to properties
      const enrichedFrontmatter = this.addDefaultValuesToProperties(
        updatedFrontmatter || {},
        file,
        fileClass
      );

      // Step 7: Write the updated content back to the file
      return this.frontMatterService.serializeFrontmatter(enrichedFrontmatter, bodyContent);
    } catch (error) {
      console.error('Error in auto update metadata fields:', error);
      throw new MetaFlowException(`Error updating metadata fields: ${error.message}`);
    }
  }

  public getFileClassFromContent(content: string): string | null {
    const fileClassAlias = this.metadataMenuAdapter.getFileClassAlias();
    return this.frontMatterService.parseFileClassFromContent(content, fileClassAlias);
  }

  public getFileClassFromMetadata(metadata: any): string | null {
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }
    const fileClassAlias = this.metadataMenuAdapter.getFileClassAlias();
    if (Array.isArray(metadata)) {
      return null; // Invalid metadata format
    }
    // Return the fileClass from metadata using the alias
    return metadata?.[fileClassAlias] || null;
  }

  private checkIfTargetFileExists(targetFolder: string, file: TFile): void {
    const targetFilePath = `${targetFolder}/${file.name}`;
    if (this.obsidianAdapter.isFileExists(targetFilePath)) {
      throw new MetaFlowException(`Target file "${targetFilePath}" already exists`);
    }
  }

  public moveNoteToTheRightFolder(file: TFile, fileClass: string): string | null {
    this.checkIfAutoMoveNoteToRightFolderEnabled();
    this.checkIfValidFile(file);
    this.checkIfExcluded(file);
    if (!this.metaFlowSettings.autoMoveNoteToRightFolder) {
      throw new MetaFlowException('Auto move note to right folder is disabled');
    }
    const targetFolder = this.getTargetFolderForFileClass(fileClass);
    if (targetFolder) {
      if (targetFolder === file.parent?.path || '') {
        console.info(`Note "${file.name}" is already in the right folder: ${targetFolder}`);
        return null;
      }
      this.checkIfTargetFileExists(targetFolder, file);
      const newFilePath = `${targetFolder}/${file.name}`;
      this.obsidianAdapter.moveNote(file, newFilePath);
      return newFilePath;

    } else {
      throw new MetaFlowException(`No target folder defined for fileClass "${fileClass}"`);
    }
  }

  private getTargetFolderForFileClass(fileClass: string): string | null {
    const mapping = this.metaFlowSettings.folderFileClassMappings.find(
      mapping => mapping.fileClass === fileClass && mapping.moveToFolder);
    if (mapping) {
      return mapping.folder.replace(/\/$/, ''); // Remove trailing slash
    }
    return null;
  }

  public processSortContent(content: string, file: TFile): void {
    this.checkIfValidFile(file);
    this.checkIfExcluded(file);

    try {
      // Step 1: parse frontmatter
      const parseResult = this.frontMatterService.parseFrontmatter(content);

      let enrichedFrontmatter: any = {};
      let bodyContent = content;

      if (parseResult) {
        enrichedFrontmatter = parseResult.metadata || {};
        bodyContent = parseResult.restOfContent;
      }
      enrichedFrontmatter = this.sortProperties(enrichedFrontmatter, this.metaFlowSettings.sortUnknownPropertiesLast);

      setTimeout(async () => {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          // Remove all keys from frontmatter
          Object.keys(enrichedFrontmatter).forEach(key => delete frontmatter[key]);
          // Add keys back in desired order
          Object.keys(enrichedFrontmatter).forEach(key => {
            frontmatter[key] = enrichedFrontmatter[key];
          });
        })
      }, 500)
    } catch (error) {
      console.error('Error in auto update metadata fields:', error);
      throw new MetaFlowException(`Error updating metadata fields: ${error.message}`);
    }
  }


  /**
     * Add default values to properties using the configured scripts
     */
  private addDefaultValuesToProperties(
    frontmatter: {[key: string]: any},
    file: TFile,
    fileClass: string
  ): {[key: string]: any} {
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
        const defaultValue = this.executePropertyScript(
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
      // Remove trailing and leading slashes
      let cleanFolder = mapping.folder.replace(/\/$/, '').replace(/^\//, '');
      cleanFolder = (cleanFolder !== '') ? cleanFolder + '/' : '';
      if (filePath.startsWith(cleanFolder)) {
        return mapping.fileClass;
      }
    }
    return null;
  }

  /**
   * Sort properties based on the order defined in propertyDefaultValueScripts
   */
  private sortProperties(frontmatter: {[key: string]: any}, sortUnknownPropertiesLast: boolean): {[key: string]: any} {
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
    return sortedKeys.reduce(function (result: any, key) {
      result[key] = frontmatter[key];
      return result;
    }, {});
  }

  /**
   * Execute a property default value script
   */
  private executePropertyScript(
    script: PropertyDefaultValueScript,
    file: TFile,
    fileClass: string,
    metadata: {[key: string]: any}
  ): any {
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
			return ((context) => {
				const { ${Object.keys(context).join(', ')} } = context;
				${script.script}
			})(context);
			`
    );

    return executeScript(context);
  }

  public togglePropertiesVisibility(hide: boolean): void {
    const styleId = 'metaflow-hide-properties';
    let styleEl = document.getElementById(styleId);

    if (hide) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `
          .cm-editor .metadata-container {
            display: none !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      if (styleEl) {
        styleEl.remove();
      }
    }
  }

}
