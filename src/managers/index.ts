export type {LogNoticeManager} from './LogNoticeManager';

export type LogNoticeManagerLogLevel = 'info' | 'warning' | 'error' | 'debug' | 'ignore';
export type LogNoticeManagerInterface = {
  addDebug(message: string): void;
  addInfo(message: string): void;
  addWarning(message: string): void;
  addError(message: string): void;
  addMessage(message: string, logLevel: LogNoticeManagerLogLevel): void;
};
