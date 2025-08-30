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
