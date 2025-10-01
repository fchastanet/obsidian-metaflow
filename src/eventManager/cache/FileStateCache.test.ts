import {FileStateCache} from "./FileStateCache";
import {MetaFlowSettings} from "@metaflow/settings/types";
import FileCachePersistence from "./FileCachePersistence";
import {FileState, InternalFileState} from "./types";

describe('FileStateCache', () => {
  let fileStateCache: FileStateCache;
  let mockSettings: jest.Mocked<MetaFlowSettings>;
  let mockCachePersistence: jest.Mocked<FileCachePersistence<InternalFileState>>;
  let mockNow: jest.Mock<number, []>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSettings = {
      fileClassStateCacheFilename: 'testCache.json',
      fileClassStateCacheSaveIntervalMs: 1000, // 1 second for tests
      fileClassStateCacheEvictionThresholdMs: 1000, // 1 second for tests
    } as any;

    mockCachePersistence = {
      loadCache: jest.fn(),
      saveCache: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FileCachePersistence<InternalFileState>>;

    mockNow = jest.fn().mockReturnValue(1000);
    fileStateCache = new FileStateCache(mockSettings, mockCachePersistence, mockNow);
  });

  it('should load cache from persistence', async () => {
    await fileStateCache.loadCache();
    expect(mockCachePersistence.loadCache).toHaveBeenCalledWith(mockSettings.fileClassStateCacheFilename);
  });

  it('should initialize with empty cache', () => {
    expect(fileStateCache.getSize()).toBe(0);
  });

  it('should set and get file state correctly', () => {
    const filePath = 'path/to/file.md';
    const state: FileState = {fileClass: 'Note', checksum: 'abc123', fileMtime: 1234567890};

    fileStateCache.setState(filePath, state);
    const retrievedState = fileStateCache.getState(filePath);

    expect(retrievedState).toEqual({
      ...state,
      isDirty: true,
      lastUpdateTime: 1000,
    } as InternalFileState);
  });

  it('should update state for non-existent file', () => {
    const filePath = 'path/to/non-existent-file.md';
    fileStateCache.updateState(filePath, {checksum: 'def456'});
    const updatedState = fileStateCache.getState(filePath);

    expect(updatedState).toEqual({
      fileClass: undefined,
      checksum: 'def456',
      fileMtime: undefined,
      isDirty: true,
      lastUpdateTime: 1000,
    } as unknown as InternalFileState);
  });

  it('should update checksum and lastUpdateTime', () => {
    const filePath = 'path/to/file.md';
    const initialState: FileState = {fileClass: 'Note', checksum: 'abc123', fileMtime: 1234567890};

    fileStateCache.setState(filePath, initialState);
    fileStateCache.updateState(filePath, {checksum: 'def456'});
    const updatedState = fileStateCache.getState(filePath);

    expect(updatedState).toEqual({...initialState, checksum: 'def456', isDirty: true, lastUpdateTime: 1000});
  });

  it('should evict stale entries', () => {
    mockNow.mockReturnValueOnce(990).mockReturnValue(3000); // First call returns 990, subsequent calls return 3000
    const staleFilePath = 'path/to/staleFile.md';
    const freshFilePath = 'path/to/freshFile.md';

    const staleState: FileState = {fileClass: 'Note', checksum: 'abc123', fileMtime: 1234567890};
    const freshState: FileState = {fileClass: 'Note', checksum: 'def456', fileMtime: 1234567890};

    fileStateCache.setState(staleFilePath, staleState);
    fileStateCache.setState(freshFilePath, freshState);

    fileStateCache.evictStaleEntries();

    expect(fileStateCache.getState(staleFilePath)).toBeUndefined();
    expect(fileStateCache.getState(freshFilePath)).toEqual({...freshState, isDirty: true, lastUpdateTime: 3000} as InternalFileState);
  });

  it('should remove state correctly', () => {
    const filePath = 'path/to/file.md';
    const state: FileState = {fileClass: 'Note', checksum: 'abc123', fileMtime: 1234567890};

    fileStateCache.setState(filePath, state);
    const removed = fileStateCache.popState(filePath);
    const retrievedState = fileStateCache.getState(filePath);

    expect(removed).toEqual({...state, isDirty: true, lastUpdateTime: 1000} as InternalFileState);
    expect(retrievedState).toBeUndefined();
  });

  it('should schedule cache save when dirty', () => {
    jest.useFakeTimers();

    const filePath = 'path/to/file.md';
    const state: FileState = {fileClass: 'Note', checksum: 'abc123', fileMtime: 1234567890};

    fileStateCache.setState(filePath, state);

    expect(mockCachePersistence.saveCache).not.toHaveBeenCalled();

    // Fast-forward time to trigger save
    jest.advanceTimersByTime(mockSettings.fileClassStateCacheSaveIntervalMs + 100);

    expect(mockCachePersistence.saveCache).toHaveBeenCalledWith(mockSettings.fileClassStateCacheFilename, expect.any(Map));

    jest.useRealTimers();
  });

  it('should rename state correctly', () => {
    const oldPath = 'old/path/file.md';
    const newPath = 'new/path/file.md';
    const state: FileState = {fileClass: 'Note', checksum: 'abc123', fileMtime: 1234567890};

    fileStateCache.setState(oldPath, state);
    fileStateCache.renameState(oldPath, newPath);

    expect(fileStateCache.getState(oldPath)).toBeUndefined();
    expect(fileStateCache.getState(newPath)).toEqual({
      ...state,
      isDirty: true,
      lastUpdateTime: 1000,
    } as InternalFileState);
  });

  it('should clear all entries from cache', () => {
    const filePath1 = 'file1.md';
    const filePath2 = 'file2.md';
    const state: FileState = {fileClass: 'Note', checksum: 'abc123', fileMtime: 1234567890};

    fileStateCache.setState(filePath1, state);
    fileStateCache.setState(filePath2, state);

    expect(fileStateCache.getSize()).toBe(2);

    fileStateCache.clear();

    expect(fileStateCache.getSize()).toBe(0);
    expect(fileStateCache.getState(filePath1)).toBeUndefined();
    expect(fileStateCache.getState(filePath2)).toBeUndefined();
  });

  it('should cancel scheduled save on destroy', () => {
    jest.useFakeTimers();

    const filePath = 'file.md';
    const state: FileState = {fileClass: 'Note', checksum: 'abc123', fileMtime: 1234567890};

    fileStateCache.setState(filePath, state);
    fileStateCache.destroy();

    // Fast-forward time to check that saveCache is not called after destroy
    jest.advanceTimersByTime(mockSettings.fileClassStateCacheSaveIntervalMs + 100);

    expect(mockCachePersistence.saveCache).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should get dirty file paths correctly', () => {
    const filePath1 = 'file1.md';
    const filePath2 = 'file2.md';
    const filePath3 = 'file3.md';
    const state: FileState = {fileClass: 'Note', checksum: 'abc123', fileMtime: 1234567890};

    fileStateCache.setState(filePath1, state);
    fileStateCache.setState(filePath2, state);
    fileStateCache.setState(filePath3, state, false); // Not dirty

    const dirtyFiles = fileStateCache.getDirtyFilePaths();
    expect(dirtyFiles).toContain(filePath1);
    expect(dirtyFiles).toContain(filePath2);
    expect(dirtyFiles).not.toContain(filePath3);
  });
});
