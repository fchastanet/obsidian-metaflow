import {Editor, MarkdownView} from 'obsidian';
import {LogManagerInterface} from '../managers/types';
import {MetaFlowException} from '../MetaFlowException';
import {CommandDependencies, EditorCommand} from './types';

/**
 * Command to sort metadata properties in the current editor
 */
export class SortMetadataCommand implements EditorCommand {
  constructor(private dependencies: CommandDependencies) { }

  async execute(editor: Editor, view: MarkdownView, logManager: LogManagerInterface): Promise<void> {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      logManager.addWarning('No active file');
      return;
    }

    try {
      await this.dependencies.metaFlowService.processSortContent(content, file);
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
