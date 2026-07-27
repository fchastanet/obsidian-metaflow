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

    let processedFiles = 0;
    let updatedFiles = 0;
    const errorFiles: TFile[] = [];

    const progressModal = new ProgressModal(
      this.app,
      totalFiles,
      `Mass Updating ${totalFiles} files`,
      `Mass Updating ${totalFiles} files in the folder "${directory}"`,
      this.logNoticeManager,
      async () => {
        // Cancel callback - just close modal
      },
      async (progressModal: ProgressModal) => {
        progressModal.addInfo(`Processing ${totalFiles} files ...`);
        // compute batches of files to process in parallel
        const batchSize = this.settings.massUpdateBatchSize || 5;
        const batches: TFile[][] = [];
        for (let i = 0; i < filteredFiles.length; i += batchSize) {
          batches.push(filteredFiles.slice(i, i + batchSize));
        }

        // Process each batch sequentially, but files within a batch in parallel
        try {
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            if (progressModal.isAborted()) {
              break;
            }
            progressModal.addInfo(`Processing batch ${batchIndex + 1} of ${batches.length} ...`);
            const batch = batches[batchIndex];
            const {updatedInBatch, errorFilesInBatch} = await this.processInBatch(batch, progressModal);
            errorFiles.push(...errorFilesInBatch);
            processedFiles += batch.length;
            updatedFiles += updatedInBatch;
            // Add a small delay to prevent overwhelming the system
            await Utils.sleep(this.settings.frontmatterUpdateDelayMs || 10, () => { });
          }
        } catch (error) {
          console.error('Mass update error:', error);
          progressModal.addError(`Mass update failed: ${String(error)}`);
        } finally {
          // Final summary
          if (errorFiles.length > 0) {
            progressModal.addWarning(`Completed with errors. Updated ${updatedFiles} files, failed to process ${errorFiles.length} files.`);
          } else {
            progressModal.addInfo(`Successfully processed ${processedFiles} files, updated ${updatedFiles} files.`);
          }
          progressModal.finish();
        }
      }
    );

    progressModal.addInfo(`Click on Proceed to update ${totalFiles} files ...`);
    progressModal.open();
  }

  private async processInBatch(files: TFile[], progressModal: ProgressModal): Promise<{updatedInBatch: number, errorFilesInBatch: TFile[]}> {
    let updatedInBatch = 0;
    const errorFilesInBatch: TFile[] = [];
    const promises = files.map(async (file) => {
      const result = await this.processFile(file, progressModal);
      if (result === 1) {
        updatedInBatch++;
      } else if (result === -1) {
        errorFilesInBatch.push(file);
      }
    });
    await Promise.all(promises);
    return {updatedInBatch, errorFilesInBatch};
  }

  private async processFile(file: TFile, progressModal: ProgressModal): Promise<number> {
    if (progressModal.isAborted()) {
      return 0;
    }
    try {
      progressModal.setCurrentItem(`Processing: ${file.path}`);
      const content = await this.app.vault.read(file);
      const processedContent = this.metaFlowService.processContent(content, file);

      if (processedContent !== content) {
        await this.app.vault.modify(file, processedContent);
        return 1; // Updated
      }
    } catch (error) {
      progressModal.addError(`File ${file.path} mass update failed: ${String(error)}`);
      console.error(`Error processing file ${file.path}:`, error);
      return -1; // Error
    }
    return 0; // No update needed
  }
}
