/**
 * Dependency injection symbols for InversifyJS
 */
export const TYPES = {
  // Obsidian
  App: Symbol.for('App'),
  MetaFlowSettings: Symbol.for('MetaFlowSettings'),
  SaveSettings: Symbol.for('SaveSettings'),

  // Core services
  ScriptContextService: Symbol.for('ScriptContextService'),
  MetadataMenuAdapter: Symbol.for('MetadataMenuAdapter'),
  FrontMatterService: Symbol.for('FrontMatterService'),
  TemplaterAdapter: Symbol.for('TemplaterAdapter'),
  ObsidianAdapter: Symbol.for('ObsidianAdapter'),

  // Domain services
  FileValidationService: Symbol.for('FileValidationService'),
  FileClassDeductionService: Symbol.for('FileClassDeductionService'),
  PropertyManagementService: Symbol.for('PropertyManagementService'),
  FileOperationsService: Symbol.for('FileOperationsService'),
  NoteTitleService: Symbol.for('NoteTitleService'),
  UIService: Symbol.for('UIService'),

  // Legacy services (for backward compatibility)
  MetaFlowService: Symbol.for('MetaFlowService'),

  // Managers
  FileClassStateManager: Symbol.for('FileClassStateManager'),
  LogManagerInterface: Symbol.for('LogManagerInterface'),

  // Commands
  UpdateMetadataCommand: Symbol.for('UpdateMetadataCommand'),
  SortMetadataCommand: Symbol.for('SortMetadataCommand'),
  MoveNoteToRightFolderCommand: Symbol.for('MoveNoteToRightFolderCommand'),
  RenameFileBasedOnRulesCommand: Symbol.for('RenameFileBasedOnRulesCommand'),
  TogglePropertiesPanelCommand: Symbol.for('TogglePropertiesPanelCommand'),
  MassUpdateMetadataCommand: Symbol.for('MassUpdateMetadataCommand'),
};
