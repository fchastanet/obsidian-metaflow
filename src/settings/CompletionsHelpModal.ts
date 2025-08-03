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
      item.style.marginBottom = '12px';
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      const value = item.createEl('code', {text: c.value});
      value.style.fontSize = '13px';
      value.style.background = 'var(--background-secondary)';
      value.style.padding = '2px 6px';
      value.style.borderRadius = '3px';
      value.style.marginBottom = '2px';
      const doc = item.createEl('span', {text: c.docHTML || c.meta || ''});
      doc.style.fontSize = '12px';
      doc.style.color = 'var(--text-muted)';
    });
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}
