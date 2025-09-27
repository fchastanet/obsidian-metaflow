import {injectable, inject} from 'inversify';
import type {App, FrontMatterCache} from "obsidian";
import {TFile, TFolder} from "obsidian";
import type {MetaFlowSettings, FolderFileClassMapping} from "../settings/types";
import {MetaFlowException} from "../MetaFlowException";
import type {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import type {FileValidationService} from "./FileValidationService";
import type {LogManagerInterface} from "../managers/types";
import type {NoteTitleService} from "./NoteTitleService";
import {TYPES} from '../di/types';

@injectable()
export class FileOperationsService {
  private app: App;
  private metaFlowSettings: MetaFlowSettings;
  private obsidianAdapter: ObsidianAdapter;
  private fileValidationService: FileValidationService;
  private noteTitleService: NoteTitleService;
  private logManager: LogManagerInterface;

  constructor(
    @inject(TYPES.App) app: App,
    @inject(TYPES.MetaFlowSettings) metaFlowSettings: MetaFlowSettings,
    @inject(TYPES.ObsidianAdapter) obsidianAdapter: ObsidianAdapter,
    @inject(TYPES.FileValidationService) fileValidationService: FileValidationService,
    @inject(TYPES.NoteTitleService) noteTitleService: NoteTitleService,
    @inject(TYPES.LogManagerInterface) logManager: LogManagerInterface
  ) {
    this.app = app;
    this.metaFlowSettings = metaFlowSettings;
    this.obsidianAdapter = obsidianAdapter;
    this.fileValidationService = fileValidationService;
    this.noteTitleService = noteTitleService;
    this.logManager = logManager;
  }

  public async moveNoteToTheRightFolder(file: TFile, fileClass: string): Promise<string | null> {
    const newFolderPath = this.getNewNoteFolder(file, fileClass);
    if (!newFolderPath) {
      return null;
    }

    try {
      const updatedFile = await this.applyFileChanges(file, file.basename, newFolderPath, this.logManager);
      return updatedFile.path;
    } catch (error) {
      if (error instanceof MetaFlowException) {
        throw error;
      }
      throw new MetaFlowException(`Error moving note "${file.name}": ${error.message}`, 'error');
    }
  }

  public async renameNote(
    file: TFile,
    fileClass: string,
    metadata: FrontMatterCache,
    logManager: LogManagerInterface
  ): Promise<TFile | null> {
    const newTitle = this.getNewNoteTitle(file, fileClass, metadata, logManager);
    if (!newTitle) {
      return file; // Return the original file when no change is needed (including 'Untitled' case)
    }

    try {
      const updatedFile = await this.applyFileChanges(file, newTitle, file.parent?.path ?? '', logManager);
      return updatedFile;
    } catch (error) {
      if (error instanceof MetaFlowException) {
        throw error;
      }
      throw new MetaFlowException(`Error renaming note "${file.name}": ${error.message}`, 'error');
    }
  }

  async updateFrontmatter(file: TFile, enrichedFrontmatter: FrontMatterCache, deleteEmptyKeys: boolean): Promise<void> {
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

  private async createFolderIfNeeded(folder: string): Promise<TFolder | null> {
    if (!this.obsidianAdapter.isFolderExists(folder)) {
      return await this.obsidianAdapter.createFolder(folder);
    }
    return this.app.vault.getFolderByPath(folder);
  }

  public async moveNote(
    file: TFile,
    fileClass: string,
    metadata: FrontMatterCache,
    logManager: LogManagerInterface
  ): Promise<void> {
    const newFilePath = await this.moveNoteToTheRightFolder(file, fileClass);
    if (newFilePath) {
      logManager.addInfo(`Moved note ${file.name} to ${newFilePath}`);
    }
  }

  /**
   * Get new title for a note if renaming is needed
   * @param file - The file to get new title for
   * @param fileClass - The file class
   * @param metadata - The metadata object
   * @param logManager - Log manager for reporting
   * @returns New title or null if no change needed
   */
  public getNewNoteTitle(
    file: TFile,
    fileClass: string,
    metadata: FrontMatterCache,
    logManager: LogManagerInterface
  ): string {
    try {
      this.fileValidationService.checkIfValidFile(file);
      this.fileValidationService.checkIfExcluded(file);

      const newTitle = this.noteTitleService.formatNoteTitle(file, fileClass, metadata, logManager);

      // Check if the title needs to change
      const currentName = file.basename; // basename without extension
      if (currentName === newTitle) {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: Note "${file.name}" already has the correct title "${newTitle}"`);
        }
        return currentName;
      } else if (newTitle === 'Untitled') {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: Note "${file.name}", new title would be 'Untitled', keeping old name`);
        }
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
  public getNewNoteFolder(file: TFile, fileClass: string): string {
    try {
      this.fileValidationService.checkIfValidFile(file);
      this.fileValidationService.checkIfExcluded(file);

      const currentFolder = file.parent?.path || '';
      const targetFolderMapping = this.getTargetFolderMappingForFileClass(fileClass);
      if (targetFolderMapping) {
        if (targetFolderMapping?.moveToFolder === false) {
          if (this.metaFlowSettings.debugMode) {
            console.debug(`Auto-move for the folder "${targetFolderMapping.folder}" is disabled`);
          }
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
   * Apply file changes (rename and/or move) with conflict resolution
   * @param file - The original file
   * @param newTitle - New title (without extension) or null if no rename needed
   * @param newFolderPath - New folder path or null if no move needed
   * @param logManager - Log manager for reporting
   * @returns The updated file reference
   */
  public async applyFileChanges(
    file: TFile,
    newTitle: string,
    newFolderPath: string,
    logManager: LogManagerInterface
  ): Promise<TFile> {
    // If we need to move to a different folder, create it first
    if (newFolderPath !== (file.parent?.path || '')) {
      await this.createFolderIfNeeded(newFolderPath);
    }
    // Build the target path
    let targetPath = this.computeFinalFileName(file, newFolderPath, newTitle, '');

    // Check if we actually need to do anything
    if (targetPath === file.path) {
      if (this.metaFlowSettings.debugMode) {
        console.debug(`File "${file.path}" is already at target location with correct name`);
      }
      return file;
    }

    // Handle file conflicts by adding incremental numbers
    let counter = 1;
    let conflictsResolved = false;
    while (this.obsidianAdapter.isFileExists(targetPath) || file.path === targetPath) {
      targetPath = this.computeFinalFileName(file, newFolderPath, newTitle, ` ${counter}`);
      counter++;
      conflictsResolved = true;
    }

    // it could be possible that the file was already renamed using an incremental number
    if (file.path === targetPath) {
      if (this.metaFlowSettings.debugMode) {
        console.debug(`File "${file.path}" is already at target location with correct name`);
      }
      return file;
    }

    // Perform the actual file operation
    try {
      await this.obsidianAdapter.moveNote(file, targetPath);

      // Get the updated file reference
      const updatedFile = this.obsidianAdapter.getAbstractFileByPath(targetPath);
      if (!(updatedFile instanceof TFile)) {
        throw new Error(`Failed to get updated file reference at ${targetPath}`);
      }

      // Log the operation
      logManager.addInfo(`File "${file.name}" renamed to "${targetPath}"${conflictsResolved ? ' (conflict resolved with incremental number)' : ''}`);

      return updatedFile;
    } catch (error) {
      throw new MetaFlowException(`Failed to apply file changes to "${file.name}": ${error.message}`, 'error');
    }
  }

  private getTargetFolderMappingForFileClass(fileClass: string): FolderFileClassMapping | null {
    return this.metaFlowSettings.folderFileClassMappings.find(
      mapping => mapping.fileClass === fileClass) || null;
  }
}
