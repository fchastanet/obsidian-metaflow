import {Container} from 'inversify';
import {App} from 'obsidian';
import {TYPES} from './types';
import {MetaFlowSettings} from '@metaflow/settings/types';

// Core services
import {FrontMatterService} from '@metaflow/services/FrontMatterService';
import {MetadataMenuAdapter} from '@metaflow/externalApi/MetadataMenuAdapter';
import {TemplaterAdapter} from '@metaflow/externalApi/TemplaterAdapter';
import {ObsidianAdapter} from '@metaflow/externalApi/ObsidianAdapter';
import {ScriptContextService} from '@metaflow/services/ScriptContextService';
import {UIService} from '@metaflow/services/UIService';

// Domain services
import {FileValidationService} from '@metaflow/services/FileValidationService';
import {FileClassDeductionService} from '@metaflow/services/FileClassDeductionService';
import {PropertyManagementService} from '@metaflow/services/PropertyManagementService';
import {FileOperationsService} from '@metaflow/services/FileOperationsService';
import {NoteTitleService} from '@metaflow/services/NoteTitleService';

// Managers
import {LogNoticeManager} from '@metaflow/managers/LogNoticeManager';
import {LogManagerInterface} from '@metaflow/managers/types';

// Legacy services
import {MetaFlowService} from '@metaflow/services/MetaFlowService';

// Commands
import {UpdateMetadataCommand} from '@metaflow/commands/UpdateMetadataCommand';
import {SortMetadataCommand} from '@metaflow/commands/SortMetadataCommand';
import {MoveNoteToRightFolderCommand} from '@metaflow/commands/MoveNoteToRightFolderCommand';
import {RenameFileBasedOnRulesCommand} from '@metaflow/commands/RenameFileBasedOnRulesCommand';
import {TogglePropertiesPanelCommand} from '@metaflow/commands/TogglePropertiesPanelCommand';
import {MassUpdateMetadataCommand} from '@metaflow/commands/MassUpdateMetadataCommand';
import EventManager, {EventManagerInterface} from '@metaflow/eventManager/EventManager';
import {FileFilter} from '@metaflow/eventManager/FileFilter';
import {FileStateCache} from '@metaflow/eventManager/cache/FileStateCache';
import FileCachePersistence from '@metaflow/eventManager/cache/FileCachePersistence';
import {InternalFileState} from '@metaflow/eventManager/cache/types';
import EventCron from '@metaflow/eventManager/EventCron';
import {FileProcessor} from '@metaflow/eventManager/FileProcessor';

/**
 * Creates and configures the dependency injection container
 */
export function createContainer(app: App, settings: MetaFlowSettings, saveSettings: () => Promise<void>): Container {
  const container = new Container();

  // Bind Obsidian instances
  container.bind<App>(TYPES.App).toConstantValue(app);
  container.bind<MetaFlowSettings>(TYPES.MetaFlowSettings).toConstantValue(settings);
  container.bind<() => Promise<void>>(TYPES.SaveSettings).toConstantValue(saveSettings);

  // Bind core services
  container.bind<FrontMatterService>(TYPES.FrontMatterService).to(FrontMatterService).inSingletonScope();
  container.bind<MetadataMenuAdapter>(TYPES.MetadataMenuAdapter).to(MetadataMenuAdapter).inSingletonScope();
  container.bind<ObsidianAdapter>(TYPES.ObsidianAdapter).to(ObsidianAdapter).inSingletonScope();
  container.bind<TemplaterAdapter>(TYPES.TemplaterAdapter).to(TemplaterAdapter).inSingletonScope();
  container.bind<ScriptContextService>(TYPES.ScriptContextService).to(ScriptContextService).inSingletonScope();
  container.bind<UIService>(TYPES.UIService).to(UIService).inSingletonScope();

  // Bind managers
  container.bind<LogManagerInterface>(TYPES.LogManagerInterface).to(LogNoticeManager).inSingletonScope();

  // Bind domain services
  container.bind<FileValidationService>(TYPES.FileValidationService).to(FileValidationService).inSingletonScope();
  container.bind<FileClassDeductionService>(TYPES.FileClassDeductionService).to(FileClassDeductionService).inSingletonScope();
  container.bind<PropertyManagementService>(TYPES.PropertyManagementService).to(PropertyManagementService).inSingletonScope();
  container.bind<NoteTitleService>(TYPES.NoteTitleService).to(NoteTitleService).inSingletonScope();
  container.bind<FileOperationsService>(TYPES.FileOperationsService).to(FileOperationsService).inSingletonScope();

  // Bind MetaFlowService
  container.bind<MetaFlowService>(TYPES.MetaFlowService).to(MetaFlowService).inSingletonScope();

  // Bind event manager
  container.bind<EventManagerInterface>(TYPES.EventManagerInterface).to(EventManager).inSingletonScope();
  container.bind<FileFilter>(TYPES.FileFilter).to(FileFilter).inSingletonScope();
  container.bind<FileStateCache>(TYPES.FileStateCache).to(FileStateCache).inSingletonScope();
  container.bind<FileCachePersistence<InternalFileState>>(TYPES.FileCachePersistence).to(FileCachePersistence).inSingletonScope();
  container.bind<EventCron>(TYPES.EventCron).to(EventCron).inSingletonScope();
  container.bind<FileProcessor>(TYPES.FileProcessor).to(FileProcessor).inSingletonScope();

  // Bind commands
  container.bind<UpdateMetadataCommand>(TYPES.UpdateMetadataCommand).to(UpdateMetadataCommand);
  container.bind(TYPES.SortMetadataCommand).to(SortMetadataCommand);
  container.bind(TYPES.MoveNoteToRightFolderCommand).to(MoveNoteToRightFolderCommand);
  container.bind(TYPES.RenameFileBasedOnRulesCommand).to(RenameFileBasedOnRulesCommand);
  container.bind(TYPES.TogglePropertiesPanelCommand).to(TogglePropertiesPanelCommand);
  container.bind(TYPES.MassUpdateMetadataCommand).to(MassUpdateMetadataCommand);

  return container;
}
