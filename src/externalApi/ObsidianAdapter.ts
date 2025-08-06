import {App, Notice, TFile} from 'obsidian';
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
    return !!this.app.vault.getAbstractFileByPath(filePath);
  }

  notice(message: string): Notice {
    return new Notice(message);
  }

  createMockTFile(path: string): TFile {
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
