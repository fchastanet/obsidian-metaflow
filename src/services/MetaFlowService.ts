import {App, CachedMetadata, Notice, TFile, TFolder} from "obsidian";
import {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import {FrontMatterService} from "./FrontMatterService";
import {TemplaterAdapter} from "../externalApi/TemplaterAdapter";
import {ScriptContextService} from "./ScriptContextService";
import {FolderFileClassMapping, MetaFlowSettings, PropertyDefaultValueScript} from "../settings/types";
import {MetaFlowException} from "../MetaFlowException";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import {LogManagerInterface} from "../managers/types";
import {Utils} from "../utils/Utils";
import {MetadataMenuField} from "../externalApi/types.MetadataMenu";
import {DEFAULT_SETTINGS} from "../settings/defaultSettings";

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
    this.metadataMenuAdapter = new MetadataMenuAdapter(app, this.metaFlowSettings);
    this.frontMatterService = new FrontMatterService();
    this.templaterAdapter = new TemplaterAdapter(app, this.metaFlowSettings);
    this.obsidianAdapter = new ObsidianAdapter(app, this.metaFlowSettings);
    this.fixSettings();
  }

  async handleFileClassChanged(
    file: TFile, cache: CachedMetadata | null, oldFileClass: string, newFileClass: string,
    logManager: LogManagerInterface
  ): Promise<void> {
    if (!this.metaFlowSettings.autoMetadataInsertion) {
      console.info('Auto metadata insertion is disabled');
      return;
    }
    try {
      this.checkIfAutomaticMetadataInsertionEnabled();
      this.checkIfMetadataInsertionApplicable(file);
    } catch (error) {
      if (error instanceof MetaFlowException) {
        logManager.addMessage(`MetaFlow: ${error.message}`, error.noticeLevel);
        return;
      } else {
        logManager.addWarning(`Error checking file availability: ${error}`);
        return;
      }
    }
    if (newFileClass === oldFileClass) {
      logManager.addWarning(`File class for "${file.name}" is already "${newFileClass}"`);
      return;
    }

    try {
      // Step 1: Determine or validate fileClass if not available
      let fileClass = newFileClass;
      if (!fileClass || fileClass.trim() === '') {
        // Try to deduce fileClass from folder/fileClass mapping
        const deducedFileClass = this.deduceFileClassFromPath(file.path);
        if (!deducedFileClass) {
          throw new MetaFlowException(`No fileClass found for file "${file.name}" and no matching folder pattern.`, 'warning');
        }
        if (!this.validateFileClassAgainstMapping(file.path, deducedFileClass)) {
          throw new MetaFlowException(`FileClass "${deducedFileClass}" does not match any folder/fileClass mapping.`, 'warning');
        }
        fileClass = deducedFileClass;
      }

      // Step 2: Validate fileClass exists in MetadataMenu, throw error if not found
      this.metadataMenuAdapter.getFileClassByName(fileClass);

      // Step 3: Synchronize frontmatter with new/obsolete fileClass's fields
      let updatedFrontmatter: any = cache?.frontmatter || {};
      updatedFrontmatter = this.metadataMenuAdapter.syncFields(updatedFrontmatter, fileClass, logManager);

      // Step 4: sort properties if autoSort is enabled
      if (this.metaFlowSettings.autoSort) {
        updatedFrontmatter = this.sortProperties(updatedFrontmatter, this.metaFlowSettings.sortUnknownPropertiesLast);
      }

      // Step 5: Add default values to properties
      const enrichedFrontmatter = this.addDefaultValuesToProperties(
        updatedFrontmatter || {},
        file,
        fileClass,
        logManager
      );

      await Utils.sleep(this.metaFlowSettings.frontmatterUpdateDelayMs, async () => {
        await this.updateFrontmatter(file, enrichedFrontmatter, true)
        // Step 6: Move note to the right folder if autoMoveNoteToRightFolder is enabled
        try {
          // Rename note if autoRenameNote is enabled
          if (this.metaFlowSettings.autoRenameNote) {
            await this.renameNote(file, fileClass, enrichedFrontmatter, logManager);
          }

          if (this.metaFlowSettings.autoMoveNoteToRightFolder) {
            const newFilePath = await this.moveNoteToTheRightFolder(file, fileClass);
            if (newFilePath) {
              logManager.addInfo(`Moved note "${file.name}" with fileClass "${fileClass}" to ${newFilePath}.`);
            }
          }
        } catch (error) {
          const msg = (error instanceof MetaFlowException) ?
            `Error moving note ${file.path} to the right folder: ${error.message}` :
            `Error moving note ${file.path} to the right folder`;
          console.error(msg, error);
          logManager.addMessage(msg, error?.noticeLevel ?? 'error');
        }
      });
    } catch (error) {
      const msg = (error instanceof MetaFlowException) ?
        `Error updating metadata properties: ${error.message}` :
        `Error updating metadata properties`;
      console.error(msg, error);
      logManager.addMessage(msg, error?.noticeLevel ?? 'error');
    }
  }

  checkIfAutomaticMetadataInsertionEnabled(): void {
    if (!this.metaFlowSettings.autoMetadataInsertion) {
      throw new MetaFlowException('Auto metadata insertion is disabled', 'info');
    }
  }

  checkIfMetadataInsertionApplicable(file: TFile): void {
    this.checkIfValidFile(file);
    this.checkIfExcluded(file);

    // Check if MetadataMenu plugin is available
    if (!this.metadataMenuAdapter.isMetadataMenuAvailable()) {
      throw new MetaFlowException('MetadataMenu plugin not available', 'info');
    }

    // Check if Templater plugin is available (if integration is enabled)
    if (!this.templaterAdapter.isTemplaterAvailable()) {
      throw new MetaFlowException('Templater plugin not available', 'info');
    }
  }

  checkIfExcluded(file: TFile): void {
    // Exclude files in excluded folders
    const excludeFolders = (this.metaFlowSettings.excludeFolders || []);
    if (excludeFolders.some(folder => file.path.startsWith(this.obsidianAdapter.folderPrefix(folder)))) {
      throw new MetaFlowException(`File ${file.name} is in an excluded folder: ${file.path}`, 'info');
    }
  }

  checkIfAutoMoveNoteToRightFolderEnabled(): void {
    if (!this.metaFlowSettings.autoMoveNoteToRightFolder) {
      throw new MetaFlowException('Auto move note to right folder is disabled', 'info');
    }
  }

  checkIfValidFile(file: TFile): void {
    if (!file || !(file instanceof TFile)) {
      throw new MetaFlowException('Invalid file provided for class change', 'ignore');
    }
    if (file.extension !== 'md') {
      throw new MetaFlowException(`File ${file.name} is not a markdown file`, 'ignore');
    }
  }

  processContent(content: string, file: TFile, logManager: LogManagerInterface): string {
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
      let newFileClass;
      if (!fileClass) {
        // Try to deduce fileClass from folder/fileClass mapping
        const deducedFileClass = this.deduceFileClassFromPath(file.path);
        if (!deducedFileClass) {
          throw new MetaFlowException(`No fileClass found for file "${file.name}" and no matching folder pattern.`, 'warning');
        }
        if (!this.validateFileClassAgainstMapping(file.path, deducedFileClass)) {
          throw new MetaFlowException(`FileClass "${deducedFileClass}" does not match any folder/fileClass mapping.`, 'warning');
        }
        newFileClass = deducedFileClass;
      } else {
        newFileClass = fileClass;
      }

      // Step 3: Validate fileClass exists in MetadataMenu, throw error if not found
      this.metadataMenuAdapter.getFileClassByName(newFileClass);

      // Step 4: Synchronize frontmatter with new/obsolete fileClass's fields
      let updatedFrontmatter: any = this.metadataMenuAdapter.syncFields(frontmatter, newFileClass, logManager);
      if (newFileClass !== fileClass) {
        logManager.addInfo(`File class changed for "${file.name}": ${fileClass} -> ${newFileClass}`);
      }

      // Step 5: sort properties if autoSort is enabled
      if (this.metaFlowSettings.autoSort) {
        updatedFrontmatter = this.sortProperties(updatedFrontmatter, this.metaFlowSettings.sortUnknownPropertiesLast);
      }

      // Step 6: Add default values to properties
      const enrichedFrontmatter = this.addDefaultValuesToProperties(
        updatedFrontmatter || {},
        file,
        newFileClass,
        logManager
      );

      // Step 7: Write the updated content back to the file
      return this.frontMatterService.serializeFrontmatter(enrichedFrontmatter, bodyContent);
    } catch (error) {
      console.error('Error in auto update metadata fields:', error);
      throw new MetaFlowException(`Error updating metadata fields: ${error.message}`, 'error');
    }
  }

  public getFileClassFromContent(content: string): string | null {
    const fileClassAlias = this.metadataMenuAdapter.getFileClassAlias();
    return this.frontMatterService.parseFileClassFromContent(content, fileClassAlias);
  }

  public getFrontmatterFromContent(content: string): any | null {
    const parseResult = this.frontMatterService.parseFrontmatter(content);
    return parseResult?.metadata || null;
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
      throw new MetaFlowException(`Target file "${targetFilePath}" already exists`, 'warning');
    }
  }

  private async createFolderIfNeeded(folder: string): Promise<TFolder | null> {
    if (!this.obsidianAdapter.isFolderExists(folder)) {
      return await this.obsidianAdapter.createFolder(folder);
    }
    return this.app.vault.getFolderByPath(folder);
  }

  public async moveNoteToTheRightFolder(file: TFile, fileClass: string): Promise<string | null> {
    this.checkIfValidFile(file);
    this.checkIfExcluded(file);
    const targetFolder = this.getTargetFolderForFileClass(fileClass);
    if (targetFolder) {
      if (targetFolder === file.parent?.path || '') {
        console.info(`Note "${file.name}" is already in the right folder: ${targetFolder}`);
        return null;
      }
      await this.createFolderIfNeeded(targetFolder);
      this.checkIfTargetFileExists(targetFolder, file);
      const newFilePath = `${targetFolder}/${file.name}`;
      this.obsidianAdapter.moveNote(file, newFilePath);
      return newFilePath;

    } else {
      const targetFolderMapping = this.getTargetFolderMappingForFileClass(fileClass);
      if (targetFolderMapping?.moveToFolder === false) {
        console.info(`Auto-move for the folder "${targetFolderMapping.folder}" is disabled`);
        return null;
      }
      throw new MetaFlowException(`No target folder defined for fileClass "${fileClass}"`, 'warning');
    }
  }

  public async renameNote(
    file: TFile,
    fileClass: string,
    metadata: {[key: string]: any},
    logManager: LogManagerInterface
  ): Promise<TFile | null> {
    this.checkIfValidFile(file);
    this.checkIfExcluded(file);

    try {
      const newTitle = this.formatNoteTitle(file, fileClass, metadata, logManager);

      // Check if the title needs to change
      const currentName = file.basename; // basename without extension
      if (currentName === newTitle) {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: Note "${file.name}" already has the correct title "${newTitle}"`);
        }
        return null;
      } else if (newTitle === 'Untitled') {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: Note "${file.name}", new title would be 'Untitled', keeping old name`);
        }
        return file;
      }

      // Check if new name would create a conflict
      const newFileName = `${newTitle}.${file.extension}`;
      let newPath = file.parent ? `${file.parent.path}/${newFileName}` : newFileName;
      newPath = this.obsidianAdapter.normalizePath(newPath);

      if (this.obsidianAdapter.isFileExists(newPath)) {
        throw new MetaFlowException(`Cannot rename note: file "${newFileName}" already exists`, 'warning');
      }

      // Perform the rename
      const renamedFile = await this.obsidianAdapter.renameNote(file, newFileName);

      logManager.addInfo(`Renamed note "${file.name}" to "${newFileName}"`);
      return renamedFile;

    } catch (error) {
      if (error instanceof MetaFlowException) {
        throw error;
      }
      throw new MetaFlowException(`Error renaming note "${file.name}": ${error.message}`, 'error');
    }
  }

  private getTargetFolderMappingForFileClass(fileClass: string): FolderFileClassMapping | null {
    return this.metaFlowSettings.folderFileClassMappings.find(
      mapping => mapping.fileClass === fileClass) || null;
  }

  private getTargetFolderForFileClass(fileClass: string): string | null {
    const mapping = this.metaFlowSettings.folderFileClassMappings.find(
      mapping => mapping.fileClass === fileClass && mapping.moveToFolder);
    if (mapping) {
      return mapping.folder.replace(/\/$/, ''); // Remove trailing slash
    }
    return null;
  }

  private async updateFrontmatter(file: TFile, enrichedFrontmatter: any, deleteEmptyKeys: boolean): Promise<void> {
    return this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      // Remove all keys from frontmatter
      Object.keys(enrichedFrontmatter).forEach(key => delete frontmatter[key]);
      // Remove all empty keys from frontmatter
      if (deleteEmptyKeys) {
        Object.keys(frontmatter).forEach(key => {
          if (frontmatter[key] === undefined || frontmatter[key] === null || frontmatter[key] === '') {
            delete frontmatter[key];
          }
        });
      }
      // Add keys back in desired order
      Object.keys(enrichedFrontmatter).forEach(key => {
        frontmatter[key] = enrichedFrontmatter[key];
      });
    });
  }

  public async processSortContent(content: string, file: TFile): Promise<void> {
    this.checkIfValidFile(file);
    this.checkIfExcluded(file);

    try {
      // Step 1: parse frontmatter
      const parseResult = this.frontMatterService.parseFrontmatter(content);

      let enrichedFrontmatter: any = {};

      if (parseResult) {
        enrichedFrontmatter = parseResult.metadata || {};
      }
      enrichedFrontmatter = this.sortProperties(enrichedFrontmatter, this.metaFlowSettings.sortUnknownPropertiesLast);

      await Utils.sleep(this.metaFlowSettings.frontmatterUpdateDelayMs, async () => {
        await this.updateFrontmatter(file, enrichedFrontmatter, false);
      });
    } catch (error) {
      console.error('Error sorting metadata fields:', error);
      throw new MetaFlowException(`Error sorting metadata fields: ${error.message}`, 'error');
    }
  }


  /**
     * Add default values to properties using the configured scripts
     */
  private addDefaultValuesToProperties(
    frontmatter: {[key: string]: any},
    file: TFile,
    fileClass: string,
    logManager: LogManagerInterface
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

    // Get only the fields associated to fileClass and ancestors
    //convert array to map
    const allFieldsMap = new Map<string, MetadataMenuField>();
    this.metadataMenuAdapter.getFileClassAndAncestorsFields(fileClass, logManager).forEach(field => {
      allFieldsMap.set(field.name, field);
    });

    // Process each property default value script in order
    for (const script of orderedScripts) {
      // Skip if property already has a value (not null, undefined, or empty string)
      if (
        !allFieldsMap.has(script.propertyName) || (
          enrichedFrontmatter[script.propertyName] !== undefined &&
          enrichedFrontmatter[script.propertyName] !== null &&
          enrichedFrontmatter[script.propertyName] !== ''
        )
      ) {
        continue;
      }
      if (!script.enabled) continue;

      try {
        const defaultValue = this.executePropertyScript(
          script,
          file,
          fileClass,
          enrichedFrontmatter,
          logManager
        );

        if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
          enrichedFrontmatter[script.propertyName] = defaultValue;
        }
      } catch (error) {
        throw new MetaFlowException(`Error executing script for property "${script.propertyName}": ${error.message}`, 'error');
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
    const cleanFilePath = this.obsidianAdapter.normalizePath(filePath);
    for (const mapping of this.metaFlowSettings.folderFileClassMappings) {
      const folderPrefix = this.obsidianAdapter.folderPrefix(mapping.folder);
      if (folderPrefix === '/' || cleanFilePath.startsWith(folderPrefix)) {
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
    metadata: {[key: string]: any},
    logManager: LogManagerInterface
  ): any {
    // Get utilities from ScriptContextService
    const context = this.scriptContextService.getScriptContext(
      file,
      fileClass,
      metadata,
      logManager
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

  private fixSettings(): void {
    if (this.metaFlowSettings === undefined) {
      this.metaFlowSettings = DEFAULT_SETTINGS;
    }
    this.metaFlowSettings.autoSort = typeof this.metaFlowSettings.autoSort === 'boolean' ? this.metaFlowSettings.autoSort : DEFAULT_SETTINGS.autoSort;
    this.metaFlowSettings.sortUnknownPropertiesLast = typeof this.metaFlowSettings.sortUnknownPropertiesLast === 'boolean' ? this.metaFlowSettings.sortUnknownPropertiesLast : DEFAULT_SETTINGS.sortUnknownPropertiesLast;
    this.metaFlowSettings.autoMetadataInsertion = typeof this.metaFlowSettings.autoMetadataInsertion === 'boolean' ? this.metaFlowSettings.autoMetadataInsertion : DEFAULT_SETTINGS.autoMetadataInsertion;
    this.metaFlowSettings.insertMissingFieldsOnSort = typeof this.metaFlowSettings.insertMissingFieldsOnSort === 'boolean' ? this.metaFlowSettings.insertMissingFieldsOnSort : DEFAULT_SETTINGS.insertMissingFieldsOnSort;
    this.metaFlowSettings.hidePropertiesInEditor = typeof this.metaFlowSettings.hidePropertiesInEditor === 'boolean' ? this.metaFlowSettings.hidePropertiesInEditor : DEFAULT_SETTINGS.hidePropertiesInEditor;

    this.metaFlowSettings.folderFileClassMappings = Array.isArray(this.metaFlowSettings.folderFileClassMappings) ? this.metaFlowSettings.folderFileClassMappings : DEFAULT_SETTINGS.folderFileClassMappings;
    if (this.metaFlowSettings.folderFileClassMappings.length === 0) {
      this.metaFlowSettings.folderFileClassMappings = DEFAULT_SETTINGS.folderFileClassMappings;
    }
    this.metaFlowSettings.folderFileClassMappings.forEach((folderFileClassMapping: FolderFileClassMapping) => {
      folderFileClassMapping.folder = typeof folderFileClassMapping.folder === 'string' ? folderFileClassMapping.folder : '/';
      folderFileClassMapping.templateMode = typeof folderFileClassMapping.templateMode === 'string' ? folderFileClassMapping.templateMode : DEFAULT_SETTINGS.folderFileClassMappings[0].templateMode;
      folderFileClassMapping.noteTitleScript = typeof folderFileClassMapping.noteTitleScript === 'object' ? folderFileClassMapping.noteTitleScript : DEFAULT_SETTINGS.folderFileClassMappings[0].noteTitleScript;
      folderFileClassMapping.noteTitleTemplates = Array.isArray(folderFileClassMapping.noteTitleTemplates) ? folderFileClassMapping.noteTitleTemplates : DEFAULT_SETTINGS.folderFileClassMappings[0].noteTitleTemplates;
      folderFileClassMapping.noteTitleScript.enabled = typeof folderFileClassMapping.noteTitleScript.enabled === 'boolean' ? folderFileClassMapping.noteTitleScript.enabled : true;
      folderFileClassMapping.noteTitleScript.script = typeof folderFileClassMapping.noteTitleScript.script === 'string' ? folderFileClassMapping.noteTitleScript.script : DEFAULT_SETTINGS.folderFileClassMappings[0].noteTitleScript.script;
    });
    this.metaFlowSettings.propertyDefaultValueScripts = Array.isArray(this.metaFlowSettings.propertyDefaultValueScripts) ? this.metaFlowSettings.propertyDefaultValueScripts : DEFAULT_SETTINGS.propertyDefaultValueScripts;
    this.metaFlowSettings.propertyDefaultValueScripts.forEach((propertyDefaultValueScript: PropertyDefaultValueScript) => {
      propertyDefaultValueScript.propertyName = typeof propertyDefaultValueScript.propertyName === 'string' ? propertyDefaultValueScript.propertyName : 'default';
      propertyDefaultValueScript.script = typeof propertyDefaultValueScript.script === 'string' ? propertyDefaultValueScript.script : 'return "";';
      propertyDefaultValueScript.enabled = typeof propertyDefaultValueScript.enabled === 'boolean' ? propertyDefaultValueScript.enabled : true;
      // if property order exists
      if (propertyDefaultValueScript.hasOwnProperty('order')) {
        propertyDefaultValueScript.order = typeof propertyDefaultValueScript.order === 'number' ? propertyDefaultValueScript.order : 1;
      }
      if (propertyDefaultValueScript.hasOwnProperty('fileClasses')) {
        propertyDefaultValueScript.fileClasses = Array.isArray(propertyDefaultValueScript.fileClasses) ? propertyDefaultValueScript.fileClasses : [];
      }
    });
    this.metaFlowSettings.excludeFolders = Array.isArray(this.metaFlowSettings.excludeFolders) ? this.metaFlowSettings.excludeFolders : DEFAULT_SETTINGS.excludeFolders;
    this.metaFlowSettings.debugMode = typeof this.metaFlowSettings.debugMode === 'boolean' ? this.metaFlowSettings.debugMode : DEFAULT_SETTINGS.debugMode;
    this.metaFlowSettings.autoMoveNoteToRightFolder = typeof this.metaFlowSettings.autoMoveNoteToRightFolder === 'boolean' ? this.metaFlowSettings.autoMoveNoteToRightFolder : DEFAULT_SETTINGS.autoMoveNoteToRightFolder;
    this.metaFlowSettings.autoRenameNote = typeof this.metaFlowSettings.autoRenameNote === 'boolean' ? this.metaFlowSettings.autoRenameNote : DEFAULT_SETTINGS.autoRenameNote;
    this.metaFlowSettings.frontmatterUpdateDelayMs = typeof this.metaFlowSettings.frontmatterUpdateDelayMs === 'number' ? this.metaFlowSettings.frontmatterUpdateDelayMs : DEFAULT_SETTINGS.frontmatterUpdateDelayMs;
  }

  public importSettings(jsonString: string): MetaFlowSettings {
    const importedSettings = JSON.parse(jsonString);
    Object.assign(this.metaFlowSettings, importedSettings);
    this.fixSettings();
    return this.metaFlowSettings;
  }

  /**
   * Format note title based on FolderFileClassMappings configuration
   * @param file - The file to format title for
   * @param fileClass - The file class
   * @param metadata - The metadata object
   * @param logManager - Log manager for reporting
   * @returns Formatted title or "Untitled" if generation fails
   */
  public formatNoteTitle(
    file: TFile,
    fileClass: string,
    metadata: {[key: string]: any},
    logManager: LogManagerInterface
  ): string {
    const DEFAULT_TITLE = "Untitled";

    try {
      // Find the folder mapping for this file class
      const mapping = this.metaFlowSettings.folderFileClassMappings.find(
        m => m.fileClass === fileClass
      );

      if (!mapping) {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: No folder mapping found for fileClass "${fileClass}"`);
        }
        return DEFAULT_TITLE;
      }

      if (mapping.templateMode === 'script') {
        return this.formatNoteTitleByScript(file, fileClass, metadata, mapping, logManager);
      } else {
        return this.formatNoteTitleByTemplate(file, fileClass, metadata, mapping, logManager);
      }
    } catch (error) {
      console.error(`MetaFlow: Error formatting note title: ${error.message}`);
      return DEFAULT_TITLE;
    }
  }

  /**
   * Format note title using script mode
   */
  private formatNoteTitleByScript(
    file: TFile,
    fileClass: string,
    metadata: {[key: string]: any},
    mapping: FolderFileClassMapping,
    logManager: LogManagerInterface
  ): string {
    const DEFAULT_TITLE = "Untitled";

    if (!mapping.noteTitleScript?.enabled || !mapping.noteTitleScript?.script) {
      if (this.metaFlowSettings.debugMode) {
        console.debug(`MetaFlow: Note title script is disabled or empty for fileClass "${fileClass}"`);
      }
      return DEFAULT_TITLE;
    }

    try {
      // Get script context
      const context = this.scriptContextService.getScriptContext(
        file,
        fileClass,
        metadata,
        logManager
      );

      // Execute script
      const executeScript = new Function(
        'context',
        `
        return ((context) => {
          const { ${Object.keys(context).join(', ')} } = context;
          ${mapping.noteTitleScript.script}
        })(context);
        `
      );

      const result = executeScript(context);

      // Validate result
      if (typeof result !== 'string') {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: Note title script returned non-string value (${typeof result}) for fileClass "${fileClass}"`);
        }
        return DEFAULT_TITLE;
      }

      if (!result.trim()) {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: Note title script returned empty string for fileClass "${fileClass}"`);
        }
        return DEFAULT_TITLE;
      }

      // Validate filename
      const sanitizedTitle = this.sanitizeFilename(result.trim());
      if (!sanitizedTitle) {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: Note title script result "${result}" is not a valid filename for fileClass "${fileClass}"`);
        }
        return DEFAULT_TITLE;
      }

      return sanitizedTitle;
    } catch (error) {
      console.error(`MetaFlow: Error executing note title script for fileClass "${fileClass}": ${error.message}`);
      return DEFAULT_TITLE;
    }
  }

  /**
   * Format note title using template mode
   */
  private formatNoteTitleByTemplate(
    file: TFile,
    fileClass: string,
    metadata: {[key: string]: any},
    mapping: FolderFileClassMapping,
    logManager: LogManagerInterface
  ): string {
    const DEFAULT_TITLE = "Untitled";

    if (!mapping.noteTitleTemplates?.length) {
      if (this.metaFlowSettings.debugMode) {
        console.debug(`MetaFlow: No note title templates defined for fileClass "${fileClass}"`);
      }
      return DEFAULT_TITLE;
    }

    // Try each enabled template in order
    for (const template of mapping.noteTitleTemplates) {
      if (!template.enabled || !template.template?.trim()) {
        continue;
      }

      try {
        const result = this.processTemplate(template.template, metadata, fileClass);

        if (result) {
          const sanitizedTitle = this.sanitizeFilename(result);
          if (sanitizedTitle) {
            return sanitizedTitle;
          } else {
            if (this.metaFlowSettings.debugMode) {
              console.debug(`MetaFlow: Template result "${result}" is not a valid filename for fileClass "${fileClass}"`);
            }
          }
        } else {
          if (this.metaFlowSettings.debugMode) {
            console.debug(`MetaFlow: Template "${template.template}" could not be processed due to missing metadata for fileClass "${fileClass}"`);
          }
        }
      } catch (error) {
        console.error(`MetaFlow: Error processing template "${template.template}" for fileClass "${fileClass}": ${error.message}`);
      }
    }

    return DEFAULT_TITLE;
  }

  /**
   * Process a template string by replacing placeholders with metadata values
   * @param template - Template string with {{property}} placeholders
   * @param metadata - Metadata object
   * @param fileClass - File class for debug logging
   * @returns Processed template or null if required metadata is missing
   */
  private processTemplate(template: string, metadata: {[key: string]: any}, fileClass: string): string | null {
    // Find all placeholders in the template
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders = [];
    let match;

    while ((match = placeholderRegex.exec(template)) !== null) {
      placeholders.push(match[1].trim());
    }

    // Check if all required metadata is available
    for (const placeholder of placeholders) {
      const value = metadata?.[placeholder];
      if (value === undefined || value === null || value === '') {
        // Required metadata is missing
        return null;
      }
    }

    // Replace all placeholders with actual values
    let result = template;
    for (const placeholder of placeholders) {
      const value = metadata[placeholder];
      const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
      result = result.replace(new RegExp(`\\{\\{\\s*${placeholder}\\s*\\}\\}`, 'g'), stringValue);
    }

    return result.trim();
  }

  /**
   * Sanitize filename to be valid for Obsidian
   * @param filename - Original filename
   * @returns Sanitized filename or empty string if invalid
   */
  private sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return '';
    }

    // Remove or replace invalid characters for filesystem
    // Obsidian doesn't allow: \ / : * ? " < > |
    const sanitized = filename
      .replace(/[\\/:*?"<>|]/g, '')  // Remove forbidden characters
      .replace(/\s+/g, ' ')          // Collapse multiple spaces
      .trim();

    // Check for reserved names and empty strings
    if (!sanitized ||
      sanitized === '.' ||
      sanitized === '..' ||
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(sanitized)) {
      return '';
    }

    // Limit length to reasonable size (Obsidian has filesystem limits)
    return sanitized.substring(0, 255);
  }

}
