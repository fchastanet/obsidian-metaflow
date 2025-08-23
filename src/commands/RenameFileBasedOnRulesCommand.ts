import {Editor, MarkdownView} from 'obsidian';
import {LogManagerInterface} from '../managers/types';
import {MetaFlowException} from '../MetaFlowException';
import {CommandDependencies, EditorCommand} from './types';

/**
 * Command to rename file based on configured rules
 */
export class RenameFileBasedOnRulesCommand implements EditorCommand {
  constructor(private dependencies: CommandDependencies) { }

  async execute(editor: Editor, view: MarkdownView, logManager: LogManagerInterface): Promise<void> {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      logManager.addWarning('No active file');
      return;
    }

    try {
      this.dependencies.metaFlowService.checkIfValidFile(file);

      const metadata = this.dependencies.metaFlowService.getFrontmatterFromContent(content);
      const fileClass = this.dependencies.metaFlowService.getFileClassFromMetadata(metadata);
      if (fileClass) {
        // Rename note if autoRenameNote is enabled
        if (this.dependencies.settings.autoRenameNote) {
          await this.dependencies.metaFlowService.renameNote(file, fileClass, metadata, logManager);
        }
      } else {
        logManager.addWarning('No file class found');
      }
    } catch (error) {
      console.error('Error renaming file based on rules:', error);
      if (error instanceof MetaFlowException) {
        logManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        logManager.addError('Error renaming file based on rules');
      }
    }
  }
}
