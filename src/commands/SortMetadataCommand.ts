import {injectable, inject} from 'inversify';
import type {Editor, MarkdownView} from 'obsidian';
import type {LogManagerInterface} from '../managers/types';
import {MetaFlowException} from '../MetaFlowException';
import type {MetaFlowService} from '../services/MetaFlowService';
import {EditorCommand} from './types';
import {TYPES} from '../di/types';

/**
 * Command to sort metadata properties in the current editor
 */
@injectable()
export class SortMetadataCommand implements EditorCommand {
  constructor(
    @inject(TYPES.MetaFlowService) private metaFlowService: MetaFlowService
  ) { }

  async execute(editor: Editor, view: MarkdownView, logManager: LogManagerInterface): Promise<void> {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      logManager.addWarning('No active file');
      return;
    }

    try {
      await this.metaFlowService.processSortContent(content, file);
    } catch (error) {
      console.error('Error sorting metadata properties:', error);
      if (error instanceof MetaFlowException) {
        logManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        logManager.addError('Error sorting metadata properties');
      }
    }
  }
}
