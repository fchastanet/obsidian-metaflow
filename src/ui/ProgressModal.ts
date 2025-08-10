import {App, Modal, ProgressBarComponent, Setting} from "obsidian";

export class ProgressModal extends Modal {
  cancelCallback: Function;
  progressBar: ProgressBarComponent;
  progressText: HTMLElement;
  currentItem: HTMLElement;
  numberErrorsText: HTMLElement;
  results: HTMLElement;
  cancelButton: HTMLButtonElement;
  current: number;
  total: number;
  errorCount: number;
  processFinished: boolean;

  constructor(
    app: App,
    total: number,
    title: string,
    cancelCallback: () => void,
  ) {
    super(app);
    this.current = 0;
    this.errorCount = 0;
    this.total = total;
    super.setTitle(title);
    this.shouldRestoreSelection = true;
    this.processFinished = false;
    this.cancelCallback = cancelCallback;


    const progressBlock = this.contentEl.createEl('div');
    progressBlock.classList.add('progress-modal-progress-block');
    this.progressBar = new ProgressBarComponent(progressBlock);
    this.progressBar.setValue(0);
    const progressBar: HTMLElement = progressBlock.getElementsByClassName('setting-progress-bar')[0] as HTMLElement;
    progressBar.classList.add('progress-modal-progress-bar');

    this.progressText = progressBlock.createEl('span', {text: ''});

    this.currentItem = this.contentEl.createEl('span', {text: ''});
    this.currentItem.classList.add('progress-modal-current-item');
    this.numberErrorsText = this.contentEl.createEl('span', {text: ''});
    this.numberErrorsText.classList.add('progress-modal-number-errors');

    this.results = this.contentEl.createEl('ul');
    this.results.classList.add('progress-modal-results');

    this.cancelButton = this.contentEl.createEl('button', {text: 'Cancel'});
    this.cancelButton.classList.add('mod-cta');
    this.cancelButton.onclick = () => {
      super.close();
    };
  }

  open() {
    super.open();
  }

  onClose(): void {
    if (!this.processFinished) {
      this.cancelCallback();
    }
    super.onClose();
  }


  setCurrentItem(item: string) {
    this.current++;
    this.displayCurrentItem(item);
  }

  private displayCurrentItem(item: string) {
    const percent = (this.current / this.total) * 100;
    this.currentItem.setText(item);
    this.progressBar.setValue(percent);
    this.progressText.setText(`${percent.toFixed(0)}%`);
  }

  addError(error: string) {
    this.errorCount++;
    this.numberErrorsText.setText(`${this.errorCount} errors`);
    const errorItem = this.results.createEl('li', {text: error, cls: 'progress-modal-error-item'});
    this.results.scrollTop = this.results.scrollHeight;
  }

  addInfo(info: string) {
    const infoItem = this.results.createEl('li', {text: info, cls: 'progress-modal-info-item'});
    this.results.scrollTop = this.results.scrollHeight;
  }

  finish() {
    this.processFinished = true;
    this.cancelButton.textContent = "Close";
    this.displayCurrentItem("");
  }

}
