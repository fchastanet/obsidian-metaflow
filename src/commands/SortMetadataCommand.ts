import {injectable, inject} from 'inversify';
import type {Editor, MarkdownView} from 'obsidian';
import type {LogManagerInterface} from '@metaflow/managers/types';
import {MetaFlowException} from '@metaflow/MetaFlowException';
import type {MetaFlowService} from '@metaflow/services/MetaFlowService';
import {EditorCommand} from './types';
import {TYPES} from '@metaflow/di/types';

/**
 * Command to sort metadata properties in the current editor
 */
@injectable()
export class SortMetadataCommand implements EditorCommand {
  constructor(
    @inject(TYPES.MetaFlowService) private metaFlowService: MetaFlowService,
    @inject(TYPES.LogManagerInterface) private logManager: LogManagerInterface
  ) { }

  async execute(editor: Editor, view: MarkdownView): Promise<void> {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      this.logManager.addWarning('No active file');
      return;
    }

    try {
      await this.metaFlowService.processSortContent(content, file);
    } catch (error) {
      console.error('Error sorting metadata properties:', error);
      if (error instanceof MetaFlowException) {
        this.logManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        this.logManager.addError('Error sorting metadata properties');
      }
    }
  }
}
