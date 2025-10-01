import {injectable, inject} from 'inversify';
import type {TFile} from 'obsidian';
import type {LogNoticeManagerInterface} from '@metaflow/managers/types';
import {ProgressModal} from '@metaflow/ui/ProgressModal';
import {Utils} from '@metaflow/utils/Utils';
import type {MetaFlowService} from '@metaflow/services/MetaFlowService';
import type {ObsidianAdapter} from '@metaflow/externalApi/ObsidianAdapter';
import type {App} from 'obsidian';
import type {MetaFlowSettings} from '@metaflow/settings/types';
import {SimpleCommand} from './types';
import {TYPES} from '@metaflow/di/types';

/**
 * Command to perform mass update of metadata properties across multiple files
 */
@injectable()
export class MassUpdateMetadataCommand implements SimpleCommand {
  constructor(
    @inject(TYPES.App) private app: App,
    @inject(TYPES.MetaFlowSettings) private settings: MetaFlowSettings,
    @inject(TYPES.MetaFlowService) private metaFlowService: MetaFlowService,
    @inject(TYPES.ObsidianAdapter) private obsidianAdapter: ObsidianAdapter,
    @inject(TYPES.LogNoticeManagerInterface) private logNoticeManager: LogNoticeManagerInterface
  ) { }

  async execute(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    await this.massUpdateMetadataProperties("/", files);
  }

  async massUpdateMetadataProperties(
    directory: string,
    files: TFile[],
  ): Promise<void> {
    // Filter out files in excluded folders
    const excludeFolders = (this.settings.excludeFolders || []);
    const filteredFiles = files.filter(file => {
      return !excludeFolders.some(folder => file.path.startsWith(this.obsidianAdapter.folderPrefix(folder)));
    }).filter(file => file.extension === 'md');
    const totalFiles = filteredFiles.length;
    if (totalFiles === 0) {
      this.logNoticeManager.addWarning('No files to update - all files are excluded or no markdown files found.');
      return;
    }

    this.logNoticeManager.addInfo(`Mass updating ${totalFiles} files...`);

    let processedFiles = 0;
    let updatedFiles = 0;
    const errorFiles: TFile[] = [];

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

              const processedContent = this.metaFlowService.processContent(content, file);

              if (processedContent !== content) {
                await this.app.vault.modify(file, processedContent);
                updatedFiles++;
              }

              processedFiles++;

              // Add a small delay to prevent overwhelming the system
              await Utils.sleep(this.settings.frontmatterUpdateDelayMs || 10, () => { });
            } catch (error) {
              console.error(`Error processing file ${file.path}:`, error);
              errorFiles.push(file);
              progressModal.addError(`Error processing ${file.path}: ${error.message || error}`);
            }
          }
        } catch (error) {
          console.error('Mass update error:', error);
          progressModal.addError(`Mass update failed: ${error.message || error}`);
        }
      }
    );

    progressModal.open();

    // Final summary
    if (errorFiles.length > 0) {
      this.logNoticeManager.addWarning(`Completed with errors. Updated ${updatedFiles} files, failed to process ${errorFiles.length} files.`);
    } else {
      this.logNoticeManager.addInfo(`Successfully processed ${processedFiles} files, updated ${updatedFiles} files.`);
    }
  }
}
