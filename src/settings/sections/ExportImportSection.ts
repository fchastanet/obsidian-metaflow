import {App, Setting, Notice} from "obsidian";
import {MetaFlowSettings} from "../types";
import {MetaFlowService} from "../../services/MetaFlowService";

export class ExportImportSection {
  constructor(
    private app: App,
    private metaflowService: MetaFlowService,
    private container: HTMLElement,
    private settings: MetaFlowSettings,
    private onChange: () => void
  ) { }

  render() {
    this.container.createEl('p', {text: 'Export your MetaFlow settings as a JSON file or import settings from a JSON file.'});

    // Export button
    new Setting(this.container)
      .setName('Export Settings')
      .setDesc('Download current settings as a JSON file')
      .addButton(btn => btn
        .setButtonText('⬇️ Export')
        .setCta()
        .onClick(() => {
          const dataStr = JSON.stringify(this.settings, null, 2);
          const blob = new Blob([dataStr], {type: 'application/json'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'metaflow-settings.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        })
      );

    // Import button and file input
    new Setting(this.container)
      .setName('Import Settings')
      .setDesc('Import settings from a JSON file (overwrites current settings)')
      .addButton(btn => {
        btn.setButtonText('⬆️ Import')
          .setCta()
          .onClick(() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = async (event: any) => {
              const file = event.target.files[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onload = async (e: any) => {
                try {
                  this.metaflowService.importSettings(e.target.result);
                  new Notice('Settings imported successfully!');
                  this.onChange();
                } catch (err) {
                  new Notice('Failed to import settings: Invalid JSON', 5000);
                }
              };
              reader.readAsText(file);
            };
            input.click();
          });
      });
  }
}
