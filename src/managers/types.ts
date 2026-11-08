import {TFile, CachedMetadata} from "obsidian";

/**
 * Data structure for file class change callbacks
 */
export interface FileClassChangeCallbackData {
  file: TFile;
  cache: CachedMetadata | null;
  oldFileClass: string;
  newFileClass: string;
}

/**
 * Callback type for when file class changes are detected
 */
export type FileClassChangedCallback = (
  file: TFile,
  cache: CachedMetadata | null,
  oldFileClass: string,
  newFileClass: string
) => Promise<void>;

export type LogNoticeManagerLogLevel = 'info' | 'warning' | 'error' | 'debug' | 'ignore';
export type LogNoticeManagerInterface = {
  addDebug(message: string): void;
  addInfo(message: string): void;
  addWarning(message: string): void;
  addError(message: string): void;
  addMessage(message: string, logLevel: LogNoticeManagerLogLevel): void;
};
