import {injectable, inject} from 'inversify';
import type {App, CachedMetadata, TFile} from "obsidian";
import type {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import type {FrontMatterService} from "./FrontMatterService";
import type {TemplaterAdapter} from "../externalApi/TemplaterAdapter";
import type {ScriptContextService} from "./ScriptContextService";
import type {MetaFlowSettings, PropertyDefaultValueScript} from "../settings/types";
import {FolderFileClassMapping} from "../settings/types";
import {MetaFlowException} from "../MetaFlowException";
import type {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import type {LogManagerInterface} from "../managers/types";
import {Utils} from "../utils/Utils";
import {DEFAULT_SETTINGS} from "../settings/defaultSettings";
import type {FileValidationService} from "./FileValidationService";
import type {FileClassDeductionService} from "./FileClassDeductionService";
import type {PropertyManagementService} from "./PropertyManagementService";
import type {FileOperationsService} from "./FileOperationsService";
import type {NoteTitleService} from "./NoteTitleService";
import {TYPES} from '../di/types';

@injectable()
export class MetaFlowService {
  private app: App;
  private metaFlowSettings: MetaFlowSettings;
  private scriptContextService: ScriptContextService;
  private metadataMenuAdapter: MetadataMenuAdapter;
  private frontMatterService: FrontMatterService;
  private templaterAdapter: TemplaterAdapter;
  private obsidianAdapter: ObsidianAdapter;

  // New services
  private fileValidationService: FileValidationService;
  private fileClassDeductionService: FileClassDeductionService;
  private propertyManagementService: PropertyManagementService;
  private fileOperationsService: FileOperationsService;
  private noteTitleService: NoteTitleService;

  constructor(
    @inject(TYPES.App) app: App,
    @inject(TYPES.MetaFlowSettings) metaFlowSettings: MetaFlowSettings,
    @inject(TYPES.ScriptContextService) scriptContextService: ScriptContextService,
    @inject(TYPES.MetadataMenuAdapter) metadataMenuAdapter: MetadataMenuAdapter,
    @inject(TYPES.FrontMatterService) frontMatterService: FrontMatterService,
    @inject(TYPES.TemplaterAdapter) templaterAdapter: TemplaterAdapter,
    @inject(TYPES.ObsidianAdapter) obsidianAdapter: ObsidianAdapter,
    @inject(TYPES.FileValidationService) fileValidationService: FileValidationService,
    @inject(TYPES.FileClassDeductionService) fileClassDeductionService: FileClassDeductionService,
    @inject(TYPES.PropertyManagementService) propertyManagementService: PropertyManagementService,
    @inject(TYPES.FileOperationsService) fileOperationsService: FileOperationsService,
    @inject(TYPES.NoteTitleService) noteTitleService: NoteTitleService
  ) {
    this.app = app;
    this.metaFlowSettings = metaFlowSettings;
    this.scriptContextService = scriptContextService;
    this.metadataMenuAdapter = metadataMenuAdapter;
    this.frontMatterService = frontMatterService;
    this.templaterAdapter = templaterAdapter;
    this.obsidianAdapter = obsidianAdapter;
    this.fileValidationService = fileValidationService;
    this.fileClassDeductionService = fileClassDeductionService;
    this.propertyManagementService = propertyManagementService;
    this.fileOperationsService = fileOperationsService;
    this.noteTitleService = noteTitleService;

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
      this.fileValidationService.checkIfAutomaticMetadataInsertionEnabled();
      this.fileValidationService.checkIfMetadataInsertionApplicable(file);
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
        const deducedFileClass = this.fileClassDeductionService.deduceFileClassFromPath(file.path);
        if (!deducedFileClass) {
          throw new MetaFlowException(`No fileClass found for file "${file.name}" and no matching folder pattern.`, 'warning');
        }
        if (!this.fileClassDeductionService.validateFileClassAgainstMapping(file.path, deducedFileClass)) {
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
        updatedFrontmatter = this.propertyManagementService.sortProperties(updatedFrontmatter, this.metaFlowSettings.sortUnknownPropertiesLast);
      }

      // Step 5: Add default values to properties
      const enrichedFrontmatter = this.propertyManagementService.addDefaultValuesToProperties(
        updatedFrontmatter || {},
        file,
        fileClass,
        logManager
      );

      await Utils.sleep(this.metaFlowSettings.frontmatterUpdateDelayMs, async () => {
        await this.fileOperationsService.updateFrontmatter(file, enrichedFrontmatter, true)
        // Step 6: Move note to the right folder if autoMoveNoteToRightFolder is enabled
        try {
          // Rename note if autoRenameNote is enabled
          if (this.metaFlowSettings.autoRenameNote) {
            await this.fileOperationsService.renameNote(file, fileClass, enrichedFrontmatter, logManager);
          }

          if (this.metaFlowSettings.autoMoveNoteToRightFolder) {
            const newFilePath = await this.fileOperationsService.moveNoteToTheRightFolder(file, fileClass);
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

  processContent(content: string, file: TFile, logManager: LogManagerInterface): string {
    this.fileValidationService.checkIfMetadataInsertionApplicable(file);
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
        const deducedFileClass = this.fileClassDeductionService.deduceFileClassFromPath(file.path);
        if (!deducedFileClass) {
          throw new MetaFlowException(`No fileClass found for file "${file.name}" and no matching folder pattern.`, 'warning');
        }
        if (!this.fileClassDeductionService.validateFileClassAgainstMapping(file.path, deducedFileClass)) {
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
        updatedFrontmatter = this.propertyManagementService.sortProperties(updatedFrontmatter, this.metaFlowSettings.sortUnknownPropertiesLast);
      }

      // Step 6: Add default values to properties
      const enrichedFrontmatter = this.propertyManagementService.addDefaultValuesToProperties(
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

  public getFrontmatterFromContent(content: string): any | null {
    const parseResult = this.frontMatterService.parseFrontmatter(content);
    return parseResult?.metadata || null;
  }

  public async processSortContent(content: string, file: TFile): Promise<void> {
    this.fileValidationService.checkIfValidFile(file);
    this.fileValidationService.checkIfExcluded(file);

    try {
      // Step 1: parse frontmatter
      const parseResult = this.frontMatterService.parseFrontmatter(content);

      let enrichedFrontmatter: any = {};

      if (parseResult) {
        enrichedFrontmatter = parseResult.metadata || {};
      }
      enrichedFrontmatter = this.propertyManagementService.sortProperties(enrichedFrontmatter, this.metaFlowSettings.sortUnknownPropertiesLast);

      await Utils.sleep(this.metaFlowSettings.frontmatterUpdateDelayMs, async () => {
        await this.fileOperationsService.updateFrontmatter(file, enrichedFrontmatter, false);
      });
    } catch (error) {
      console.error('Error sorting metadata fields:', error);
      throw new MetaFlowException(`Error sorting metadata fields: ${error.message}`, 'error');
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
    return this.noteTitleService.formatNoteTitle(file, fileClass, metadata, logManager);
  }

}
