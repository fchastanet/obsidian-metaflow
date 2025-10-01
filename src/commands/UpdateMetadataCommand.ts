import {injectable, inject} from 'inversify';
import type {Editor, MarkdownView} from 'obsidian';
import type {LogManagerInterface} from '@metaflow/managers/types';
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
    @inject(TYPES.LogManagerInterface) private logManager: LogManagerInterface,
  ) { }

  execute(editor: Editor, view: MarkdownView): void {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      this.logManager.addWarning('No active file');
      return;
    }

    try {
      const processedContent = this.metaFlowService.processContent(content, file);

      if (processedContent !== content) {
        editor.setValue(processedContent);
        this.logManager.addInfo(`Successfully updated metadata fields for "${file.name}"`);
      } else {
        this.logManager.addInfo('No changes needed');
      }
    } catch (error) {
      console.error('Error updating metadata properties:', error);
      if (error instanceof MetaFlowException) {
        this.logManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        this.logManager.addError('Error updating metadata properties');
      }
    }
  }
}
