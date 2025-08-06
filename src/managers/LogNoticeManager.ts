import {ObsidianAdapter} from "src/externalApi/ObsidianAdapter";
import {LogManagerInterface, LogManagerLogLevel} from "./types";

export class LogNoticeManager implements LogManagerInterface {
  private obsidianAdapter: ObsidianAdapter;

  public constructor(obsidianAdapter: ObsidianAdapter) {
    this.obsidianAdapter = obsidianAdapter;
  }

  public addDebug(message: string): void {
    const notice = this.obsidianAdapter.notice('');
    notice.messageEl.innerHTML = `
      <div class="meta-flow-notice meta-flow-notice-title" title="debug level">
      <div class="meta-flow-notice-title">MetaFlow - DEBUG 🐞</div>
      <div class="meta-flow-notice-message">${message}</div>
      </div>
    `;
  }

  public addInfo(message: string): void {
    const notice = this.obsidianAdapter.notice('');
    notice.messageEl.innerHTML = `
      <div class="meta-flow-notice" title="info level">
      <div class="meta-flow-notice-title">MetaFlow - INFO ℹ️</div>
      <div class="meta-flow-notice-message">${message}</div>
      </div>
    `;
  }

  public addWarning(message: string): void {
    const notice = this.obsidianAdapter.notice('');
    notice.messageEl.innerHTML = `
      <div class="meta-flow-notice" title="warning level ">
      <div class="meta-flow-notice-title">MetaFlow - WARNING ⚠️</div>
      <div class="meta-flow-notice-message">${message}</div>
      </div>
    `;
  }

  public addError(message: string): void {
    const notice = this.obsidianAdapter.notice('');
    notice.messageEl.innerHTML = `
      <div class="meta-flow-notice" title="error level">
      <div class="meta-flow-notice-title">MetaFlow - ERROR ❌</div>
      <div class="meta-flow-notice-message">${message}</div>
      </div>
    `;
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
