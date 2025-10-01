import {injectable, inject} from 'inversify';
import type {LogNoticeManagerInterface} from '@metaflow/managers/types';
import type {UIService} from '@metaflow/services/UIService';
import type {MetaFlowSettings} from '@metaflow/settings/types';
import {SimpleCommand} from './types';
import {TYPES} from '@metaflow/di/types';

/**
 * Command to toggle properties panel visibility
 */
@injectable()
export class TogglePropertiesPanelCommand implements SimpleCommand {
  constructor(
    @inject(TYPES.MetaFlowSettings) private settings: MetaFlowSettings,
    @inject(TYPES.UIService) private uiService: UIService,
    @inject(TYPES.SaveSettings) private saveSettings: () => Promise<void>,
    @inject(TYPES.LogNoticeManagerInterface) private logNoticeManager: LogNoticeManagerInterface
  ) { }

  execute(): void {
    this.settings.hidePropertiesInEditor = !this.settings.hidePropertiesInEditor;
    this.uiService.togglePropertiesVisibility(this.settings.hidePropertiesInEditor);
    this.saveSettings();
    this.logNoticeManager.addInfo(`Properties panel ${this.settings.hidePropertiesInEditor ? 'hidden' : 'shown'}`);
  }
}
