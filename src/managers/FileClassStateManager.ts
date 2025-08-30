import {App, CachedMetadata, MarkdownView, TAbstractFile, TFile, WorkspaceLeaf} from "obsidian";
import {MetaFlowSettings} from "../settings/types";
import {LogManagerInterface} from "./types";
import type {FileClassDeductionService} from "../services/FileClassDeductionService";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import {FileValidationService} from "../services/FileValidationService";
import {FileStateCache} from "./FileStateCache";
import {DebouncedCallbackManager} from "./DebouncedCallbackManager";
import {FileProcessor} from "./FileProcessor";
import {FileFilter} from "./FileFilter";
import {FileClassChangedCallback, FileClassChangeCallbackData} from "./FileClassChangeTypes";

/**
 * Detects when fileClass is manually changed by the user.
 * Orchestrates between specialized components to manage file state tracking.
 */
export class FileClassStateManager {
  private app: App;
  private settings: MetaFlowSettings;
  private logManager: LogManagerInterface;
  private fileClassChangedCallback?: FileClassChangedCallback;

  // Specialized components
  private cache: FileStateCache;
  private callbackManager: DebouncedCallbackManager<FileClassChangeCallbackData>;
  private processor: FileProcessor;
  private filter: FileFilter;

  // State management
  private enabled: boolean = true;
  private renamingFiles: Set<string> = new Set(); // Track files being renamed by callback

  constructor(
    app: App,
    settings: MetaFlowSettings,
    logManager: LogManagerInterface,
    obsidianAdapter: ObsidianAdapter,
    fileClassDeductionService: FileClassDeductionService,
    fileValidationService: FileValidationService,
    fileClassChangedCallback?: FileClassChangedCallback,
  ) {
    this.app = app;
    this.settings = settings;
    this.logManager = logManager;
    this.fileClassChangedCallback = fileClassChangedCallback;

    // Initialize specialized components
    this.cache = new FileStateCache(obsidianAdapter, settings);
    this.processor = new FileProcessor(fileClassDeductionService, obsidianAdapter, settings);
    this.filter = new FileFilter(fileValidationService, obsidianAdapter);

    this.callbackManager = new DebouncedCallbackManager(
      async (filePath: string, data: FileClassChangeCallbackData) => {
        await this.executeCallback(filePath, data);
      },
      settings
    );

    // Load cache from disk
    this.cache.load();
  }

  /**
   * Execute the callback for a file class change
   */
  private async executeCallback(filePath: string, data: FileClassChangeCallbackData): Promise<void> {
    if (!this.fileClassChangedCallback) return;

    // Mark file as being processed by callback to prevent processing of all related events
    this.markFileAsBeingProcessedByCallback(filePath, 10000);

    try {
      console.info(`FileClassStateManager: Executing callback for ${filePath}`, {
        oldFileClass: data.oldFileClass,
        newFileClass: data.newFileClass
      });

      await this.fileClassChangedCallback(
        data.file,
        data.cache,
        data.oldFileClass,
        data.newFileClass
      );
    } catch (error) {
      console.error(`FileClassStateManager: Error in callback for ${filePath}:`, error);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // ensure all file states are cleared in case handle is called a little bit after mass update
      this.cache.clear();
      // Clear all pending callbacks and timers
      this.callbackManager.clear();
      this.renamingFiles.clear();
    }
  }

  /**
   * Check if a file is currently being processed by the callback
   */
  private isFileBeingProcessed(filePath: string): boolean {
    return this.callbackManager.isProcessing(filePath);
  }

  /**
   * Check if a file is currently being renamed by our callback
   */
  private isFileBeingRenamed(filePath: string): boolean {
    return this.renamingFiles.has(filePath);
  }

  /**
   * Mark file as being completely processed by callback (including moves, renames, etc.)
   */
  private markFileAsBeingProcessedByCallback(filePath: string, cleanupTimeoutMs: number = 10000): void {
    this.renamingFiles.add(filePath);

    // Auto-cleanup after timeout to prevent permanent blocking
    window.setTimeout(() => {
      this.renamingFiles.delete(filePath);
      if (this.settings.debugMode) console.debug(`FileClassStateManager: Auto-cleanup - stopped tracking callback processing for ${filePath}`);
    }, cleanupTimeoutMs);
  }

  private stackTrace() {
    var err = new Error();
    return err.stack;
  }

  /**
   * Handle changes to the active workspace leaf.
   * Allows to compute the file class when active leaf changes.
   * This event can be generated for multiple type of element
   * check if at least leaf.view.file is defined
   * @param leaf The active workspace leaf.
   */
  public handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
    if (!(leaf?.view instanceof MarkdownView)) return;
    const file = leaf.view.file;
    if (!this.filter.isApplicable(file)) return;

    if (this.settings.debugMode) console.debug('FileClassStateManager: handleActiveLeafChange', this.stackTrace(), leaf, leaf.view.file);
    this.processFile(file);
  }

  /**
   * Process a file by computing its state and updating the cache
   */
  private processFile(file: TFile, cache?: CachedMetadata | null): void {
    if (!this.filter.isApplicable(file)) return;

    // Skip processing if the file is currently being processed by the callback
    if (this.isFileBeingProcessed(file.path)) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: processFile - File ${file.path} is being processed by callback, skipping`, this.stackTrace());
      return;
    }

    // Skip processing if the file is currently being renamed by our callback
    if (this.isFileBeingRenamed(file.path)) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: processFile - File ${file.path} is being renamed by callback, skipping`, this.stackTrace());
      return;
    }

    const oldFileState = this.cache.get(file.path);
    if (oldFileState?.mtime === file.stat.mtime) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: processFile - modification time same as previous for ${file.path}`, this.stackTrace());
      return;
    }

    const newFileState = this.processor.computeFileState(file, cache);
    this.cache.set(file.path, newFileState);

    if (this.settings.debugMode) console.debug(`FileClassStateManager: processFile - Stored state for ${file.path}`, newFileState);

    if (this.fileClassChangedCallback && oldFileState && oldFileState.checksum !== newFileState.checksum) {
      console.info(`FileClassStateManager: processFile - Detected change in fileClass for ${file.path}`, this.stackTrace(), {oldFileState, newFileState});

      this.callbackManager.schedule(file.path, {
        file,
        cache: cache || null,
        oldFileClass: oldFileState.fileClass,
        newFileClass: newFileState.fileClass
      });
    }
  }

  public handleMetadataChanged(file: TFile, data: string, cache: CachedMetadata): void {
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleMetadataChanged', this.stackTrace(), {file, data, cache});
    this.processFile(file, cache);
  }

  public handleCreateFileEvent(file: TAbstractFile) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleCreateFileEvent', this.stackTrace(), file);

    // Check if this might be related to files we're currently processing
    const basename = file.name.replace('.md', '');
    const isRelatedToProcessedFile = Array.from(this.renamingFiles).some(path => {
      const processedBasename = path.split('/').pop()?.replace('.md', '') || '';
      return basename.includes(processedBasename.split(' - ')[0]) ||
        processedBasename.includes(basename.split(' - ')[0]);
    });

    if (isRelatedToProcessedFile) {
      console.warn(`FileClassStateManager: Suspicious file creation ${file.path} - might be related to ongoing callback processing`);
      // Don't process this file immediately - it might be created by our callback
      return;
    }

    this.processFile(file);
  }

  public handleModifyFileEvent(file: TAbstractFile) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleModifyFileEvent', this.stackTrace(), file);
    this.processFile(file);
  }

  public handleDeleteFileEvent(file: TAbstractFile) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleDeleteFileEvent', this.stackTrace(), file);
    this.cache.delete(file.path);
  }

  public handleRenameFileEvent(file: TAbstractFile, oldPath: string) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleRenameFileEvent', this.stackTrace(), file, oldPath);

    // Check if this rename was triggered by our callback
    if (this.isFileBeingRenamed(oldPath) || this.isFileBeingRenamed(file.path)) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: handleRenameFileEvent - Ignoring rename for ${oldPath} -> ${file.path} (triggered by callback)`);
      this.cache.delete(oldPath);
      return;
    }

    this.cache.delete(oldPath);
    this.processFile(file);
  }

  /**
   * Cleanup method to call when the plugin is unloaded
   * Saves the cache immediately and clears the timer
   */
  public async cleanup(): Promise<void> {
    // Clear all pending callbacks and timers
    this.callbackManager.clear();
    await this.cache.cleanup();
  }
}
