import {Editor, MarkdownView} from 'obsidian';
import {LogManagerInterface} from '../managers/types';
import {MetaFlowException} from '../MetaFlowException';
import {CommandDependencies, EditorCommand} from './types';

/**
 * Command to update metadata properties in the current editor
 */
export class UpdateMetadataCommand implements EditorCommand {
  constructor(private dependencies: CommandDependencies) { }

  execute(editor: Editor, view: MarkdownView, logManager: LogManagerInterface): void {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      logManager.addWarning('No active file');
      return;
    }

    try {
      const processedContent = this.dependencies.metaFlowService.processContent(content, file, logManager);

      if (processedContent !== content) {
        editor.setValue(processedContent);
        logManager.addInfo(`Successfully updated metadata fields for "${file.name}"`);
      } else {
        logManager.addInfo('No changes needed');
      }
    } catch (error) {
      console.error('Error updating metadata properties:', error);
      if (error instanceof MetaFlowException) {
        logManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        logManager.addError('Error updating metadata properties');
      }
    }
  }
}
