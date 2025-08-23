import {injectable, inject} from 'inversify';
import type {TFile} from 'obsidian';
import type {LogManagerInterface} from '../managers/types';
import {ProgressModal} from '../ui/ProgressModal';
import {Utils} from '../utils/Utils';
import type {MetaFlowService} from '../services/MetaFlowService';
import type {ObsidianAdapter} from '../externalApi/ObsidianAdapter';
import type {App} from 'obsidian';
import type {MetaFlowSettings} from '../settings/types';
import {SimpleCommand} from './types';
import {TYPES} from '../di/types';

/**
 * Command to perform mass update of metadata properties across multiple files
 */
@injectable()
export class MassUpdateMetadataCommand implements SimpleCommand {
  constructor(
    @inject(TYPES.App) private app: App,
    @inject(TYPES.MetaFlowSettings) private settings: MetaFlowSettings,
    @inject(TYPES.MetaFlowService) private metaFlowService: MetaFlowService,
    @inject(TYPES.ObsidianAdapter) private obsidianAdapter: ObsidianAdapter
  ) { }

  async execute(logManager: LogManagerInterface): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    await this.massUpdateMetadataProperties("/", files, logManager);
  }

  async massUpdateMetadataProperties(
    directory: string,
    files: TFile[],
    noticeManager: LogManagerInterface,
  ): Promise<void> {
    // Filter out files in excluded folders
    const excludeFolders = (this.settings.excludeFolders || []);
    const filteredFiles = files.filter(file => {
      return !excludeFolders.some(folder => file.path.startsWith(this.obsidianAdapter.folderPrefix(folder)));
    }).filter(file => file.extension === 'md');
    const totalFiles = filteredFiles.length;
    if (totalFiles === 0) {
      noticeManager.addWarning('No files to update - all files are excluded or no markdown files found.');
      return;
    }

    noticeManager.addInfo(`Mass updating ${totalFiles} files...`);

    let processedFiles = 0;
    let updatedFiles = 0;
    let errorFiles: TFile[] = [];

    const progressModal = new ProgressModal(
      this.app,
      totalFiles,
      `Mass Updating ${totalFiles} files`,
      `Mass Updating ${totalFiles} files in the folder "${directory}"`,
      async () => {
        // Cancel callback - just close modal
      },
      async () => {
        // Main processing function
        try {
          for (const file of filteredFiles) {
            try {
              const content = await this.app.vault.read(file);
              progressModal.setCurrentItem(file.path);

              const processedContent = this.metaFlowService.processContent(content, file, noticeManager);

              if (processedContent !== content) {
                await this.app.vault.modify(file, processedContent);
                updatedFiles++;
              }

              processedFiles++;

              // Add a small delay to prevent overwhelming the system
              await Utils.sleep(this.settings.frontmatterUpdateDelayMs || 10, () => { });
            } catch (error: any) {
              console.error(`Error processing file ${file.path}:`, error);
              errorFiles.push(file);
              progressModal.addError(`Error processing ${file.path}: ${error.message || error}`);
            }
          }
        } catch (error: any) {
          console.error('Mass update error:', error);
          progressModal.addError(`Mass update failed: ${error.message || error}`);
        }
      }
    );

    progressModal.open();

    // Final summary
    if (errorFiles.length > 0) {
      noticeManager.addWarning(`Completed with errors. Updated ${updatedFiles} files, failed to process ${errorFiles.length} files.`);
    } else {
      noticeManager.addInfo(`Successfully processed ${processedFiles} files, updated ${updatedFiles} files.`);
    }
  }
}
