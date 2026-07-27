import {App, Setting, Notice} from "obsidian";
import {MetaFlowSettings} from "@metaflow/settings/types";
import {MetaFlowService} from "@metaflow/services/MetaFlowService";

export class ExportImportSection {
  constructor(
    private app: App,
    private metaflowService: MetaFlowService,
    private container: HTMLElement,
    private settings: MetaFlowSettings,
    private onChange: () => void
  ) { }

  render() {
    // Export button
    new Setting(this.container)
      .setName('Export settings')
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
      .setName('Import settings')
      .setDesc('Import settings from a JSON file (overwrites current settings)')
      .addButton(btn => {
        btn.setButtonText('⬆️ Import')
          .setCta()
          .onClick(() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = async (event: Event) => {
              if (event.target === null) return;
              const files = (event.target as HTMLInputElement).files;
              if (!files || files.length === 0) return;
              const file = files[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onload = async (e: ProgressEvent<FileReader>) => {
                if (!e.target || typeof e.target.result !== "string") return;
                try {
                  this.metaflowService.importSettings(e.target.result);
                  new Notice('Settings imported successfully!');
                  this.onChange();
                } catch (err) {
                  console.error(err);
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
