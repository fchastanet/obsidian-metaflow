import {
  UpdateMetadataCommand,
  SortMetadataCommand,
  MoveNoteToRightFolderCommand,
  RenameFileBasedOnRulesCommand,
  TogglePropertiesPanelCommand,
  MassUpdateMetadataCommand,
  CommandDependencies
} from './index';
import {LogNoticeManager} from '../managers/LogNoticeManager';
import {ObsidianAdapter} from '../externalApi/ObsidianAdapter';

/**
 * Factory class for creating command instances with proper dependencies
 */
export class CommandFactory {
  private dependencies: CommandDependencies;

  constructor(dependencies: CommandDependencies) {
    this.dependencies = dependencies;
  }

  createUpdateMetadataCommand(): UpdateMetadataCommand {
    return new UpdateMetadataCommand(this.dependencies);
  }

  createSortMetadataCommand(): SortMetadataCommand {
    return new SortMetadataCommand(this.dependencies);
  }

  createMoveNoteToRightFolderCommand(): MoveNoteToRightFolderCommand {
    return new MoveNoteToRightFolderCommand(this.dependencies);
  }

  createRenameFileBasedOnRulesCommand(): RenameFileBasedOnRulesCommand {
    return new RenameFileBasedOnRulesCommand(this.dependencies);
  }

  createTogglePropertiesPanelCommand(): TogglePropertiesPanelCommand {
    return new TogglePropertiesPanelCommand(this.dependencies);
  }

  createMassUpdateMetadataCommand(): MassUpdateMetadataCommand {
    return new MassUpdateMetadataCommand(this.dependencies);
  }

  /**
   * Creates a log manager for command execution
   */
  createLogManager() {
    return new LogNoticeManager(new ObsidianAdapter(this.dependencies.app, this.dependencies.settings));
  }
}
