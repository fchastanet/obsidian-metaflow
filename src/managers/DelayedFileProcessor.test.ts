import {DelayedFileProcessor, DelayedFileProcessorOptions} from './DelayedFileProcessor';
import {TFile, CachedMetadata} from 'obsidian';
import {FileStateCache} from './FileStateCache';
import {DebouncedCallbackManager} from './DebouncedCallbackManager';
import {FileProcessor} from './FileProcessor';
import {FileFilter} from './FileFilter';
import {TAbstractFile} from 'src/__mocks__/obsidian';

// Mock TFile
jest.mock('obsidian', () => ({
  TFile: jest.fn().mockImplementation(function (this: any) {
    this.path = '';
  })
}));

// Mock the components
jest.mock('./FileStateCache');
jest.mock('./DebouncedCallbackManager');
jest.mock('./FileProcessor');
jest.mock('./FileFilter');

// Mock timers
jest.useFakeTimers();

describe('DelayedFileProcessor', () => {
  let delayedProcessor: DelayedFileProcessor;
  let mockOptions: DelayedFileProcessorOptions;
  let mockCallback: jest.Mock;

  // Component mocks
  let mockCache: jest.Mocked<FileStateCache>;
  let mockCallbackManager: jest.Mocked<DebouncedCallbackManager<any>>;
  let mockProcessor: jest.Mocked<FileProcessor>;
  let mockFilter: jest.Mocked<FileFilter>;

  beforeEach(() => {
    // Mock console methods
    jest.spyOn(console, 'debug').mockImplementation(() => { });
    jest.spyOn(console, 'info').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });

    // Create mocked components
    mockCache = new FileStateCache({} as any, {} as any) as jest.Mocked<FileStateCache>;
    mockCallbackManager = new DebouncedCallbackManager(jest.fn(), {} as any) as jest.Mocked<DebouncedCallbackManager<any>>;
    mockProcessor = new FileProcessor({} as any, {} as any, {} as any) as jest.Mocked<FileProcessor>;
    mockFilter = new FileFilter({} as any, {} as any) as jest.Mocked<FileFilter>;

    // Set up default mock implementations
    mockCache.get = jest.fn();
    mockCache.set = jest.fn();
    mockProcessor.computeFileState = jest.fn();
    mockCallbackManager.schedule = jest.fn();
    mockFilter.isApplicable = jest.fn().mockReturnValue(true) as any;

    mockCallback = jest.fn();

    mockOptions = {
      cache: mockCache,
      processor: mockProcessor,
      filter: mockFilter,
      callbackManager: mockCallbackManager,
      settings: {debugMode: false} as any,
      isFileBeingProcessed: jest.fn().mockReturnValue(false),
      isFileBeingRenamed: jest.fn().mockReturnValue(false),
      stackTrace: jest.fn().mockReturnValue({stack: 'mock-stack'})
    };

    delayedProcessor = new DelayedFileProcessor(mockOptions, mockCallback);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('scheduleProcessing', () => {
    it('should schedule processing for applicable files', () => {
      const mockFile = {path: 'test.md', stat: {mtime: 1000}} as TFile;

      delayedProcessor.scheduleProcessing(mockFile);

      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(delayedProcessor.isScheduled('test.md')).toBe(true);
    });

    it('should not schedule processing for non-applicable files', () => {
      const mockFile = {path: 'test.md', stat: {mtime: 1000}} as TFile;
      mockFilter.isApplicable.mockReturnValue(false);

      delayedProcessor.scheduleProcessing(mockFile);

      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(delayedProcessor.isScheduled('test.md')).toBe(false);
    });

    it('should replace previous scheduling for the same file', () => {
      const mockFile = {path: 'test.md', stat: {mtime: 1000}} as TFile;
      const mockCache = {} as CachedMetadata;

      // Schedule first time
      delayedProcessor.scheduleProcessing(mockFile);
      expect(delayedProcessor.isScheduled('test.md')).toBe(true);

      // Schedule again with different cache
      delayedProcessor.scheduleProcessing(mockFile, mockCache);
      expect(delayedProcessor.isScheduled('test.md')).toBe(true);
      expect(delayedProcessor.pendingCount).toBe(1);
    });

    it('should process file after delay', async () => {
      const mockFile = {path: 'test.md', stat: {mtime: 1000}} as TFile;
      const fileState = {checksum: 'checksum', fileClass: 'class', mtime: 1000};

      mockProcessor.computeFileState.mockReturnValue(fileState);

      delayedProcessor.scheduleProcessing(mockFile);

      // Fast-forward past the delay
      jest.advanceTimersByTime(5000);

      await Promise.resolve(); // Allow async operations to complete

      expect(mockProcessor.computeFileState).toHaveBeenCalledWith(mockFile, undefined);
      expect(mockCache.set).toHaveBeenCalledWith('test.md', fileState);
      expect(delayedProcessor.isScheduled('test.md')).toBe(false);
    });
  });

  describe('file processing logic', () => {
    let mockFile: TFile;

    beforeEach(() => {
      mockFile = {path: 'test.md', stat: {mtime: 2000}} as TFile;
    });

    it('should skip processing if file is being processed by callback', async () => {
      mockOptions.isFileBeingProcessed = jest.fn().mockReturnValue(true);

      delayedProcessor.scheduleProcessing(mockFile);
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockProcessor.computeFileState).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should skip processing if file is being renamed by callback', async () => {
      mockOptions.isFileBeingRenamed = jest.fn().mockReturnValue(true);

      delayedProcessor.scheduleProcessing(mockFile);
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockProcessor.computeFileState).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should skip processing if mtime is same as cached', async () => {
      const oldState = {checksum: 'old-checksum', fileClass: 'old-class', mtime: 2000};
      mockCache.get.mockReturnValue(oldState);

      delayedProcessor.scheduleProcessing(mockFile);
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockCache.get).toHaveBeenCalledWith('test.md');
      expect(mockProcessor.computeFileState).not.toHaveBeenCalled();
    });

    it('should process file and update cache when file changes', async () => {
      const oldState = {checksum: 'old-checksum', fileClass: 'old-class', mtime: 1000};
      const newState = {checksum: 'new-checksum', fileClass: 'new-class', mtime: 2000};

      mockCache.get.mockReturnValue(oldState);
      mockProcessor.computeFileState.mockReturnValue(newState);

      delayedProcessor.scheduleProcessing(mockFile);
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockProcessor.computeFileState).toHaveBeenCalledWith(mockFile, undefined);
      expect(mockCache.set).toHaveBeenCalledWith('test.md', newState);
    });

    it('should schedule callback when file class changes', async () => {
      const oldState = {checksum: 'old-checksum', fileClass: 'old-class', mtime: 1000};
      const newState = {checksum: 'new-checksum', fileClass: 'new-class', mtime: 2000};

      mockCache.get.mockReturnValue(oldState);
      mockProcessor.computeFileState.mockReturnValue(newState);

      delayedProcessor.scheduleProcessing(mockFile);
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockCallbackManager.schedule).toHaveBeenCalledWith('test.md', {
        file: mockFile,
        cache: null,
        oldFileClass: 'old-class',
        newFileClass: 'new-class'
      });
    });

    it('should not schedule callback when checksum is same', async () => {
      const oldState = {checksum: 'same-checksum', fileClass: 'old-class', mtime: 1000};
      const newState = {checksum: 'same-checksum', fileClass: 'new-class', mtime: 2000};

      mockCache.get.mockReturnValue(oldState);
      mockProcessor.computeFileState.mockReturnValue(newState);

      delayedProcessor.scheduleProcessing(mockFile);
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockCallbackManager.schedule).not.toHaveBeenCalled();
    });

    it('should pass cache data to processor when provided', async () => {
      const mockCacheData = {frontmatter: {}} as CachedMetadata;
      const newState = {checksum: 'checksum', fileClass: 'class', mtime: 2000};

      mockProcessor.computeFileState.mockReturnValue(newState);

      delayedProcessor.scheduleProcessing(mockFile, mockCacheData);
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockProcessor.computeFileState).toHaveBeenCalledWith(mockFile, mockCacheData);
    });
  });

  describe('clear', () => {
    it('should clear all pending processing operations', () => {
      const mockFile1 = {path: 'test1.md', stat: {mtime: 1000}} as TFile;
      const mockFile2 = {path: 'test2.md', stat: {mtime: 1000}} as TFile;

      delayedProcessor.scheduleProcessing(mockFile1);
      delayedProcessor.scheduleProcessing(mockFile2);

      expect(delayedProcessor.pendingCount).toBe(2);

      delayedProcessor.clear();

      expect(delayedProcessor.pendingCount).toBe(0);
      expect(delayedProcessor.isScheduled('test1.md')).toBe(false);
      expect(delayedProcessor.isScheduled('test2.md')).toBe(false);
    });
  });

  describe('debug mode', () => {
    beforeEach(() => {
      mockOptions.settings.debugMode = true;
      delayedProcessor = new DelayedFileProcessor(mockOptions, mockCallback);
    });

    it('should log debug messages when debug mode is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'debug');
      const mockFile = {path: 'test.md', stat: {mtime: 1000}} as TFile;

      delayedProcessor.scheduleProcessing(mockFile);

      expect(consoleSpy).toHaveBeenCalledWith('DelayedFileProcessor: Scheduled processing for test.md in 5000ms');
    });
  });
});
