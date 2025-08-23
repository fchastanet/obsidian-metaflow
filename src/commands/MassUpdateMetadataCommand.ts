import {TFile} from 'obsidian';
import {LogManagerInterface} from '../managers/types';
import {ProgressModal} from '../ui/ProgressModal';
import {Utils} from '../utils/Utils';
import {CommandDependencies, SimpleCommand} from './types';

/**
 * Command to perform mass update of metadata properties across multiple files
 */
export class MassUpdateMetadataCommand implements SimpleCommand {
  constructor(private dependencies: CommandDependencies) { }

  async execute(logManager: LogManagerInterface): Promise<void> {
    const files = this.dependencies.app.vault.getMarkdownFiles();
    await this.massUpdateMetadataProperties("/", files, logManager);
  }

  async massUpdateMetadataProperties(
    directory: string,
    files: TFile[],
    noticeManager: LogManagerInterface,
  ): Promise<void> {
    // Filter out files in excluded folders
    const excludeFolders = (this.dependencies.settings.excludeFolders || []);
    const filteredFiles = files.filter(file => {
      return !excludeFolders.some(folder => file.path.startsWith(this.dependencies.obsidianAdapter.folderPrefix(folder)));
    }).filter(file => file.extension === 'md');
    const totalFiles = filteredFiles.length;
    if (totalFiles === 0) {
      noticeManager.addWarning('No files to update - all files are excluded or no markdown files found.');
      return;
    }
    let abort = false;
    const modal = new ProgressModal(
      this.dependencies.app,
      totalFiles,
      `Mass Updating ${totalFiles} files`,
      `Mass Updating ${totalFiles} files in the folder "${directory}"`,
      async () => {
        abort = true;
        await Utils.sleep(this.dependencies.settings.frontmatterUpdateDelayMs, () => {
          this.dependencies.fileClassStateManager.setEnabled(true);
        });
      },
      async () => {
        // block fileClassStateManager to update note while mass update is in progress
        this.dependencies.fileClassStateManager.setEnabled(false);

        try {
          let updatedCount = 0;
          let processedCount = 0;
          let movedCount = 0;
          let errorCount = 0;
          noticeManager.addInfo(`Starting mass update of ${totalFiles} files...`);
          const startTime = new Date();
          for (const file of filteredFiles) {
            try {
              if (abort) {
                break;
              }
              let fileInError = false;
              // Read file content
              const content = await this.dependencies.app.vault.read(file);
              modal.setCurrentItem(file.path);
              let processedContent = content;
              try {
                processedContent = this.dependencies.metaFlowService.processContent(content, file, modal);
                if (processedContent !== content) {
                  updatedCount++;
                  await this.dependencies.app.vault.modify(file, processedContent);
                }
              } catch (error: any) {
                modal.addError(`Error updating metadata in file ${file.path}: ${error.message}`);
                console.error(`Error processing content for file ${file.path}:`, error);
                fileInError = true;
              }
              // Optionally move note to right folder
              try {
                // Parse metadata for renaming
                const metadata = this.dependencies.metaFlowService.getFrontmatterFromContent(processedContent);
                const fileClass = this.dependencies.metaFlowService.getFileClassFromMetadata(metadata);
                if (fileClass) {
                  // Rename note if autoRenameNote is enabled
                  if (this.dependencies.settings.autoRenameNote) {
                    await this.dependencies.metaFlowService.renameNote(file, fileClass, metadata, modal);
                  }

                  if (this.dependencies.settings.autoMoveNoteToRightFolder) {
                    const newFilePath = await this.dependencies.metaFlowService.moveNoteToTheRightFolder(file, fileClass);
                    if (file.path !== newFilePath) {
                      modal.addInfo(`Moved note ${file.path} to ${newFilePath}`);
                      movedCount++;
                    }
                  }
                }
              } catch (error: any) {
                modal.addError(`Error moving note to the right folder for file ${file.path}: ${error.message}`);
                console.error(`Error moving note to the right folder for file ${file.path}:`, error);
                fileInError = true;
              }
              if (fileInError) {
                errorCount++;
              }
              processedCount++;
            } catch (error: any) {
              modal.addError(`Error updating metadata in file ${file.path}: ${error.message}`);
              console.error(`Error updating metadata in file ${file.path}:`, error);
              errorCount++;
            }
          }
          const endTime = new Date();
          const duration = (endTime.getTime() - startTime.getTime()) / 1000;
          const msg = (errorCount > 0) ? `Mass update completed in ${duration} seconds with ${errorCount} errors` : `Mass update completed in ${duration} seconds`;
          modal.addInfo(msg);
          modal.addInfo(`${processedCount} files processed out of ${totalFiles} total files`);
          modal.addInfo(`${updatedCount} files updated out of ${totalFiles} total files`);
          modal.addInfo(`${movedCount} files moved out of ${totalFiles} total files`);
          if (errorCount > 0) {
            modal.addError(`${errorCount} files encountered errors out of ${totalFiles} total files`);
          }
          modal.finish();
          noticeManager.addInfo(msg);
        } finally {
          this.dependencies.fileClassStateManager.setEnabled(true);
        }
      }
    );
    modal.open();
  }
}
