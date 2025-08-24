import {App, Setting} from "obsidian";
import {FolderSuggest} from "../FolderSuggest";

export class ExcludeFoldersSection {
  constructor(
    private app: App,
    private container: HTMLElement,
    private excludeFolders: string[],
    private onChange: () => void
  ) { }

  render() {
    this.container.empty();

    this.container.createEl('div', {text: 'Exclude folders', cls: 'setting-item-name'});
    this.container.createEl('div', {text: 'Folders to exclude from metadata update commands. Add one per row.', cls: 'setting-item-description'});

    const excludeFoldersList = this.container.createDiv();

    // Render each folder row
    this.excludeFolders.forEach((folder: string, idx: number) => {
      this.addFolderRow(excludeFoldersList, folder, idx);
    });

    // Add button to add new folder row
    new Setting(this.container)
      .addButton(btn => {
        btn.setButtonText('Add folder')
          .setCta()
          .onClick(async () => {
            this.excludeFolders.push('');
            this.onChange();
            this.addFolderRow(excludeFoldersList, '', this.excludeFolders.length - 1);
          });
      });
  }

  private addFolderRow(excludeFoldersContainer: HTMLDivElement, folder: string, idx: number): void {
    const row = new Setting(excludeFoldersContainer)
      .addText(text => {
        const folderInput = text.inputEl;
        folderInput.classList.add('metaflow-settings-folder-path-input');
        folderInput.value = folder;
        folderInput.placeholder = 'Folder path';

        // Add folder suggestion
        new FolderSuggest(this.app, folderInput);

        folderInput.addEventListener('input', async () => {
          this.excludeFolders[idx] = folderInput.value;
          this.onChange();
        });
      });
    row.settingEl.addClass('metaflow-settings-no-border');
    row.addExtraButton((btn) => {
      btn.setIcon('trash')
        .setTooltip('Remove folder')
        .onClick(async () => {
          this.excludeFolders.splice(idx, 1);
          this.onChange();
          this.render();
        });
    });
  }
}
