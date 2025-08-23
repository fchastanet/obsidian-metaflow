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
        logManager.addInfo(`Renaming ${file.name} based on rules for file class: ${fileClass}`);
        await this.dependencies.serviceContainer.fileOperationsService.renameNote(file, fileClass, metadata, logManager);
      } else {
        logManager.addWarning(`No file class found for ${file.name}`);
      }
    } catch (error) {
      logManager.addError(`Error renaming note: ${error.message || error}`);
    }
  }
}
