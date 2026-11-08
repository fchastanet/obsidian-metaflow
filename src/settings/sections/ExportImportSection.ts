import {Notice} from "obsidian";
import type {SettingDefinition, SettingDefinitionGroup} from "obsidian";
import type {MetaFlowService} from "@metaflow/services/MetaFlowService";
import type {SettingsSectionContext} from "./SettingsSectionContext";

const EXPORT_FILENAME = 'metaflow-settings.json';
const JSON_MIME_TYPE = 'application/json';

/**
 * Export/import of MetaFlow settings as JSON (declarative definitions)
 */
export class ExportImportSection {
  constructor(
    private context: SettingsSectionContext,
    private metaflowService: MetaFlowService,
  ) { }

  getDefinition(): SettingDefinitionGroup {
    return {
      type: 'group',
      heading: 'Export and import',
      items: [
        ExportImportSection.buttonDefinition(
          'Export settings', 'Download current settings as a JSON file',
          '⬇️ Export', () => this.exportSettings()),
        ExportImportSection.buttonDefinition(
          'Import settings', 'Import settings from a JSON file (overwrites current settings)',
          '⬆️ Import', () => this.pickSettingsFile()),
      ],
    };
  }

  exportSettings(): void {
    const blob = new Blob([JSON.stringify(this.context.settings, null, 2)], {type: JSON_MIME_TYPE});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = EXPORT_FILENAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async importSettings(json: string): Promise<void> {
    try {
      this.metaflowService.importSettings(json);
    } catch (err) {
      console.error(err);
      new Notice('Failed to import settings: Invalid JSON', 5000);
      return;
    }
    await this.context.save();
    this.context.refresh();
    new Notice('Settings imported successfully!');
  }

  private pickSettingsFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = JSON_MIME_TYPE;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        await this.importSettings(await file.text());
      }
    };
    input.click();
  }

  private static buttonDefinition(
    name: string, desc: string, buttonText: string, onClick: () => void
  ): SettingDefinition {
    return {
      name,
      desc,
      render: setting => {
        setting.addButton(btn => btn.setButtonText(buttonText).setCta().onClick(onClick));
      },
    };
  }
}
