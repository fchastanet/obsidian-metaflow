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
    progressBlock.style.display = 'flex';
    progressBlock.style.alignItems = 'center';
    progressBlock.style.columnGap = '10px';
    this.progressBar = new ProgressBarComponent(progressBlock);
    this.progressBar.setValue(0);
    const progressBar: HTMLElement = progressBlock.getElementsByClassName('setting-progress-bar')[0] as HTMLElement;
    progressBar.style.flexGrow = '1';

    this.progressText = progressBlock.createEl('span', {text: ''});

    this.currentItem = this.contentEl.createEl('span', {text: ''});
    this.currentItem.style.marginLeft = '10px';
    this.numberErrorsText = this.contentEl.createEl('span', {text: ''});
    this.numberErrorsText.style.marginLeft = '10px';
    this.numberErrorsText.style.color = 'red';

    this.results = this.contentEl.createEl('ul');
    this.results.style.height = "300px";
    this.results.style.overflowY = "auto";
    this.results.style.overflowX = "hidden";
    this.results.style.width = '100%';
    this.results.style.backgroundColor = '#fff';
    this.results.style.scrollbarWidth = 'thin';

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
    const errorItem = this.results.createEl('li', {text: error});
    errorItem.style.color = 'red';
    this.results.scrollTop = this.results.scrollHeight;
  }

  addInfo(info: string) {
    const infoItem = this.results.createEl('li', {text: info});
    infoItem.style.color = 'blue';
    this.results.scrollTop = this.results.scrollHeight;
  }

  finish() {
    this.processFinished = true;
    this.cancelButton.textContent = "Close";
    this.displayCurrentItem("");
  }

}
