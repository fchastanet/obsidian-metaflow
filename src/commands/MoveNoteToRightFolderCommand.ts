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
    try {
      const file = view.file;
      if (!file) {
        logManager.addError('No active file found');
        return;
      }

      this.dependencies.serviceContainer.fileValidationService.checkIfValidFile(file);
      const metadata = this.dependencies.app.metadataCache.getFileCache(file)?.frontmatter || {};

      const fileClass = this.dependencies.serviceContainer.fileClassDeductionService.getFileClassFromMetadata(metadata);
      if (fileClass) {
        let newFile = file;
        if (this.dependencies.settings.autoRenameNote) {
          const renamedFile = await this.dependencies.serviceContainer.fileOperationsService.renameNote(file, fileClass, metadata, logManager);
          newFile = renamedFile || file;
          logManager.addInfo(`Moving ${newFile.name} to the right folder for file class: ${fileClass}`);
        } else {
          logManager.addInfo(`Moving ${file.name} to the right folder for file class: ${fileClass}`);
        }
        await this.dependencies.serviceContainer.fileOperationsService.moveNoteToTheRightFolder(newFile, fileClass);
      } else {
        logManager.addWarning(`No file class found for ${file.name}`);
      }
    } catch (error) {
      logManager.addError(`Error moving note: ${error.message || error}`);
    }
  }
}
