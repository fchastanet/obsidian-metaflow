import {injectable, inject} from 'inversify';
import type {Editor, MarkdownView} from 'obsidian';
import type {LogNoticeManagerInterface} from '@metaflow/managers/types';
import {MetaFlowException} from '@metaflow/MetaFlowException';
import type {MetaFlowService} from '@metaflow/services/MetaFlowService';
import {EditorCommand} from './types';
import {TYPES} from '@metaflow/di/types';

/**
 * Command to update metadata properties in the current editor
 */
@injectable()
export class UpdateMetadataCommand implements EditorCommand {
  constructor(
    @inject(TYPES.MetaFlowService) private metaFlowService: MetaFlowService,
    @inject(TYPES.LogNoticeManagerInterface) private logNoticeManager: LogNoticeManagerInterface,
  ) { }

  execute(editor: Editor, view: MarkdownView): void {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      this.logNoticeManager.addWarning('No active file');
      return;
    }

    try {
      const processedContent = this.metaFlowService.processContent(content, file);

      if (processedContent !== content) {
        editor.setValue(processedContent);
        this.logNoticeManager.addInfo(`Successfully updated metadata fields for "${file.name}"`);
      } else {
        this.logNoticeManager.addInfo('No changes needed');
      }
    } catch (error) {
      console.error('Error updating metadata properties:', error);
      if (error instanceof MetaFlowException) {
        this.logNoticeManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        this.logNoticeManager.addError('Error updating metadata properties');
      }
    }
  }
}
