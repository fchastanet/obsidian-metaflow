import {App, Modal, ProgressBarComponent, Setting} from "obsidian";
import {LogManagerInterface, LogManagerLogLevel} from "../managers/types";

export class ProgressModal extends Modal implements LogManagerInterface {
  cancelCallback: Function;
  actionCallback: Function;
  progressBar: ProgressBarComponent;
  progressText: HTMLElement;
  currentItem: HTMLElement;
  numberErrorsText: HTMLElement;
  results: HTMLElement;
  cancelButton: HTMLButtonElement;
  actionButton: HTMLButtonElement;
  current: number;
  total: number;
  errorCount: number;
  processFinished: boolean;

  constructor(
    app: App,
    total: number,
    title: string,
    message: string,
    cancelCallback: () => void,
    actionCallback: () => void,
  ) {
    super(app);
    this.current = 0;
    this.errorCount = 0;
    this.total = total;
    super.setTitle(title);
    this.shouldRestoreSelection = true;
    this.processFinished = false;
    this.cancelCallback = cancelCallback;
    this.actionCallback = actionCallback;

    this.contentEl.createEl('p', {text: message});

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

    const modalButtonContainer = this.contentEl.createEl('div', {cls: 'modal-button-container'});

    // Confirm action button
    this.actionButton = modalButtonContainer.createEl('button', {text: 'Confirm'});
    this.actionButton.classList.add('mod-cta');
    this.actionButton.onclick = () => {
      this.actionButton.disabled = true;
      this.actionCallback();
    };

    // Cancel button
    this.cancelButton = modalButtonContainer.createEl('button', {text: 'Cancel'});
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

  private addResultItem(text: string, className: string) {
    this.results.createEl('li', {text, cls: className});
    this.results.scrollTop = this.results.scrollHeight;
  }

  addError(error: string) {
    this.errorCount++;
    this.numberErrorsText.setText(`${this.errorCount} errors`);
    this.addResultItem(error, 'progress-modal-error-item');
  }

  addInfo(info: string) {
    this.addResultItem(info, 'progress-modal-info-item');
  }

  addDebug(message: string): void {
    this.addResultItem(`[DEBUG] ${message}`, 'progress-modal-debug-item');
  }

  addWarning(message: string): void {
    this.addResultItem(`[WARNING] ${message}`, 'progress-modal-warning-item');
  }

  addMessage(message: string, logLevel: LogManagerLogLevel): void {
    switch (logLevel) {
      case "debug":
        this.addDebug(message);
        break;
      case "info":
        this.addInfo(message);
        break;
      case "warning":
        this.addWarning(message);
        break;
      case "error":
        this.addError(message);
        break;
      default:
        this.addInfo(message);
    }
  }

  finish() {
    this.processFinished = true;
    this.cancelButton.textContent = "Close";
    this.actionButton.disabled = true;
    this.displayCurrentItem("");
  }

}
