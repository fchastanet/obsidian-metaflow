import {TFile, CachedMetadata} from "obsidian";
import {MetaFlowSettings} from "@metaflow/settings/types";
import {FileStateCache} from "./FileStateCache";
import {FileProcessor} from "./FileProcessor";
import {FileFilter} from "./FileFilter";
import {DebouncedCallbackManager} from "./DebouncedCallbackManager";
import {FileClassChangeCallbackData} from "./types";

export interface DelayedFileProcessorOptions {
  cache: FileStateCache;
  processor: FileProcessor;
  filter: FileFilter;
  callbackManager: DebouncedCallbackManager<FileClassChangeCallbackData>;
  settings: MetaFlowSettings;
  isFileBeingProcessed: (filePath: string) => boolean;
  isFileBeingRenamed: (filePath: string) => boolean;
  stackTrace: () => {stack: string | undefined};
}

/**
 * Handles delayed file processing with deduplication.
 * Ensures that multiple calls to processFile for the same file within 5 seconds
 * result in only one actual processing operation.
 */
export class DelayedFileProcessor {
  private delayTimers: Map<string, number> = new Map();
  private pendingFiles: Map<string, {file: TFile, cache?: CachedMetadata | null}> = new Map();
  private readonly DELAY_MS = 5000; // 5 seconds

  constructor(
    private options: DelayedFileProcessorOptions,
    private fileClassChangedCallback?: (file: TFile, cache: CachedMetadata | null, oldFileClass: string, newFileClass: string) => Promise<void>
  ) { }

  /**
   * Schedule a file for processing with delay and deduplication
   */
  scheduleProcessing(file: TFile, cache?: CachedMetadata | null): void {
    if (!this.options.filter.isApplicable(file)) return;

    // Store the latest file and cache data (this ensures we always use the LAST event)
    this.pendingFiles.set(file.path, {file, cache});

    // Clear any existing timer for this file
    if (this.delayTimers.has(file.path)) {
      window.clearTimeout(this.delayTimers.get(file.path)!);
    }

    // Set a new timer to execute the processing with the latest parameters
    const timer = window.setTimeout(async () => {
      await this.executeProcessing(file.path);
    }, this.DELAY_MS);

    this.delayTimers.set(file.path, timer);

    if (this.options.settings.debugMode) {
      console.debug(`DelayedFileProcessor: Scheduled processing for ${file.path} in ${this.DELAY_MS}ms`);
    }
  }

  /**
   * Execute the actual file processing for a specific file path
   */
  private async executeProcessing(filePath: string): Promise<void> {
    // Clean up timer
    this.delayTimers.delete(filePath);

    // Get the latest file and cache data
    const pendingData = this.pendingFiles.get(filePath);
    if (!pendingData) {
      this.pendingFiles.delete(filePath);
      return;
    }

    this.pendingFiles.delete(filePath);
    const {file, cache} = pendingData;

    // Perform the actual processing
    await this.processFile(file, cache);
  }

  /**
   * Process a file by computing its state and updating the cache
   * This is the core logic moved from FileClassStateManager
   */
  private async processFile(file: TFile, cache?: CachedMetadata | null): Promise<void> {
    if (!this.options.filter.isApplicable(file)) return;

    // Skip processing if the file is currently being processed by the callback
    if (this.options.isFileBeingProcessed(file.path)) {
      if (this.options.settings.debugMode) {
        console.debug(`DelayedFileProcessor: processFile - File ${file.path} is being processed by callback, skipping`, this.options.stackTrace());
      }
      return;
    }

    // Skip processing if the file is currently being renamed by our callback
    if (this.options.isFileBeingRenamed(file.path)) {
      if (this.options.settings.debugMode) {
        console.debug(`DelayedFileProcessor: processFile - File ${file.path} is being renamed by callback, skipping`, this.options.stackTrace());
      }
      return;
    }

    const oldFileState = this.options.cache.get(file.path);
    if (oldFileState?.mtime === file.stat.mtime) {
      if (this.options.settings.debugMode) {
        console.debug(`DelayedFileProcessor: processFile - modification time same as previous for ${file.path}`, this.options.stackTrace());
      }
      return;
    }

    const newFileState = this.options.processor.computeFileState(file, cache);
    this.options.cache.set(file.path, newFileState);

    if (this.options.settings.debugMode) {
      console.debug(`DelayedFileProcessor: processFile - Stored state for ${file.path}`, newFileState);
    }

    if (this.fileClassChangedCallback && oldFileState && oldFileState.checksum !== newFileState.checksum) {
      console.info(`DelayedFileProcessor: processFile - Detected change in fileClass for ${file.path}`, {
        stack: this.options.stackTrace().stack,
        oldFileState,
        newFileState
      });

      this.options.callbackManager.schedule(file.path, {
        file,
        cache: cache || null,
        oldFileClass: oldFileState.fileClass,
        newFileClass: newFileState.fileClass
      });
    }
  }

  /**
   * Check if a file is currently scheduled for processing
   */
  isScheduled(filePath: string): boolean {
    return this.delayTimers.has(filePath);
  }

  /**
   * Clear all pending processing operations
   */
  clear(): void {
    // Clear all timers
    for (const timer of this.delayTimers.values()) {
      window.clearTimeout(timer);
    }
    this.delayTimers.clear();
    this.pendingFiles.clear();

    if (this.options.settings.debugMode) {
      console.debug('DelayedFileProcessor: Cleared all pending processing operations');
    }
  }

  /**
   * Get the current number of pending processing operations
   */
  get pendingCount(): number {
    return this.delayTimers.size;
  }
}
