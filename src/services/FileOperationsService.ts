import {injectable, inject} from 'inversify';
import type {App} from "obsidian";
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
      const updatedFile = await this.applyFileChanges(file, null, newFolderPath, this.logManager);
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
    metadata: {[key: string]: any},
    logManager: LogManagerInterface
  ): Promise<TFile | null> {
    const newTitle = this.getNewNoteTitle(file, fileClass, metadata, logManager);
    if (!newTitle) {
      return file; // Return the original file when no change is needed (including 'Untitled' case)
    }

    try {
      const updatedFile = await this.applyFileChanges(file, newTitle, null, logManager);
      return updatedFile;
    } catch (error) {
      if (error instanceof MetaFlowException) {
        throw error;
      }
      throw new MetaFlowException(`Error renaming note "${file.name}": ${error.message}`, 'error');
    }
  }

  async updateFrontmatter(file: TFile, enrichedFrontmatter: any, deleteEmptyKeys: boolean): Promise<void> {
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
    metadata: {[key: string]: any},
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
    metadata: {[key: string]: any},
    logManager: LogManagerInterface
  ): string | null {
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
        return null;
      } else if (newTitle === 'Untitled') {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: Note "${file.name}", new title would be 'Untitled', keeping old name`);
        }
        return null;
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
  public getNewNoteFolder(file: TFile, fileClass: string): string | null {
    try {
      this.fileValidationService.checkIfValidFile(file);
      this.fileValidationService.checkIfExcluded(file);

      const targetFolder = this.getTargetFolderForFileClass(fileClass);
      if (!targetFolder) {
        const targetFolderMapping = this.getTargetFolderMappingForFileClass(fileClass);
        if (targetFolderMapping?.moveToFolder === false) {
          if (this.metaFlowSettings.debugMode) {
            console.debug(`Auto-move for the folder "${targetFolderMapping.folder}" is disabled`);
          }
          return null;
        }
        throw new MetaFlowException(`No target folder defined for fileClass "${fileClass}"`, 'warning');
      }

      const currentFolder = file.parent?.path || '';
      if (targetFolder === currentFolder) {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`Note "${file.name}" is already in the right folder: ${targetFolder}`);
        }
        return null;
      }

      return targetFolder;
    } catch (error) {
      if (error instanceof MetaFlowException) {
        throw error;
      }
      throw new MetaFlowException(`Error getting target folder for note "${file.name}": ${error.message}`, 'error');
    }
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
    newTitle: string | null,
    newFolderPath: string | null,
    logManager: LogManagerInterface
  ): Promise<TFile> {
    let currentFile = file;

    // If we need to move to a different folder, create it first
    if (newFolderPath && newFolderPath !== (file.parent?.path || '')) {
      await this.createFolderIfNeeded(newFolderPath);
    }

    // Determine final file name and path
    const finalTitle = newTitle || file.basename;
    const finalFolderPath = newFolderPath || (file.parent?.path || '');
    const finalFileName = `${finalTitle}.${file.extension}`;

    // Build the target path
    let targetPath = finalFolderPath ? `${finalFolderPath}/${finalFileName}` : finalFileName;
    targetPath = this.obsidianAdapter.normalizePath(targetPath);

    // Check if we actually need to do anything
    if (targetPath === file.path) {
      if (this.metaFlowSettings.debugMode) {
        console.debug(`File "${file.name}" is already at target location with correct name`);
      }
      return currentFile;
    }

    // Handle file conflicts by adding incremental numbers
    let finalTargetPath = targetPath;
    let counter = 1;
    while (this.obsidianAdapter.isFileExists(finalTargetPath)) {
      const baseName = finalTitle;
      const incrementedName = `${baseName} ${counter}`;
      const incrementedFileName = `${incrementedName}.${file.extension}`;
      finalTargetPath = finalFolderPath ? `${finalFolderPath}/${incrementedFileName}` : incrementedFileName;
      finalTargetPath = this.obsidianAdapter.normalizePath(finalTargetPath);
      counter++;
    }

    // Perform the actual file operation
    try {
      await this.obsidianAdapter.moveNote(file, finalTargetPath);

      // Get the updated file reference
      const updatedFile = this.obsidianAdapter.getAbstractFileByPath(finalTargetPath);
      if (!(updatedFile instanceof TFile)) {
        throw new Error(`Failed to get updated file reference at ${finalTargetPath}`);
      }
      currentFile = updatedFile;

      // Log the operation
      if (finalTargetPath !== targetPath) {
        logManager.addInfo(`File "${file.name}" moved/renamed to "${finalTargetPath}" (conflict resolved with incremental number)`);
      } else if (newTitle && newFolderPath) {
        logManager.addInfo(`File "${file.name}" renamed to "${finalFileName}" and moved to "${finalFolderPath}"`);
      } else if (newTitle) {
        logManager.addInfo(`File "${file.name}" renamed to "${finalFileName}"`);
      } else if (newFolderPath) {
        logManager.addInfo(`File "${file.name}" moved to "${finalFolderPath}"`);
      }

      return currentFile;
    } catch (error) {
      throw new MetaFlowException(`Failed to apply file changes to "${file.name}": ${error.message}`, 'error');
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
}
