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
    contentEl.createEl('h3', {text: 'Script Completions Help'});
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
