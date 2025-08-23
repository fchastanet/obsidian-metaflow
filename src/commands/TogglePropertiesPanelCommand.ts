import {LogManagerInterface} from '../managers/types';
import {CommandDependencies, SimpleCommand} from './types';

/**
 * Command to toggle properties panel visibility
 */
export class TogglePropertiesPanelCommand implements SimpleCommand {
  constructor(private dependencies: CommandDependencies) { }

  execute(logManager: LogManagerInterface): void {
    this.dependencies.settings.hidePropertiesInEditor = !this.dependencies.settings.hidePropertiesInEditor;
    this.dependencies.saveSettings();
    this.dependencies.metaFlowService.togglePropertiesVisibility(this.dependencies.settings.hidePropertiesInEditor);

    const status = this.dependencies.settings.hidePropertiesInEditor ? 'hidden' : 'visible';
    logManager.addInfo(`Properties panel is now ${status}`);
  }
}
