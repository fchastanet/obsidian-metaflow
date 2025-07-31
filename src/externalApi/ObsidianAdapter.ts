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
  generateMarkdownLink(targetFile: TFile, sourceFile?: TFile): string {
    const sourcePath = sourceFile ? sourceFile.path : '';
    return this.app.fileManager.generateMarkdownLink(targetFile, sourcePath);
  }
}
