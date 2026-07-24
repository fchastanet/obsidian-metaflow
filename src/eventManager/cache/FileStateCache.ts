import type {MetaFlowSettings} from '@metaflow/settings/types';
import CachePersistence from './FileCachePersistence';
import {FileState, InternalFileState} from './types';
import {TYPES} from '@metaflow/di/types';
import {inject} from 'inversify';

/**
 * File state cache with LRU eviction and persistence capabilities
 *
 * Manages cached file states with automatic eviction of least recently used
 * entries when the cache reaches capacity. Provides persistence to disk
 * for durability across plugin restarts.
 */
export class FileStateCache {
  private cache: Map<string, InternalFileState>;
  private isDirty: boolean = false;
  private saveTimer: number | null = null;

  constructor(
    @inject(TYPES.MetaFlowSettings) private settings: MetaFlowSettings,
    @inject(TYPES.FileCachePersistence) private cachePersistence: CachePersistence<InternalFileState>,
    private nowFn = Date.now,
  ) {
    this.cache = new Map<string, InternalFileState>();
  }

  public async loadCache(): Promise<void> {
    try {
      const cachedData = await this.cachePersistence.loadCache(this.settings.fileClassStateCacheFilename);
      this.cache = new Map<string, InternalFileState>(cachedData);
      if (this.settings.debugMode)  console.debug('FileClassStateManager: loadCache - loaded cache', this.cache);
    } catch (error) {
      console.error('FileClassStateManager: loadCache - failed to load cache - created a new cache', error);
      this.cache = new Map<string, InternalFileState>();
    }
  }

  /**
   * Get file state from cache
   */
  getState(filePath: string): InternalFileState | undefined {
    return this.cache.get(filePath);
  }

  /**
   * Set file state in cache
   */
  setState(filePath: string, state: FileState, isDirty: boolean = true): void {
    this.cache.set(filePath, {...state, lastUpdateTime: this.nowFn(), isDirty} as InternalFileState);
    if (isDirty) {
      this.markDirty();
    }
  }

  popState(filePath: string): InternalFileState | undefined {
    const state = this.cache.get(filePath);
    if (state) {
      this.cache.delete(filePath);
      this.markDirty();
    }
    return state;
  }

  renameState(oldPath: string, newPath: string): void {
    const state = this.cache.get(oldPath);
    if (state) {
      this.cache.delete(oldPath);
      this.cache.set(newPath, {...state, lastUpdateTime: this.nowFn(), isDirty: true} as InternalFileState);
      this.markDirty();
    }
  }

  updateState(filePath: string, state: Partial<FileState>): void {
    const currentState = this.cache.get(filePath);
    if (currentState) {
      const updatedState = {...currentState, ...state, lastUpdateTime: this.nowFn(), isDirty: true} as InternalFileState;
      this.cache.set(filePath, updatedState);
      this.markDirty();
    } else {
      this.setState(filePath, {...state} as FileState);
    }
  }

  getDirtyFilePaths(): string[] {
    const dirtyFiles: string[] = [];
    for (const [filePath, state] of this.cache.entries()) {
      if (state.isDirty) {
        dirtyFiles.push(filePath);
      }
    }
    return dirtyFiles;
  }

  evictStaleEntries(): void {
    const now = this.nowFn();
    for (const [filePath, state] of this.cache.entries()) {
      if (now - state.lastUpdateTime > this.settings.fileClassStateCacheEvictionThresholdMs) {
        this.cache.delete(filePath);
        this.markDirty();
      }
    }
  }

  /**
   * Mark cache as dirty and schedule persistence
   */
  private markDirty(): void {
    this.isDirty = true;
    this.schedulePersistedSave();
  }

  /**
   * Schedule a delayed save to avoid excessive disk writes
   */
  private schedulePersistedSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = window.setTimeout(() => {
      if (!this.isDirty) return;
      this.cachePersistence.
        saveCache(this.settings.fileClassStateCacheFilename, this.cache).
        then(() => {
          this.isDirty = false;
          this.saveTimer = null;
        }).catch(error => {
          console.error('Scheduled cache save failed:', error);
        });
    }, this.settings.fileClassStateCacheSaveIntervalMs);
  }

  /**
   * Cancel any scheduled save operation
   */
  private cancelScheduledSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /**
   * Cleanup resources when cache is destroyed
   */
  destroy(): void {
    this.cancelScheduledSave();
    this.cache.clear();
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.markDirty();
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.cache.size;
  }
}
