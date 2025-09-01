import {CachedMetadata, MarkdownView, TAbstractFile, TFile, WorkspaceLeaf} from "obsidian";
import {MetaFlowSettings} from "../settings/types";
import type {FileClassDeductionService} from "../services/FileClassDeductionService";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import {FileValidationService} from "../services/FileValidationService";
import {FileStateCache} from "./FileStateCache";
import {DebouncedCallbackManager} from "./DebouncedCallbackManager";
import {FileProcessor} from "./FileProcessor";
import {FileFilter} from "./FileFilter";
import {DelayedFileProcessor} from "./DelayedFileProcessor";
import {FileClassChangedCallback, FileClassChangeCallbackData} from "./FileClassChangeTypes";

/**
 * Detects when fileClass is manually changed by the user.
 * Orchestrates between specialized components to manage file state tracking.
 */
export class FileClassStateManager {
  private settings: MetaFlowSettings;
  private fileClassChangedCallback?: FileClassChangedCallback;

  // Specialized components
  private cache: FileStateCache;
  private callbackManager: DebouncedCallbackManager<FileClassChangeCallbackData>;
  private processor: FileProcessor;
  private filter: FileFilter;
  private delayedProcessor: DelayedFileProcessor;

  // State management
  private enabled: boolean = true;
  private renamingFiles: Set<string> = new Set(); // Track files being renamed by callback

  constructor(
    settings: MetaFlowSettings,
    obsidianAdapter: ObsidianAdapter,
    fileClassDeductionService: FileClassDeductionService,
    fileValidationService: FileValidationService,
    fileClassChangedCallback?: FileClassChangedCallback,
  ) {
    this.settings = settings;
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

    // Initialize the delayed file processor
    this.delayedProcessor = new DelayedFileProcessor(
      {
        cache: this.cache,
        processor: this.processor,
        filter: this.filter,
        callbackManager: this.callbackManager,
        settings: this.settings,
        isFileBeingProcessed: (filePath: string) => this.isFileBeingProcessed(filePath),
        isFileBeingRenamed: (filePath: string) => this.isFileBeingRenamed(filePath),
        stackTrace: () => this.stackTrace()
      },
      this.fileClassChangedCallback
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
      this.clear();
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
    return {stack: err.stack};
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

    if (this.settings.debugMode) console.debug('FileClassStateManager: handleActiveLeafChange', {stack: this.stackTrace().stack, leaf, file});
    this.delayedProcessor.scheduleProcessing(file);
  }

  public handleMetadataChanged(file: TFile, data: string, cache: CachedMetadata): void {
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleMetadataChanged', {stack: this.stackTrace().stack, file, data, cache});
    this.delayedProcessor.scheduleProcessing(file, cache);
  }

  public handleCreateFileEvent(file: TAbstractFile) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleCreateFileEvent', {stack: this.stackTrace().stack, file});

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

    this.delayedProcessor.scheduleProcessing(file);
  }

  public handleModifyFileEvent(file: TAbstractFile) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleModifyFileEvent', {stack: this.stackTrace().stack, file});
    this.delayedProcessor.scheduleProcessing(file);
  }

  public handleDeleteFileEvent(file: TAbstractFile) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleDeleteFileEvent', {stack: this.stackTrace().stack, file});
    this.cache.delete(file.path);
  }

  public handleRenameFileEvent(file: TAbstractFile, oldPath: string) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleRenameFileEvent', {stack: this.stackTrace().stack, file, oldPath});

    // Check if this rename was triggered by our callback
    if (this.isFileBeingRenamed(oldPath) || this.isFileBeingRenamed(file.path)) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: handleRenameFileEvent - Ignoring rename for ${oldPath} -> ${file.path} (triggered by callback)`);
      this.cache.delete(oldPath);
      return;
    }

    this.cache.delete(oldPath);
    this.delayedProcessor.scheduleProcessing(file);
  }

  /**
   * Cleanup method to call when the plugin is unloaded
   * Saves the cache immediately and clears the timer
   */
  public async clear(): Promise<void> {
    this.callbackManager.clear();
    await this.cache.clear();
    this.delayedProcessor.clear();
    this.renamingFiles.clear();
  }
}
