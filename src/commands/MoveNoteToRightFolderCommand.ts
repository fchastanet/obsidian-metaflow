import {injectable, inject} from 'inversify';
import type {Editor, MarkdownView} from 'obsidian';
import type {LogManagerInterface} from '../managers/types';
import {MetaFlowException} from '../MetaFlowException';
import type {FileOperationsService} from '../services/FileOperationsService';
import type {FileValidationService} from '../services/FileValidationService';
import type {FileClassDeductionService} from '../services/FileClassDeductionService';
import type {App} from 'obsidian';
import type {MetaFlowSettings} from '../settings/types';
import {EditorCommand} from './types';
import {TYPES} from '../di/types';

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
    @inject(TYPES.FileClassDeductionService) private fileClassDeductionService: FileClassDeductionService
  ) { }

  async execute(editor: Editor, view: MarkdownView, logManager: LogManagerInterface): Promise<void> {
    try {
      const file = view.file;
      if (!file) {
        logManager.addError('No active file found');
        return;
      }

      this.fileValidationService.checkIfValidFile(file);
      const metadata = this.app.metadataCache.getFileCache(file)?.frontmatter || {};

      const fileClass = this.fileClassDeductionService.getFileClassFromMetadata(metadata);
      if (fileClass) {
        let newFile = file;
        if (this.settings.autoRenameNote) {
          const renamedFile = await this.fileOperationsService.renameNote(file, fileClass, metadata, logManager);
          newFile = renamedFile || file;
        }

        await this.fileOperationsService.moveNote(newFile, fileClass, metadata, logManager);
      } else {
        logManager.addWarning('No fileClass found in metadata');
      }
    } catch (error) {
      console.error('Error moving note:', error);
      if (error instanceof MetaFlowException) {
        logManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        logManager.addError('Error moving note to the right folder');
      }
    }
  }
}
