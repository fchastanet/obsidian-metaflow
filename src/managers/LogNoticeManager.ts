import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import {LogManagerInterface, LogManagerLogLevel} from "./types";

export class LogNoticeManager implements LogManagerInterface {
  private obsidianAdapter: ObsidianAdapter;

  public constructor(obsidianAdapter: ObsidianAdapter) {
    this.obsidianAdapter = obsidianAdapter;
  }

  public addDebug(message: string): void {
    const notice = this.obsidianAdapter.notice('');
    notice.messageEl.createDiv({cls: 'meta-flow-notice', title: 'debug level'})
      .createDiv({cls: 'meta-flow-notice-title', text: 'MetaFlow - DEBUG 🐞'})
      .createDiv({cls: 'meta-flow-notice-message', text: message});
  }

  public addInfo(message: string): void {
    const notice = this.obsidianAdapter.notice('');
    notice.messageEl.createDiv({cls: 'meta-flow-notice', title: 'info level'})
      .createDiv({cls: 'meta-flow-notice-title', text: 'MetaFlow - INFO ℹ️'})
      .createDiv({cls: 'meta-flow-notice-message', text: message});
  }

  public addWarning(message: string): void {
    const notice = this.obsidianAdapter.notice('');
    notice.messageEl.createDiv({cls: 'meta-flow-notice', title: 'warning level'})
      .createDiv({cls: 'meta-flow-notice-title', text: 'MetaFlow - WARNING ⚠️'})
      .createDiv({cls: 'meta-flow-notice-message', text: message});
  }

  public addError(message: string): void {
    const notice = this.obsidianAdapter.notice('');
    notice.messageEl.createDiv({cls: 'meta-flow-notice', title: 'error level'})
      .createDiv({cls: 'meta-flow-notice-title', text: 'MetaFlow - ERROR ❌'})
      .createDiv({cls: 'meta-flow-notice-message', text: message});
  }

  public addMessage(message: string, logLevel: LogManagerLogLevel): void {
    switch (logLevel) {
      case 'info':
        return this.addInfo(message);
      case "warning":
        return this.addWarning(message);
      case "error":
        return this.addError(message);
      case "ignore":
      default:
    }
  }
}
