import {injectable, inject} from "inversify";
import {ObsidianAdapter} from "@metaflow/externalApi/ObsidianAdapter";
import {LogNoticeManagerInterface, LogNoticeManagerLogLevel} from "./types";
import {TYPES} from "@metaflow/di/types";
import {Utils} from "@metaflow/utils/Utils";

const NOTICE_LEVELS_TITLE = {
  debug: 'DEBUG 🐞',
  info: 'INFO ℹ️',
  warning: 'WARNING ⚠️',
  error: 'ERROR ❌',
  ignore: 'IGNORE ❌'
};

// average is 200 words per minute
// but I adjusted to take into account the time to realize the notice is displayed
const AVERAGE_READING_TIME_WORDS_PER_MS = 100 / 60000; // 100 words per minute
const MIN_NOTICE_DURATION_MS = 3000; // 3 seconds
const MAX_NOTICE_DURATION_MS = 10000; // 10 seconds
const SAME_NOTICE_DUPLICATE_TIMEOUT_MS = Math.max(20000, MIN_NOTICE_DURATION_MS); // 20 seconds

@injectable()
export class LogNoticeManager implements LogNoticeManagerInterface {
  private obsidianAdapter: ObsidianAdapter;
  private noticeChecksums: Set<string> = new Set();

  public constructor(@inject(TYPES.ObsidianAdapter) obsidianAdapter: ObsidianAdapter) {
    this.obsidianAdapter = obsidianAdapter;
  }

  private addNoticeChecksum(checksum: string): void {
    this.noticeChecksums.add(checksum);
    window.setTimeout(() => {
      this.noticeChecksums.delete(checksum);
    }, SAME_NOTICE_DUPLICATE_TIMEOUT_MS);
  }

  private countWordsSimple(text: string): number {
    // \b\w+\b matches sequences of [A-Za-z0-9_] surrounded by word boundaries
    return (text.match(/\b\w+\b/g) || []).length;
  }

  private computeDurationFromMessage(message: string): number {
    const wordCount = this.countWordsSimple(message);
    const estimatedReadingTimeMs = Math.ceil(wordCount / AVERAGE_READING_TIME_WORDS_PER_MS);
    // between 3s and 10s
    return Math.min(Math.max(estimatedReadingTimeMs, MIN_NOTICE_DURATION_MS), MAX_NOTICE_DURATION_MS);
  }

  private getMessageChecksum(message: string, logLevel: LogNoticeManagerLogLevel): string {
    return Utils.md5(`${logLevel}:${message}`);
  }

  public addMessage(message: string, logLevel: LogNoticeManagerLogLevel): void {
    if (logLevel === 'ignore') {
      return; // Do not display notices for 'ignore' level
    }
    const messageChecksum = this.getMessageChecksum(message, logLevel);
    if (this.noticeChecksums.has(messageChecksum)) {
      return; // Avoid duplicate notices
    }
    this.addNoticeChecksum(messageChecksum);
    const notice = this.obsidianAdapter.notice('', this.computeDurationFromMessage(message));
    notice.messageEl.createDiv({cls: 'meta-flow-notice', title: `${logLevel} level`})
      .createDiv({cls: 'meta-flow-notice-title', text: `MetaFlow - ${NOTICE_LEVELS_TITLE[logLevel]}`})
      .createDiv({cls: 'meta-flow-notice-message', text: message});
  }

  public addDebug(message: string): void {
    this.addMessage(message, 'debug');
  }

  public addInfo(message: string): void {
    this.addMessage(message, 'info');
  }

  public addWarning(message: string): void {
    this.addMessage(message, 'warning');
  }

  public addError(message: string): void {
    this.addMessage(message, 'error');
  }


}
