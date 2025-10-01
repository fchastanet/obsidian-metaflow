import {Setting} from "obsidian";
import {MetaFlowSettings} from "@metaflow/settings/types";

export class MetadataInsertionSection {
  constructor(
    private container: HTMLElement,
    private settings: MetaFlowSettings,
    private onChange: () => void
  ) { }

  render() {
    this.container.empty();

    const updateDependentRadioButtons = () => {
      autoSortSetting.components[0].setDisabled(!this.settings.autoMetadataInsertion);
      autoSortSetting.controlEl.setAttribute('title', this.settings.autoMetadataInsertion ? '' : 'Disabled when auto-insert is off');
      autoMoveNoteToRightFolderSetting.components[0].setDisabled(!this.settings.autoMetadataInsertion);
      autoMoveNoteToRightFolderSetting.controlEl.setAttribute('title', this.settings.autoMetadataInsertion ? '' : 'Disabled when auto-insert is off');
      autoRenameNoteSetting.components[0].setDisabled(!this.settings.autoMetadataInsertion);
      autoRenameNoteSetting.controlEl.setAttribute('title', this.settings.autoMetadataInsertion ? '' : 'Disabled when auto-insert is off');
    };

    new Setting(this.container)
      .setName('Auto-insert missing metadata fields')
      .setDesc('Automatically insert missing metadata fields based on fileClass definitions')
      .addToggle(toggle => toggle
        .setValue(this.settings.autoMetadataInsertion)
        .onChange(async (value) => {
          this.settings.autoMetadataInsertion = value;
          if (!this.settings.autoMetadataInsertion) {
            this.settings.autoSort = false;
            this.settings.autoMoveNoteToRightFolder = false;
            this.settings.autoRenameNote = false;
          }
          updateDependentRadioButtons();
          this.onChange();
        }));

    // Auto-sort on view setting
    const autoSortSetting = new Setting(this.container)
      .setName('Auto-sort metadata properties')
      .setDesc('Automatically sort metadata properties when updating metadata')
      .addToggle(toggle => toggle
        .setValue(this.settings.autoSort)
        .onChange(async (value) => {
          this.settings.autoSort = value;
          this.onChange();
        }));

    // Auto-move note to right folder setting
    const autoMoveNoteToRightFolderSetting = new Setting(this.container)
      .setName('Auto-move note to the right folder')
      .setDesc('Automatically move note to the correct folder based on Folder/FileClass mapping when updating metadata')
      .addToggle(toggle => toggle
        .setValue(this.settings.autoMoveNoteToRightFolder)
        .onChange(async (value) => {
          this.settings.autoMoveNoteToRightFolder = value;
          this.onChange();
        }));

    // Auto-rename note setting
    const autoRenameNoteSetting = new Setting(this.container)
      .setName('Auto-rename note based on folder/fileClass mapping')
      .setDesc('Automatically rename note based on the title template or script defined in Folder/FileClass mapping when updating metadata')
      .addToggle(toggle => toggle
        .setValue(this.settings.autoRenameNote)
        .onChange(async (value) => {
          this.settings.autoRenameNote = value;
          this.onChange();
        }));

    // Sort unknown properties setting
    new Setting(this.container)
      .setName('Sort unknown properties alphabetically')
      .setDesc('Sort properties not in the custom order alphabetically at the end')
      .addToggle(toggle => toggle
        .setValue(this.settings.sortUnknownPropertiesLast)
        .onChange(async (value) => {
          this.settings.sortUnknownPropertiesLast = value;
          this.onChange();
        }));


    updateDependentRadioButtons();
  }
}
