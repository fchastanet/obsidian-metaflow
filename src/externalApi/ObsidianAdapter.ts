import {App, Notice, TAbstractFile, TFile, TFolder} from 'obsidian';
import {MetaFlowSettings} from '../settings/types';

export class ObsidianAdapter {
  private app: App;
  private settings: MetaFlowSettings;

  constructor(app: App, settings: MetaFlowSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Generate a markdown link to a file
   */
  generateMarkdownLink(targetFile: TFile | null, sourceFile?: TFile | null): string {
    const sourcePath = sourceFile ? sourceFile.path : '';
    if (!targetFile) {
      return '';
    }
    return this.app.fileManager.generateMarkdownLink(targetFile, sourcePath);
  }

  async moveNote(file: TFile, newPath: string): Promise<void> {
    console.info(`Moving note ${file.path} to ${newPath}`);
    return await this.app.fileManager.renameFile(file, newPath);
  }

  isFileExists(filePath: string): boolean {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    return !!file && file instanceof TFile;
  }

  isFolderExists(filePath: string): boolean {
    const folder = this.app.vault.getAbstractFileByPath(filePath);
    return !!folder && folder instanceof TFolder;
  }

  async createFolder(folderPath: string): Promise<TFolder> {
    return await this.app.vault.createFolder(folderPath);
  }

  getAbstractFileByPath(filePath: string): TAbstractFile | null {
    return this.app.vault.getAbstractFileByPath(filePath);
  }

  notice(message: string): Notice {
    return new Notice(message);
  }

  static createMockTFile(path: string): TFile {
    const file = {
      path,
      name: path.split('/').pop() || path,
      stat: {} as any,
      basename: path.split('/').pop() || path,
      extension: 'md',
      vault: {} as any,
      parent: {} as any,
    } as TFile;
    Object.setPrototypeOf(file, TFile.prototype);
    return file;
  }

}
