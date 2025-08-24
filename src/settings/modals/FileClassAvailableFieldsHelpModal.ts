import {App, Modal} from 'obsidian';
import {MetadataMenuAdapter} from '../../externalApi/MetadataMenuAdapter';
import {LogNoticeManager} from 'src/managers/LogNoticeManager';

export class FileClassAvailableFieldsHelpModal extends Modal {

  constructor(
    app: App,
    private fileClass: string,
    private metadataMenuAdapter: MetadataMenuAdapter,
    private logManager: LogNoticeManager,
  ) {
    super(app);
  }

  onOpen() {
    const {contentEl} = this;
    contentEl.empty();
    contentEl.createEl('h2', {text: 'Available Fields'});

    if (!this.fileClass) {
      contentEl.createEl('p', {text: 'Please select a fileClass first to see available fields.'});
      return;
    }

    contentEl.createEl('h3', {text: `Fields for fileClass: ${this.fileClass}`});

    try {
      if (this.metadataMenuAdapter.isMetadataMenuAvailable()) {
        const fields = this.metadataMenuAdapter.getFileClassAndAncestorsFields(this.fileClass, this.logManager);

        if (fields.length > 0) {
          const fieldsList = contentEl.createEl('ul');
          fields.forEach((field: any) => {
            const fieldItem = fieldsList.createEl('li');
            fieldItem.createEl('strong', {text: field.name});
            if (field.type) {
              fieldItem.appendText(` (${field.type})`);
            }
            if (field.tooltip) {
              fieldItem.appendText(` - ${field.tooltip}`);
            }
          });
        } else {
          contentEl.createEl('p', {text: 'No fields found for this fileClass.'});
        }
      } else {
        contentEl.createEl('p', {text: 'MetadataMenu plugin is not available. Cannot show field information.'});
      }
    } catch (error) {
      contentEl.createEl('p', {text: `Error retrieving fields: ${error.message}`});
    }

    // Add template syntax help
    contentEl.createEl('h3', {text: 'Template Syntax'});
    const syntaxList = contentEl.createEl('ul');
    syntaxList.createEl('li', {text: '{{fieldName}} - Insert value of a metadata field'});
    syntaxList.createEl('li', {text: '{{file.name}} - File name without extension'});
    syntaxList.createEl('li', {text: '{{file.basename}} - File name without path and extension'});
    syntaxList.createEl('li', {text: '{{now()}} - Current date/time'});

  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}
