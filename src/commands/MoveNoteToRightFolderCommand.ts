import {injectable, inject} from 'inversify';
import type {Editor, MarkdownView} from 'obsidian';
import type {LogNoticeManagerInterface} from '@metaflow/managers/types';
import {MetaFlowException} from '@metaflow/MetaFlowException';
import type {FileOperationsService} from '@metaflow/services/FileOperationsService';
import type {FileValidationService} from '@metaflow/services/FileValidationService';
import type {FileClassDeductionService} from '@metaflow/services/FileClassDeductionService';
import type {App} from 'obsidian';
import type {MetaFlowSettings} from '@metaflow/settings/types';
import {EditorCommand} from './types';
import {TYPES} from '@metaflow/di/types';

/**
 * Command to move note to the right folder based on file class configuration
 */
@injectable()
export class MoveNoteToRightFolderCommand implements EditorCommand {
  constructor(
    @inject(TYPES.App) private app: App,
    @inject(TYPES.MetaFlowSettings) private settings: MetaFlowSettings,
    @inject(TYPES.FileOperationsService) private fileOperationsService: FileOperationsService,
    @inject(TYPES.FileValidationService) private fileValidationService: FileValidationService,
    @inject(TYPES.FileClassDeductionService) private fileClassDeductionService: FileClassDeductionService,
    @inject(TYPES.LogNoticeManagerInterface) private logNoticeManager: LogNoticeManagerInterface,
  ) { }

  async execute(editor: Editor, view: MarkdownView): Promise<void> {
    try {
      const file = view.file;
      if (!file) {
        this.logNoticeManager.addError('No active file found');
        return;
      }

      this.fileValidationService.checkIfValidFile(file);
      const metadata = this.app.metadataCache.getFileCache(file)?.frontmatter || {};

      const fileClass = this.fileClassDeductionService.getFileClassFromMetadata(metadata);
      if (fileClass) {
        let newFile = file;
        if (this.settings.autoRenameNote) {
          const renamedFile = await this.fileOperationsService.renameNote(file, fileClass, metadata);
          newFile = renamedFile || file;
        }

        await this.fileOperationsService.moveNote(newFile, fileClass, metadata);
      } else {
        this.logNoticeManager.addWarning('No fileClass found in metadata');
      }
    } catch (error) {
      console.error('Error moving note:', error);
      if (error instanceof MetaFlowException) {
        this.logNoticeManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        this.logNoticeManager.addError('Error moving note to the right folder');
      }
    }
  }
}
