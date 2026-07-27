import {injectable, inject} from 'inversify';
import type {Editor, MarkdownView} from 'obsidian';
import type {LogNoticeManagerInterface} from '@metaflow/managers/types';
import type {FileOperationsService} from '@metaflow/services/FileOperationsService';
import type {FileValidationService} from '@metaflow/services/FileValidationService';
import type {FileClassDeductionService} from '@metaflow/services/FileClassDeductionService';
import type {App} from 'obsidian';
import {EditorCommand} from './types';
import {TYPES} from '@metaflow/di/types';

/**
 * Command to rename file based on configured rules
 */
@injectable()
export class RenameFileBasedOnRulesCommand implements EditorCommand {
  constructor(
    @inject(TYPES.App) private app: App,
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
        this.logNoticeManager.addInfo(`Renaming ${file.name} based on rules for file class: ${fileClass}`);
        await this.fileOperationsService.renameNote(file, fileClass, metadata);
      } else {
        this.logNoticeManager.addWarning(`No file class found for ${file.name}`);
      }
    } catch (error) {
      this.logNoticeManager.addError(`Error renaming note: ${error.message || error}`);
    }
  }
}
