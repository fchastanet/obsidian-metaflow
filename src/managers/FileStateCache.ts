import {MetaFlowSettings} from "../settings/types";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";

export interface FileState {
  checksum: string;
  fileClass: string;
  mtime: number;
}

/**
 * Manages persistent caching of file states to disk
 */
export class FileStateCache {
  private fileMap: Map<string, FileState> = new Map();
  private isDirty: boolean = false;
  private saveTimer: number | null = null;
  private readonly SAVE_INTERVAL = 15000; // 15 seconds

  constructor(
    private obsidianAdapter: ObsidianAdapter,
    private settings: MetaFlowSettings
  ) { }

  /**
   * Load the file map cache from disk
   */
  async load(): Promise<void> {
    try {
      const cacheData = await this.obsidianAdapter.loadFromPluginDirectory('fileClassStateCache.json');
      if (cacheData && Array.isArray(cacheData)) {
        this.fileMap = new Map(cacheData);
        if (this.settings.debugMode) {
          console.debug('FileStateCache: Loaded file map cache with', this.fileMap.size, 'entries');
        }
      }
    } catch (error) {
      console.error('FileStateCache: Failed to load file map cache:', error);
    }

    if (typeof this.fileMap === 'undefined') {
      this.fileMap = new Map<string, FileState>();
    }
  }

  /**
   * Save the file map cache to disk
   */
  private async save(): Promise<void> {
    try {
      const cacheData = Array.from(this.fileMap.entries());
      await this.obsidianAdapter.saveToPluginDirectory('fileClassStateCache.json', cacheData);
      this.isDirty = false;
      if (this.settings.debugMode) {
        console.debug('FileStateCache: Saved file map cache with', this.fileMap.size, 'entries');
      }
    } catch (error) {
      console.error('FileStateCache: Failed to save file map cache:', error);
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
          this.save();
        }
        this.saveTimer = null;
      }, this.SAVE_INTERVAL);

      if (this.settings.debugMode) {
        console.debug(`FileStateCache: Scheduled save in ${this.SAVE_INTERVAL}ms`);
      }
    } else {
      if (this.settings.debugMode) {
        console.debug('FileStateCache: Save already scheduled, keeping existing timer');
      }
    }
  }

  /**
   * Get file state for a given path
   */
  get(filePath: string): FileState | undefined {
    return this.fileMap.get(filePath);
  }

  /**
   * Set file state for a given path
   */
  set(filePath: string, state: FileState): void {
    this.fileMap.set(filePath, state);
    this.scheduleSave();
  }

  /**
   * Delete file state for a given path
   */
  delete(filePath: string): void {
    this.fileMap.delete(filePath);
    this.scheduleSave();
  }

  /**
   * Clear all file states
   */
  clear(): void {
    this.fileMap.clear();
    this.scheduleSave();
  }

  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.fileMap.size;
  }

  /**
   * Cleanup method to call when the cache is no longer needed
   * Saves the cache immediately and clears the timer
   */
  async cleanup(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    if (this.isDirty) {
      await this.save();
    }
  }
}
