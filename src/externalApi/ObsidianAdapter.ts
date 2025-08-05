import {App, TFile} from 'obsidian';
import {MetaFlowSettings} from 'src/settings/types';

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
}
