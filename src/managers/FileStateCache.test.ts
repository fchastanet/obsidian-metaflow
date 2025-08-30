import {FileStateCache, FileState} from './FileStateCache';
import {MetaFlowSettings} from '../settings/types';
import {ObsidianAdapter} from '../externalApi/ObsidianAdapter';

// Mock timers
jest.useFakeTimers();

describe('FileStateCache', () => {
  let cache: FileStateCache;
  let mockObsidianAdapter: jest.Mocked<ObsidianAdapter>;
  let mockSettings: MetaFlowSettings;
  let mockSetTimeout: jest.SpyInstance;
  let mockClearTimeout: jest.SpyInstance;

  beforeEach(() => {
    // Mock console methods
    jest.spyOn(console, 'debug').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });

    // Mock window.setTimeout and window.clearTimeout to prevent actual timers
    mockSetTimeout = jest.spyOn(window, 'setTimeout').mockImplementation((callback, delay) => {
      return 123 as any; // Return a fake timer ID
    });
    mockClearTimeout = jest.spyOn(window, 'clearTimeout').mockImplementation(() => { });

    mockObsidianAdapter = {
      loadFromPluginDirectory: jest.fn(),
      saveToPluginDirectory: jest.fn(),
    } as any;

    mockSettings = {
      debugMode: true
    } as MetaFlowSettings;

    cache = new FileStateCache(mockObsidianAdapter, mockSettings);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.restoreAllMocks();
    mockSetTimeout.mockRestore();
    mockClearTimeout.mockRestore();
  });

  describe('load', () => {
    it('should load cache data from disk successfully', async () => {
      const mockData = [
        ['file1.md', {checksum: 'hash1', fileClass: 'class1', mtime: 1000}],
        ['file2.md', {checksum: 'hash2', fileClass: 'class2', mtime: 2000}]
      ];
      mockObsidianAdapter.loadFromPluginDirectory.mockResolvedValue(mockData);

      await cache.load();

      expect(mockObsidianAdapter.loadFromPluginDirectory).toHaveBeenCalledWith('fileClassStateCache.json');
      expect(cache.get('file1.md')).toEqual({checksum: 'hash1', fileClass: 'class1', mtime: 1000});
      expect(cache.get('file2.md')).toEqual({checksum: 'hash2', fileClass: 'class2', mtime: 2000});
      expect(cache.size).toBe(2);
      expect(console.debug).toHaveBeenCalledWith('FileStateCache: Loaded file map cache with', 2, 'entries');
    });

    it('should handle load errors gracefully', async () => {
      mockObsidianAdapter.loadFromPluginDirectory.mockRejectedValue(new Error('Load failed'));

      await cache.load();

      expect(console.error).toHaveBeenCalledWith('FileStateCache: Failed to load file map cache:', expect.any(Error));
      expect(cache.size).toBe(0);
    });

    it('should handle null/undefined cache data', async () => {
      mockObsidianAdapter.loadFromPluginDirectory.mockResolvedValue(null);
      await cache.load();
      expect(cache.size).toBe(0);

    });
  });

  describe('set and get', () => {
    it('should store and retrieve file states', () => {

      const fileState: FileState = {checksum: 'hash1', fileClass: 'class1', mtime: 1000};

      cache.set('test.md', fileState);

      expect(cache.get('test.md')).toEqual(fileState);
      expect(cache.size).toBe(1);
      expect(console.debug).toHaveBeenCalledTimes(1);
      expect(console.debug).toHaveBeenNthCalledWith(1, 'FileStateCache: Scheduled save in 15000ms');

    });

    it('should return undefined for non-existent files', () => {
      expect(cache.get('nonexistent.md')).toBeUndefined();
    });

    it('should schedule save when setting a file state', () => {
      const fileState: FileState = {checksum: 'hash1', fileClass: 'class1', mtime: 1000};

      cache.set('test.md', fileState);

      expect(console.debug).toHaveBeenCalledWith('FileStateCache: Scheduled save in 15000ms');
    });
  });

  describe('delete', () => {
    it('should remove file states', () => {
      const fileState: FileState = {checksum: 'hash1', fileClass: 'class1', mtime: 1000};
      cache.set('test.md', fileState);
      expect(cache.size).toBe(1);

      cache.delete('test.md');

      expect(cache.get('test.md')).toBeUndefined();
      expect(cache.size).toBe(0);
      expect(console.debug).toHaveBeenNthCalledWith(1, 'FileStateCache: Scheduled save in 15000ms');
      expect(console.debug).toHaveBeenNthCalledWith(2, 'FileStateCache: Save already scheduled, keeping existing timer');
    });

    it('should schedule save when deleting a file state', () => {
      const fileState: FileState = {checksum: 'hash1', fileClass: 'class1', mtime: 1000};
      cache.set('test.md', fileState);

      // Clear all mocks to remove the set() call debug message
      jest.clearAllMocks();
      mockSetTimeout.mockClear();

      cache.delete('test.md');

      expect(console.debug).toHaveBeenCalledWith('FileStateCache: Save already scheduled, keeping existing timer');
    });
  });

  describe('clear', () => {
    it('should remove all file states', () => {
      cache.set('test1.md', {checksum: 'hash1', fileClass: 'class1', mtime: 1000});
      cache.set('test2.md', {checksum: 'hash2', fileClass: 'class2', mtime: 2000});
      expect(cache.size).toBe(2);

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('test1.md')).toBeUndefined();
      expect(cache.get('test2.md')).toBeUndefined();
      expect(console.debug).toHaveBeenNthCalledWith(1, 'FileStateCache: Scheduled save in 15000ms');
      expect(console.debug).toHaveBeenNthCalledWith(2, 'FileStateCache: Save already scheduled, keeping existing timer');
    });
  });

  describe('save scheduling', () => {
    it('should save when timer expires', async () => {
      mockObsidianAdapter.saveToPluginDirectory.mockResolvedValue(undefined);
      const fileState: FileState = {checksum: 'hash1', fileClass: 'class1', mtime: 1000};

      cache.set('test.md', fileState);

      // Verify setTimeout was called with correct delay
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 15000);

      // Manually trigger the timer callback
      const timerCallback = mockSetTimeout.mock.calls[0][0];
      await timerCallback();

      expect(mockObsidianAdapter.saveToPluginDirectory).toHaveBeenCalledWith(
        'fileClassStateCache.json',
        [['test.md', fileState]]
      );
      expect(console.debug).toHaveBeenNthCalledWith(1, 'FileStateCache: Scheduled save in 15000ms');
      expect(console.debug).toHaveBeenNthCalledWith(2, "FileStateCache: Saved file map cache with", 1, "entries");
    });

    it('should not create multiple save timers', () => {
      cache.set('test1.md', {checksum: 'hash1', fileClass: 'class1', mtime: 1000});
      cache.set('test2.md', {checksum: 'hash2', fileClass: 'class2', mtime: 2000});

      expect(console.debug).toHaveBeenNthCalledWith(1, 'FileStateCache: Scheduled save in 15000ms');
      expect(console.debug).toHaveBeenNthCalledWith(2, 'FileStateCache: Save already scheduled, keeping existing timer');
      expect(mockSetTimeout).toHaveBeenCalledTimes(1); // Only one timer should be created
    });

    it('should handle save errors', async () => {
      mockObsidianAdapter.saveToPluginDirectory.mockRejectedValue(new Error('Save failed'));
      const fileState: FileState = {checksum: 'hash1', fileClass: 'class1', mtime: 1000};

      cache.set('test.md', fileState);

      // Manually trigger the timer callback
      const timerCallback = mockSetTimeout.mock.calls[0][0];
      await timerCallback();

      expect(console.debug).toHaveBeenNthCalledWith(1, 'FileStateCache: Scheduled save in 15000ms');
      expect(console.error).toHaveBeenCalledWith('FileStateCache: Failed to save file map cache:', expect.any(Error));
    });
  });

  describe('cleanup', () => {
    it('should save immediately and clear timer', async () => {
      mockObsidianAdapter.saveToPluginDirectory.mockResolvedValue(undefined);
      const fileState: FileState = {checksum: 'hash1', fileClass: 'class1', mtime: 1000};

      cache.set('test.md', fileState);

      await cache.cleanup();

      expect(mockObsidianAdapter.saveToPluginDirectory).toHaveBeenCalledWith(
        'fileClassStateCache.json',
        [['test.md', fileState]]
      );
      expect(console.debug).toHaveBeenNthCalledWith(1, 'FileStateCache: Scheduled save in 15000ms');
      expect(console.debug).toHaveBeenNthCalledWith(2, "FileStateCache: Saved file map cache with", 1, "entries");
    });

    it('should not save if not dirty', async () => {
      mockObsidianAdapter.saveToPluginDirectory.mockResolvedValue(undefined);

      await cache.cleanup();

      expect(mockObsidianAdapter.saveToPluginDirectory).not.toHaveBeenCalled();
    });
  });
});
