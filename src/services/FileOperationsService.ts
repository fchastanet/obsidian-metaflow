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

  constructor(
    @inject(TYPES.App) app: App,
    @inject(TYPES.MetaFlowSettings) metaFlowSettings: MetaFlowSettings,
    @inject(TYPES.ObsidianAdapter) obsidianAdapter: ObsidianAdapter,
    @inject(TYPES.FileValidationService) fileValidationService: FileValidationService,
    @inject(TYPES.NoteTitleService) noteTitleService: NoteTitleService
  ) {
    this.app = app;
    this.metaFlowSettings = metaFlowSettings;
    this.obsidianAdapter = obsidianAdapter;
    this.fileValidationService = fileValidationService;
    this.noteTitleService = noteTitleService;
  }

  public async moveNoteToTheRightFolder(file: TFile, fileClass: string): Promise<string | null> {
    this.fileValidationService.checkIfValidFile(file);
    this.fileValidationService.checkIfExcluded(file);
    const targetFolder = this.getTargetFolderForFileClass(fileClass);
    if (targetFolder) {
      if (targetFolder === file.parent?.path || '') {
        console.info(`Note "${file.name}" is already in the right folder: ${targetFolder}`);
        return null;
      }
      const newFilePath = `${targetFolder}/${file.name}`;
      if (file.path === newFilePath) {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`Note ${file.path} is already at ${newFilePath}`);
        }
        return null;
      }
      await this.createFolderIfNeeded(targetFolder);
      this.checkIfTargetFileExists(targetFolder, file);
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
    this.fileValidationService.checkIfValidFile(file);
    this.fileValidationService.checkIfExcluded(file);

    try {
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
