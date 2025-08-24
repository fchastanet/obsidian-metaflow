import {App, Modal} from 'obsidian';
import * as Ace from 'ace-builds';

export class CompletionsHelpModal extends Modal {
  completions: Ace.Ace.Completion[];

  constructor(app: App, completions: Ace.Ace.Completion[]) {
    super(app);
    this.completions = completions;
  }

  onOpen() {
    const {contentEl} = this;
    contentEl.empty();
    contentEl.createEl('h3', {text: 'Script help & available fields'});
    // Add basic help
    contentEl.createEl('h4', {text: 'Basic usage'});
    const basicList = contentEl.createEl('ul');
    basicList.createEl('li', {text: 'Scripts must return a value'});
    basicList.createEl('li', {text: 'Use JavaScript syntax'});
    basicList.createEl('li', {text: 'Access file properties with file.property'});
    basicList.createEl('li', {text: 'Access metadata with metadata.property'});

    // Add examples
    contentEl.createEl('h4', {text: 'Examples'});
    const examplesList = contentEl.createEl('ul');
    examplesList.createEl('li', {text: 'return new Date().toISOString().split("T")[0]; // Today\'s date'});
    examplesList.createEl('li', {text: 'return file.basename; // File name without extension'});
    examplesList.createEl('li', {text: 'return metadata.author || "Unknown"; // Fallback value'});

    contentEl.createEl('h4', {text: 'Completions help'});
    this.completions.forEach(c => {
      const item = contentEl.createDiv();
      item.classList.add('completions-help-item');
      const value = item.createEl('code', {text: c.value});
      value.classList.add('completions-help-value');
      const doc = item.createEl('span', {text: c.docHTML || c.meta || ''});
      doc.classList.add('completions-help-doc');
    });
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}
