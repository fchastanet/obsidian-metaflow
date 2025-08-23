import {injectable, inject} from 'inversify';
import type {LogManagerInterface} from '../managers/types';
import type {UIService} from '../services/UIService';
import type {MetaFlowSettings} from '../settings/types';
import {SimpleCommand} from './types';
import {TYPES} from '../di/types';

/**
 * Command to toggle properties panel visibility
 */
@injectable()
export class TogglePropertiesPanelCommand implements SimpleCommand {
  constructor(
    @inject(TYPES.MetaFlowSettings) private settings: MetaFlowSettings,
    @inject(TYPES.UIService) private uiService: UIService,
    @inject(TYPES.SaveSettings) private saveSettings: () => Promise<void>
  ) { }

  execute(logManager: LogManagerInterface): void {
    this.settings.hidePropertiesInEditor = !this.settings.hidePropertiesInEditor;
    this.uiService.togglePropertiesVisibility(this.settings.hidePropertiesInEditor);
    this.saveSettings();
    logManager.addInfo(`Properties panel ${this.settings.hidePropertiesInEditor ? 'hidden' : 'shown'}`);
  }
}
