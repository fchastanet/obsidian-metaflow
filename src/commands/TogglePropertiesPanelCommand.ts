import {LogManagerInterface} from '../managers/types';
import {CommandDependencies, SimpleCommand} from './types';

/**
 * Command to toggle properties panel visibility
 */
export class TogglePropertiesPanelCommand implements SimpleCommand {
  constructor(private dependencies: CommandDependencies) { }

  execute(logManager: LogManagerInterface): void {
    this.dependencies.settings.hidePropertiesInEditor = !this.dependencies.settings.hidePropertiesInEditor;
    this.dependencies.serviceContainer.uiService.togglePropertiesVisibility(this.dependencies.settings.hidePropertiesInEditor);
    this.dependencies.saveSettings();
    logManager.addInfo(`Properties panel ${this.dependencies.settings.hidePropertiesInEditor ? 'hidden' : 'shown'}`);
  }
}
