import {Editor, MarkdownView} from 'obsidian';
import {LogManagerInterface} from '../managers/types';
import {MetaFlowException} from '../MetaFlowException';
import {CommandDependencies, EditorCommand} from './types';

/**
 * Command to move note to the right folder based on file class configuration
 */
export class MoveNoteToRightFolderCommand implements EditorCommand {
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
        let newFile = file;
        // Rename note if autoRenameNote is enabled
        if (this.dependencies.settings.autoRenameNote) {
          const renamedFile = await this.dependencies.metaFlowService.renameNote(file, fileClass, metadata, logManager);
          if (renamedFile) {
            newFile = renamedFile;
          }
        }

        await this.dependencies.metaFlowService.moveNoteToTheRightFolder(newFile, fileClass);
      } else {
        logManager.addWarning('No file class found');
      }
    } catch (error) {
      console.error('Error moving note to the right folder:', error);
      if (error instanceof MetaFlowException) {
        logManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        logManager.addError('Error moving note to the right folder');
      }
    }
  }
}
