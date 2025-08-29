import {TAbstractFile, TFile} from "obsidian";

/**
 * FileDebouncer - Manages per-file debouncing to prevent race conditions when multiple files change rapidly
 */
export class FileDebouncer {
  private fileDebounceTimers: Map<string, number> = new Map();
  private debounceWait: number;

  constructor(debounceWait: number = 500) {
    this.debounceWait = debounceWait;
  }

  deleteFile(file: TAbstractFile) {
    if (file instanceof TFile) {
      this.fileDebounceTimers.delete(file.path);
    }
  }

  /**
   * Creates a per-file debounced handler
   * @param handler The function to execute after debounce
   * @param getFileKey Function to extract the file key from the handler arguments
   * @returns A debounced version of the handler
   */
  createFileDebouncer<T extends any[]>(
    handler: (...args: T) => void,
    getFileKey: (...args: T) => string | null
  ) {
    return (...args: T) => {
      const fileKey = getFileKey(...args);
      if (!fileKey) return;

      // Clear existing timer for this file
      if (this.fileDebounceTimers.has(fileKey)) {
        window.clearTimeout(this.fileDebounceTimers.get(fileKey));
      }

      // Set new debounce timer for this file
      const timerId = window.setTimeout(() => {
        handler(...args);
        this.fileDebounceTimers.delete(fileKey);
      }, this.debounceWait);

      this.fileDebounceTimers.set(fileKey, timerId);
    };
  }

  /**
   * Clears all pending debounce timers
   */
  cleanup() {
    this.fileDebounceTimers.forEach(timerId => window.clearTimeout(timerId));
    this.fileDebounceTimers.clear();
  }

  /**
   * Clears debounce timer for a specific file
   * @param fileKey The file key to clear
   */
  clearForFile(fileKey: string) {
    if (this.fileDebounceTimers.has(fileKey)) {
      window.clearTimeout(this.fileDebounceTimers.get(fileKey));
      this.fileDebounceTimers.delete(fileKey);
    }
  }

  /**
   * Gets the number of pending debounce timers
   */
  getPendingCount(): number {
    return this.fileDebounceTimers.size;
  }
}
