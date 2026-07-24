import {injectable, inject} from 'inversify';
import type {App, FrontMatterCache} from "obsidian";
import {TFile, TFolder} from "obsidian";
import type {MetaFlowSettings, FolderFileClassMapping} from "@metaflow/settings/types";
import {MetaFlowException} from "@metaflow/MetaFlowException";
import type {ObsidianAdapter} from "@metaflow/externalApi/ObsidianAdapter";
import type {FileValidationService} from "./FileValidationService";
import type {LogNoticeManagerInterface} from "@metaflow/managers/types";
import type {NoteTitleService} from "./NoteTitleService";
import {TYPES} from '@metaflow/di/types';
import {FileStateCache} from '@metaflow/eventManager/cache/FileStateCache';
import {FileState} from '@metaflow/eventManager/cache/types';
import {Utils} from '@metaflow/utils/Utils';
import {SkipException} from '@metaflow/SkipException';
import {FileClassDeductionService} from './FileClassDeductionService';
import {PropertyManagementService} from './PropertyManagementService';
import {MetadataMenuAdapter} from '@metaflow/externalApi/MetadataMenuAdapter';

@injectable()
export class FileOperationsService {
  constructor(
    @inject(TYPES.App) private app: App,
    @inject(TYPES.MetaFlowSettings) private settings: MetaFlowSettings,
    @inject(TYPES.ObsidianAdapter) private obsidianAdapter: ObsidianAdapter,
    @inject(TYPES.FileValidationService) private fileValidationService: FileValidationService,
    @inject(TYPES.NoteTitleService) private noteTitleService: NoteTitleService,
    @inject(TYPES.LogNoticeManagerInterface) private logNoticeManager: LogNoticeManagerInterface,
    @inject(TYPES.FileStateCache) private fileStateCache: FileStateCache,
    @inject(TYPES.FileClassDeductionService) private fileClassDeductionService: FileClassDeductionService,
    @inject(TYPES.PropertyManagementService) private propertyManagementService: PropertyManagementService,
    @inject(TYPES.MetadataMenuAdapter) private metadataMenuAdapter: MetadataMenuAdapter,
    private nowFn = Date.now,
  ) { }

  public async renameNote(
    file: TFile,
    fileClass: string,
    metadata: FrontMatterCache
  ): Promise<TFile | null> {
    const newTitle = this.getNewNoteTitle(file, fileClass, metadata);
    if (!newTitle) {
      return file; // Return the original file when no change is needed (including 'Untitled' case)
    }

    try {
      const updatedFile = await this.moveFile(file, fileClass, newTitle, file.parent?.path ?? '');
      return updatedFile;
    } catch (error) {
      if (error instanceof MetaFlowException) {
        throw error;
      }
      throw new MetaFlowException(`Error renaming note "${file.name}": ${error.message}`, 'error');
    }
  }

  private static innerUpdateFrontmatter(file: TFile, frontmatter: FrontMatterCache, enrichedFrontmatter: FrontMatterCache, deleteEmptyKeys: boolean): void {
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
  }

  public async updateFrontmatter(file: TFile, enrichedFrontmatter: FrontMatterCache, deleteEmptyKeys: boolean): Promise<void> {
    return new Promise((resolve) => {
      this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        FileOperationsService.innerUpdateFrontmatter(file, frontmatter, enrichedFrontmatter, deleteEmptyKeys);
        resolve();
      });
    });
  }

  public async moveNote(
    file: TFile,
    fileClass: string,
    metadata: FrontMatterCache
  ): Promise<void> {
    const newFolderPath = this.getNewNoteFolder(file, fileClass);
    if (!newFolderPath) {
      return;
    }

    try {
      const updatedFile = await this.moveFile(file, fileClass, file.basename, newFolderPath);
      if (updatedFile.path) {
        this.logNoticeManager.addInfo(`Moved note ${file.name} to ${updatedFile.path}`);
      }
    } catch (error) {
      if (error instanceof MetaFlowException) {
        throw error;
      }
      throw new MetaFlowException(`Error moving note "${file.name}": ${error.message}`, 'error');
    }
  }


  public async processFile(filePath: string, state: FileState): Promise<{file: TFile, state: FileState}> {
    const file = this.obsidianAdapter.getAbstractFileByPath(filePath);
    if (!file) {
      if (this.settings.debugMode) console.warn(`FileOperationsService: File not found for path ${filePath}`);
      throw new SkipException(`File not found for path ${filePath}`);
    }
    if (!(file instanceof TFile)) {
      if (this.settings.debugMode) console.warn(`FileOperationsService: Path is not a file ${filePath}`);
      throw new SkipException(`Path is not a file ${filePath}`);
    }
    if (state?.fileMtime < file.stat.mtime) {
      // this state is obsolete
      throw new SkipException(`State is obsolete for file ${filePath}`);
    }

    try {
      this.fileValidationService.checkIfAutomaticMetadataInsertionEnabled();
      this.fileValidationService.checkIfMetadataInsertionApplicable(file);
    } catch (error) {
      if (error instanceof MetaFlowException) {
        this.logNoticeManager.addMessage(`MetaFlow: ${error.message}`, error.noticeLevel);
      } else {
        this.logNoticeManager.addWarning(`Error checking file availability: ${error}`);
      }
      throw error;
    }

    const frontmatter = await this.obsidianAdapter.getFileFrontmatter(file);
    if (frontmatter === null) {
      if (this.settings.debugMode) console.warn(`FileOperationsService: Unable to read frontmatter for file ${filePath}`);
      throw new SkipException(`Unable to read frontmatter for file ${filePath}`);
    }

    const checksum = this.computeChecksum(file, frontmatter);
    if (state.checksum === checksum) {
      if (this.settings.debugMode) console.info(`No changes detected for file: ${filePath}`);
      throw new SkipException(`No changes detected for file: ${filePath}`);
    }

    try {
      // Step 1: Determine or validate fileClass if not available
      const fileClass = this.computeFileClass(file, frontmatter);

      // Step 2: Validate fileClass exists in MetadataMenu, throw error if not found
      this.metadataMenuAdapter.getFileClassByName(fileClass);
      this.metadataMenuAdapter.setFileClassInMetadata(frontmatter, fileClass);

      // Step 3: Synchronize frontmatter with new/obsolete fileClass's fields
      const result = this.metadataMenuAdapter.syncFields(frontmatter, fileClass);

      // Step 4: sort properties if autoSort is enabled
      if (this.settings.autoSort) {
        result.frontmatter = this.propertyManagementService.sortProperties(result.frontmatter, this.settings.sortUnknownPropertiesLast);
      }

      // Step 5: Add default values to properties
      const enrichedFrontmatter = this.propertyManagementService.addDefaultValuesToProperties(
        result.frontmatter || {},
        file,
        fileClass,
        result.addedFields
      );

      // Step 6: Compute new state and store it in cache to avoid immediate re-processing
      const newState = this.computeNewState(file, state, enrichedFrontmatter, fileClass);
      this.fileStateCache.setState(file.path, newState, false);

      // Step 7: Move note to the right folder if autoMoveNoteToRightFolder is enabled
      // Get new title if autoRenameNote is enabled
      let newTitle: string = file.basename;
      if (this.settings.autoRenameNote) {
        newTitle = this.getNewNoteTitle(file, fileClass, enrichedFrontmatter);
      }

      // Step 8: Get new folder path if autoMoveNoteToRightFolder is enabled
      let newFolderPath: string = file.parent?.path ?? '';
      if (this.settings.autoMoveNoteToRightFolder) {
        newFolderPath = this.getNewNoteFolder(file, fileClass);
      }

      // Step 9: Apply file operations if needed
      const newFile = await this.moveFile(file, fileClass, newTitle, newFolderPath);

      // Step 10: Write the updated content back to the file
      await this.updateFrontmatter(newFile, enrichedFrontmatter, true);

      return {file: newFile, state: newState};
    } catch (error) {
      const msg = (error instanceof MetaFlowException) ?
        `Error handling file class change: ${error.message}` :
        `Error handling file class change: ${error}`;
      console.error(msg, error);
      this.logNoticeManager.addMessage(msg, error?.noticeLevel ?? 'error');
      throw error;
    }
  }

  private async createFolderIfNeeded(folder: string): Promise<TFolder | null> {
    if (!this.obsidianAdapter.isFolderExists(folder)) {
      return await this.obsidianAdapter.createFolder(folder);
    }
    return this.app.vault.getFolderByPath(folder);
  }

  /**
   * Get new title for a note if renaming is needed
   * @param file - The file to get new title for
   * @param fileClass - The file class
   * @param metadata - The metadata object
   * @param logNoticeManager - Log manager for reporting
   * @returns New title or null if no change needed
   */
  private getNewNoteTitle(
    file: TFile,
    fileClass: string,
    metadata: FrontMatterCache
  ): string {
    try {
      this.fileValidationService.checkIfValidFile(file);
      this.fileValidationService.checkIfExcluded(file);

      const newTitle = this.noteTitleService.formatNoteTitle(file, fileClass, metadata);

      // Check if the title needs to change
      const currentName = file.basename; // basename without extension
      if (currentName === newTitle) {
        if (this.settings.debugMode) console.debug(`MetaFlow: Note "${file.name}" already has the correct title "${newTitle}"`);
        return currentName;
      } else if (newTitle === 'Untitled') {
        if (this.settings.debugMode) console.debug(`MetaFlow: Note "${file.name}", new title would be 'Untitled', keeping old name`);
        return currentName;
      }

      return newTitle;
    } catch (error) {
      if (error instanceof MetaFlowException) {
        throw error;
      }
      throw new MetaFlowException(`Error getting new title for note "${file.name}": ${error.message}`, 'error');
    }
  }

  /**
   * Get new folder path for a note if moving is needed
   * @param file - The file to get new folder for
   * @param fileClass - The file class
   * @returns New folder path or null if no change needed
   */
  private getNewNoteFolder(file: TFile, fileClass: string): string {
    try {
      this.fileValidationService.checkIfValidFile(file);
      this.fileValidationService.checkIfExcluded(file);

      const currentFolder = file.parent?.path || '';
      const targetFolderMapping = this.getTargetFolderMappingForFileClass(fileClass);
      if (targetFolderMapping) {
        if (targetFolderMapping?.moveToFolder === false) {
          if (this.settings.debugMode) console.debug(`Auto-move for the folder "${targetFolderMapping.folder}" is disabled`);
          return currentFolder;
        }
        return targetFolderMapping.folder.replace(/\/$/, ''); // Remove trailing slash
      }
      throw new MetaFlowException(`No target folder defined for fileClass "${fileClass}"`, 'warning');
    } catch (error) {
      if (error instanceof MetaFlowException) {
        throw error;
      }
      throw new MetaFlowException(`Error getting target folder for note "${file.name}": ${error.message}`, 'error');
    }
  }

  private computeFinalFileName(
    file: TFile,
    newFolderPath: string, newTitle: string, suffix: string | number
  ): string {
    const folder = (newFolderPath === '' || newFolderPath === '/') ? '' : `${newFolderPath}/`;
    return this.obsidianAdapter.normalizePath(`${folder}${newTitle}${suffix}.${file.extension}`);
  }

  /**
   * Rename and/or move a file with conflict resolution
   * @param file - The original file
   * @param newTitle - New title (without extension) or null if no rename needed
   * @param newFolderPath - New folder path or null if no move needed
   * @param logNoticeManager - Log manager for reporting
   * @returns The updated file reference
   */
  private async moveFile(
    file: TFile,
    fileClass: string,
    newTitle: string,
    newFolderPath: string
  ): Promise<TFile> {
    // If we need to move to a different folder, create it first
    if (newFolderPath !== (file.parent?.path || '')) {
      await this.createFolderIfNeeded(newFolderPath);
    }
    // Build the target path
    let targetPath = this.computeFinalFileName(file, newFolderPath, newTitle, '');

    // Check if we actually need to do anything
    if (targetPath === file.path) {
      if (this.settings.debugMode) console.debug(`File "${file.path}" is already at target location with correct name`);
      return file;
    }

    // Handle file conflicts by adding incremental numbers
    let counter = 1;
    let conflictsResolved = false;
    while (this.obsidianAdapter.isFileExists(targetPath) || file.path === targetPath) {
      // Check if file title is already using an incremental number
      const regex = new RegExp(`^${newTitle}(?<increment> \\d+)?$`);
      const match = file.basename.match(regex);
      if (match && match['groups'] && match['groups']['increment']) {
        if (this.settings.debugMode) console.debug(`File "${file.path}" title already contains an incremental number`);
        return file;
      }
      // Compute new target path with incremental number
      targetPath = this.computeFinalFileName(file, newFolderPath, newTitle, ` ${counter}`);
      counter++;
      conflictsResolved = true;
    }

    // it could be possible that the file was already renamed using an incremental number
    if (file.path === targetPath) {
      if (this.settings.debugMode) console.debug(`File "${file.path}" is already at target location with correct name`);
      return file;
    }

    // Perform the actual file operation
    try {
      // Update the cache to avoid re-processing the file immediately
      if (this.settings.debugMode) console.info(`Processing file: ${file.path} with fileClass: ${fileClass}`);
      const frontmatter = await this.obsidianAdapter.getFileFrontmatter(file);
      if (frontmatter === null) {
        throw new MetaFlowException(`Unable to read frontmatter for file ${file.path}`, 'warning');
      }
      const state = {
        fileClass,
        checksum: this.computeChecksum(file, frontmatter),
        fileMtime: this.nowFn() + 1000
      } as FileState;
      this.fileStateCache.setState(file.path, state, false);
      await this.obsidianAdapter.moveNote(file, targetPath);

      // Get the updated file reference
      const updatedFile = this.obsidianAdapter.getAbstractFileByPath(targetPath);
      if (!(updatedFile instanceof TFile)) {
        throw new Error(`Failed to get updated file reference at ${targetPath}`);
      }

      // Log the operation
      this.logNoticeManager.addInfo(`File "${file.name}" renamed to "${targetPath}"${conflictsResolved ? ' (conflict resolved with incremental number)' : ''}`);

      return updatedFile;
    } catch (error) {
      throw new MetaFlowException(`Failed to apply file changes to "${file.name}": ${error.message}`, 'error');
    }
  }

  private getTargetFolderMappingForFileClass(fileClass: string): FolderFileClassMapping | null {
    return this.settings.folderFileClassMappings.find(
      mapping => mapping.fileClass === fileClass) || null;
  }

  private computeNewState(file: TFile, state: FileState, frontmatter: FrontMatterCache, fileClass: string): FileState {
    // if fileClass changed or file renamed
    // it means the frontmatter changed, so we have to recompute checksum again
    const newState = structuredClone(state);
    newState.checksum = this.computeChecksum(file, frontmatter);
    newState.fileClass = fileClass;
    newState.fileMtime = file.stat.mtime + 1000; // add 1 second to avoid immediate re-processing

    return newState;
  }

  private computeFileClass(file: TFile, frontmatter: FrontMatterCache): string {
    let fileClass = this.fileClassDeductionService.getFileClassFromMetadata(frontmatter) || '';
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

    return fileClass;
  }

  /**
   * Compute checksum from file title, frontmatter and relevant settings
   */
  private computeChecksum(file: TFile, frontmatter: FrontMatterCache): string {
    const content = {
      title: file.basename,
      frontmatter: frontmatter || {},
      folderFileClassMappings: this.settings.folderFileClassMappings,
      propertyDefaultValueScripts: this.settings.propertyDefaultValueScripts,
      excludeFolders: this.settings.excludeFolders,
    };
    const checksum = Utils.sha256(JSON.stringify(content));
    return checksum;
  }
}
