import {App, CachedMetadata, MarkdownView, TAbstractFile, TFile, WorkspaceLeaf} from "obsidian";
import {MetaFlowSettings} from "../settings/types";
import {LogManagerInterface} from "./types";
import type {FileClassDeductionService} from "../services/FileClassDeductionService";
import {Utils} from "../utils/Utils";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import {FileValidationService} from "../services/FileValidationService";

export type FileClassChangedCallback = (
  file: TFile, cache: CachedMetadata | null, oldFileClass: string, newFileClass: string
) => Promise<void>;

/**
 * Detects when fileClass is manually changed by the user.
 */
export class FileClassStateManager {
  private app: App;
  private settings: MetaFlowSettings;
  private obsidianAdapter: ObsidianAdapter;
  private logManager: LogManagerInterface;
  private fileClassDeductionService: FileClassDeductionService;
  private fileValidationService: FileValidationService;
  private fileClassChangedCallback?: FileClassChangedCallback;

  private fileMap: Map<string, {checksum: string, fileClass: string, mtime: number}>;
  private fileRenamedMap: Map<string, string>;
  private enabled: boolean;
  private isDirty: boolean = false;
  private saveTimer: number | null = null;
  private readonly SAVE_INTERVAL = 15000; // 15 seconds

  // Debouncing and concurrency control
  private callbackDebounceTimers: Map<string, number> = new Map();
  private pendingCallbacks: Map<string, {file: TFile, cache: CachedMetadata | null, oldFileClass: string, newFileClass: string}> = new Map();
  private processingFiles: Set<string> = new Set();
  private renamingFiles: Set<string> = new Set(); // Track files being renamed by callback
  private readonly CALLBACK_DEBOUNCE_DELAY = 1000; // 1 second

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
    this.obsidianAdapter = obsidianAdapter;
    this.fileValidationService = fileValidationService;
    this.fileClassDeductionService = fileClassDeductionService;
    this.fileClassChangedCallback = fileClassChangedCallback;

    this.fileRenamedMap = new Map<string, string>();
    this.enabled = true;

    // Load cache from disk
    this.loadFileMapCache();
  }

  /**
   * Load the file map cache from disk
  */
  private async loadFileMapCache(): Promise<void> {
    try {
      const cacheData = await this.obsidianAdapter.loadFromPluginDirectory('fileClassStateCache.json');
      if (cacheData && Array.isArray(cacheData)) {
        this.fileMap = new Map(cacheData);
        if (this.settings.debugMode) console.debug('FileClassStateManager: Loaded file map cache with', this.fileMap.size, 'entries');
      }
    } catch (error) {
      console.error('FileClassStateManager: Failed to load file map cache:', error);
    }
    if (typeof this.fileMap === 'undefined') {
      this.fileMap = new Map<string, {checksum: string, fileClass: string, mtime: number}>();
    }
  }

  /**
   * Save the file map cache to disk
   */
  private async saveFileMapCache(): Promise<void> {
    try {
      const cacheData = Array.from(this.fileMap.entries());
      await this.obsidianAdapter.saveToPluginDirectory('fileClassStateCache.json', cacheData);
      this.isDirty = false;
      if (this.settings.debugMode) console.debug('FileClassStateManager: Saved file map cache with', this.fileMap.size, 'entries');
    } catch (error) {
      console.error('FileClassStateManager: Failed to save file map cache:', error);
    }
  }

  /**
   * Schedule a save operation if the file map is dirty
   */
  private scheduleSave(): void {
    // Mark as dirty since we're calling this method (meaning there was a change)
    this.isDirty = true;

    // Only set timer if one isn't already running
    if (this.saveTimer === null) {
      this.saveTimer = window.setTimeout(() => {
        if (this.isDirty) {
          this.saveFileMapCache();
        }
        this.saveTimer = null;
      }, this.SAVE_INTERVAL);

      if (this.settings.debugMode) console.debug(`FileClassStateManager: Scheduled save in ${this.SAVE_INTERVAL}ms`);
    } else {
      if (this.settings.debugMode) console.debug('FileClassStateManager: Save already scheduled, keeping existing timer');
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // ensure all file states are cleared in case handle is called a little bit after mass update
      this.fileMap.clear();
      this.fileRenamedMap.clear();
      // Clear all pending callbacks and timers
      this.clearAllPendingCallbacks();
    }
  }

  /**
   * Clear all pending callbacks and timers
   */
  private clearAllPendingCallbacks(): void {
    // Clear all debounce timers
    for (const timer of this.callbackDebounceTimers.values()) {
      window.clearTimeout(timer);
    }
    this.callbackDebounceTimers.clear();
    this.pendingCallbacks.clear();
    this.processingFiles.clear();
    this.renamingFiles.clear();
  }

  /**
   * Check if a file is currently being processed by the callback
   */
  private isFileBeingProcessed(filePath: string): boolean {
    return this.processingFiles.has(filePath);
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

  /**
   * Debounced file class changed callback that takes the LAST event for each file
   */
  private debouncedFileClassChanged(
    file: TFile,
    cache: CachedMetadata | null,
    oldFileClass: string,
    newFileClass: string
  ): void {
    const filePath = file.path;

    // Store the latest callback parameters (this ensures we always use the LAST event)
    this.pendingCallbacks.set(filePath, {file, cache, oldFileClass, newFileClass});

    // Clear any existing timer for this file
    if (this.callbackDebounceTimers.has(filePath)) {
      window.clearTimeout(this.callbackDebounceTimers.get(filePath)!);
    }

    // Set a new timer to execute the callback with the latest parameters
    const timer = window.setTimeout(async () => {
      await this.executeFileClassChangedCallback(filePath);
    }, this.CALLBACK_DEBOUNCE_DELAY);

    this.callbackDebounceTimers.set(filePath, timer);
  }

  /**
   * Execute the file class changed callback for a specific file
   */
  private async executeFileClassChangedCallback(filePath: string): Promise<void> {
    // Clean up timer
    this.callbackDebounceTimers.delete(filePath);

    // Get the latest callback parameters
    const callbackData = this.pendingCallbacks.get(filePath);
    if (!callbackData || !this.fileClassChangedCallback) {
      this.pendingCallbacks.delete(filePath);
      return;
    }

    // Prevent concurrent execution for the same file
    if (this.isFileBeingProcessed(filePath)) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: Callback already processing for ${filePath}, skipping`);
      this.pendingCallbacks.delete(filePath);
      return;
    }

    // Mark file as being processed
    this.processingFiles.add(filePath);

    // Mark file as being processed by callback to prevent processing of all related events
    this.markFileAsBeingProcessedByCallback(filePath, 10000);

    try {
      console.info(`FileClassStateManager: Executing callback for ${filePath}`, {
        oldFileClass: callbackData.oldFileClass,
        newFileClass: callbackData.newFileClass
      });

      await this.fileClassChangedCallback(
        callbackData.file,
        callbackData.cache,
        callbackData.oldFileClass,
        callbackData.newFileClass
      );
    } catch (error) {
      console.error(`FileClassStateManager: Error in callback for ${filePath}:`, error);
    } finally {
      // Always clean up
      this.processingFiles.delete(filePath);
      this.pendingCallbacks.delete(filePath);
    }
  }

  private stackTrace() {
    var err = new Error();
    return err.stack;
  }

  private isFileApplicable(file: TAbstractFile | null | undefined): file is TFile {
    if (!this.enabled) return false;
    if (!file) return false;
    if (!(file instanceof TFile)) return false;
    if (!file?.basename || !file?.path) return false;
    if (file.saving) return false;
    // Check if the file is a Markdown file
    if (file.extension !== 'md') return false;
    if (this.fileValidationService.ifFileExcluded(file)) return false;

    // Check if the file has a valid frontmatter
    const cache = this.obsidianAdapter.getCachedFile(file);
    if (!cache || !cache.frontmatter) return false;

    return true;
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
    if (!this.isFileApplicable(file)) return;

    if (this.settings.debugMode) console.debug('FileClassStateManager: handleActiveLeafChange', this.stackTrace(), leaf, leaf.view.file);
    this.computeAndStoreFileChecksum(file);
  }

  private computeAndStoreFileChecksum(file: TFile, cache?: CachedMetadata | null): void {
    if (!this.isFileApplicable(file)) return;
    // Skip processing if the file is currently being processed by the callback
    if (this.isFileBeingProcessed(file.path)) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: computeAndStoreFileChecksum - File ${file.path} is being processed by callback, skipping`, this.stackTrace());
      return;
    }

    // Skip processing if the file is currently being renamed by our callback
    if (this.isFileBeingRenamed(file.path)) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: computeAndStoreFileChecksum - File ${file.path} is being renamed by callback, skipping`, this.stackTrace());
      return;
    }

    const oldFileState = this.fileMap.get(file.path);
    if (oldFileState?.mtime === file.stat.mtime) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: computeAndStoreFileChecksum - modification time same as previous for ${file.path}`, this.stackTrace());
      return;
    }
    if (!cache) {
      cache = this.obsidianAdapter.getCachedFile(file);
    }
    const checksum = this.computeChecksumFromTitleAndFrontmatter(file, cache);
    const fileClass = this.fileClassDeductionService.getFileClassFromMetadata(cache?.frontmatter) || '';
    const mtime = file.stat.mtime;
    this.fileMap.set(file.path, {checksum, fileClass, mtime});

    // Schedule save since fileMap was updated
    this.scheduleSave();

    if (this.settings.debugMode) console.debug(`FileClassStateManager: computeAndStoreFileChecksum - Stored state for ${file.path}`, {checksum, fileClass, mtime});
    if (this.fileClassChangedCallback && oldFileState && oldFileState.checksum !== checksum) {
      console.info(`FileClassStateManager: computeAndStoreFileChecksum - Detected change in fileClass for ${file.path}`, this.stackTrace(), {oldFileState, newState: {checksum, fileClass}});
      this.debouncedFileClassChanged(file, cache, oldFileState.fileClass, fileClass);
    }
  }

  private computeChecksumFromTitleAndFrontmatter(file: TFile, cache: CachedMetadata | null): string {
    const frontmatter = cache?.frontmatter || {};
    const title = file.basename;
    return Utils.sha256(`${title}\n${JSON.stringify(frontmatter)}`);
  }

  public handleMetadataChanged(file: TFile, data: string, cache: CachedMetadata): void {
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleMetadataChanged', this.stackTrace(), {file, data, cache});
    this.computeAndStoreFileChecksum(file, cache);
  }

  public handleCreateFileEvent(file: TAbstractFile) {
    if (!this.isFileApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleCreateFileEvent', this.stackTrace(), file);

    // Check if this might be related to files we're currently processing
    const basename = file.basename;
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

    this.computeAndStoreFileChecksum(file);
  }

  public handleModifyFileEvent(file: TAbstractFile) {
    if (!this.isFileApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleModifyFileEvent', this.stackTrace(), file);
    this.computeAndStoreFileChecksum(file);
  }

  public handleDeleteFileEvent(file: TAbstractFile) {
    if (!this.isFileApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleDeleteFileEvent', this.stackTrace(), file);
    this.fileMap.delete(file.path);

    // Schedule save since fileMap was updated
    this.scheduleSave();
  }

  public handleRenameFileEvent(file: TAbstractFile, oldPath: string) {
    if (!this.isFileApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleRenameFileEvent', this.stackTrace(), file, oldPath);

    // Check if this rename was triggered by our callback
    if (this.isFileBeingRenamed(oldPath) || this.isFileBeingRenamed(file.path)) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: handleRenameFileEvent - Ignoring rename for ${oldPath} -> ${file.path} (triggered by callback)`);
      this.fileMap.delete(oldPath);
      this.scheduleSave();
      return;
    }

    this.fileMap.delete(oldPath);

    // Schedule save since fileMap was updated (computeAndStoreFileChecksum will also call scheduleSave)
    this.scheduleSave();

    this.computeAndStoreFileChecksum(file);
  }

  /**
   * Cleanup method to call when the plugin is unloaded
   * Saves the cache immediately and clears the timer
   */
  public async cleanup(): Promise<void> {
    // Clear all pending callbacks and timers
    this.clearAllPendingCallbacks();

    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    if (this.isDirty) {
      await this.saveFileMapCache();
    }
  }
}
