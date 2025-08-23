import {Container} from 'inversify';
import {App} from 'obsidian';
import {TYPES} from './types';
import {MetaFlowSettings} from '../settings/types';

// Core services
import {FrontMatterService} from '../services/FrontMatterService';
import {MetadataMenuAdapter} from '../externalApi/MetadataMenuAdapter';
import {TemplaterAdapter} from '../externalApi/TemplaterAdapter';
import {ObsidianAdapter} from '../externalApi/ObsidianAdapter';
import {ScriptContextService} from '../services/ScriptContextService';
import {UIService} from '../services/UIService';

// Domain services
import {FileValidationService} from '../services/FileValidationService';
import {FileClassDeductionService} from '../services/FileClassDeductionService';
import {PropertyManagementService} from '../services/PropertyManagementService';
import {FileOperationsService} from '../services/FileOperationsService';
import {NoteTitleService} from '../services/NoteTitleService';

// Legacy services
import {MetaFlowService} from '../services/MetaFlowService';

// Commands
import {UpdateMetadataCommand} from '../commands/UpdateMetadataCommand';
import {SortMetadataCommand} from '../commands/SortMetadataCommand';
import {MoveNoteToRightFolderCommand} from '../commands/MoveNoteToRightFolderCommand';
import {RenameFileBasedOnRulesCommand} from '../commands/RenameFileBasedOnRulesCommand';
import {TogglePropertiesPanelCommand} from '../commands/TogglePropertiesPanelCommand';
import {MassUpdateMetadataCommand} from '../commands/MassUpdateMetadataCommand';

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

  // Bind domain services
  container.bind<FileValidationService>(TYPES.FileValidationService).to(FileValidationService).inSingletonScope();
  container.bind<FileClassDeductionService>(TYPES.FileClassDeductionService).to(FileClassDeductionService).inSingletonScope();
  container.bind<PropertyManagementService>(TYPES.PropertyManagementService).to(PropertyManagementService).inSingletonScope();
  container.bind<NoteTitleService>(TYPES.NoteTitleService).to(NoteTitleService).inSingletonScope();
  container.bind<FileOperationsService>(TYPES.FileOperationsService).to(FileOperationsService).inSingletonScope();

  // Bind MetaFlowService
  container.bind<MetaFlowService>(TYPES.MetaFlowService).to(MetaFlowService).inSingletonScope();

  // Bind commands
  container.bind<UpdateMetadataCommand>(TYPES.UpdateMetadataCommand).to(UpdateMetadataCommand);
  container.bind(TYPES.SortMetadataCommand).to(SortMetadataCommand);
  container.bind(TYPES.MoveNoteToRightFolderCommand).to(MoveNoteToRightFolderCommand);
  container.bind(TYPES.RenameFileBasedOnRulesCommand).to(RenameFileBasedOnRulesCommand);
  container.bind(TYPES.TogglePropertiesPanelCommand).to(TogglePropertiesPanelCommand);
  container.bind(TYPES.MassUpdateMetadataCommand).to(MassUpdateMetadataCommand);

  return container;
}
