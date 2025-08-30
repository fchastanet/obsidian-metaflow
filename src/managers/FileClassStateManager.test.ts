import {FileClassStateManager} from './FileClassStateManager';
import {FileStateCache} from './FileStateCache';
import {DebouncedCallbackManager} from './DebouncedCallbackManager';
import {FileProcessor} from './FileProcessor';
import {FileFilter} from './FileFilter';
import {TFile, CachedMetadata, MarkdownView, WorkspaceLeaf} from 'obsidian';

// Mock TFile
jest.mock('obsidian', () => ({
  TFile: jest.fn().mockImplementation(function (this: any) {
    this.path = '';
  }),
  MarkdownView: jest.fn()
}));

// Mock the components
jest.mock('./FileStateCache');
jest.mock('./DebouncedCallbackManager');
jest.mock('./FileProcessor');
jest.mock('./FileFilter');

// Mock timers
jest.useFakeTimers();

describe('FileClassStateManager', () => {
  let manager: FileClassStateManager;
  let mockObsidianAdapter: any;
  let mockFileClassDeductionService: any;
  let mockFileValidationService: any;
  let mockApp: any;
  let mockSettings: any;
  let mockLogManager: any;
  let mockCallback: jest.Mock;

  // Component mocks
  let mockCache: jest.Mocked<FileStateCache>;
  let mockCallbackManager: jest.Mocked<DebouncedCallbackManager<any>>;
  let mockProcessor: jest.Mocked<FileProcessor>;
  let mockFilter: jest.Mocked<FileFilter>;

  beforeEach(() => {
    // Mock console methods
    jest.spyOn(console, 'debug').mockImplementation(() => { });
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'info').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });

    mockObsidianAdapter = {
      loadFromPluginDirectory: jest.fn().mockResolvedValue(null),
      saveToPluginDirectory: jest.fn().mockResolvedValue(undefined),
      getCachedFile: jest.fn().mockReturnValue({frontmatter: {}}),
    };

    mockFileClassDeductionService = {
      getFileClassFromMetadata: jest.fn().mockReturnValue('test-class'),
    };

    mockFileValidationService = {
      ifFileExcluded: jest.fn().mockReturnValue(false)
    };

    mockApp = {};
    mockSettings = {debugMode: true};
    mockLogManager = {};
    mockCallback = jest.fn().mockResolvedValue(undefined);

    // Set up component mocks
    mockCache = {
      load: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      cleanup: jest.fn().mockResolvedValue(undefined),
      size: 0
    } as any;

    mockCallbackManager = {
      schedule: jest.fn(),
      isProcessing: jest.fn().mockReturnValue(false),
      hasPending: jest.fn().mockReturnValue(false),
      getPending: jest.fn(),
      clear: jest.fn()
    } as any;

    mockProcessor = {
      computeFileState: jest.fn().mockReturnValue({
        checksum: 'new-checksum',
        fileClass: 'new-class',
        mtime: 2000
      })
    } as any;

    mockFilter = {
      isApplicable: jest.fn().mockReturnValue(true)
    } as any;

    // Mock the constructors
    (FileStateCache as jest.Mock).mockImplementation(() => mockCache);
    (DebouncedCallbackManager as jest.Mock).mockImplementation(() => mockCallbackManager);
    (FileProcessor as jest.Mock).mockImplementation(() => mockProcessor);
    (FileFilter as jest.Mock).mockImplementation(() => mockFilter);

    manager = new FileClassStateManager(
      mockApp,
      mockSettings,
      mockLogManager,
      mockObsidianAdapter,
      mockFileClassDeductionService,
      mockFileValidationService,
      mockCallback
    );
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize all components correctly', () => {
      expect(FileStateCache).toHaveBeenCalledWith(mockObsidianAdapter, mockSettings);
      expect(FileProcessor).toHaveBeenCalledWith(mockFileClassDeductionService, mockObsidianAdapter, mockSettings);
      expect(FileFilter).toHaveBeenCalledWith(mockFileValidationService, mockObsidianAdapter);
      expect(DebouncedCallbackManager).toHaveBeenCalledWith(expect.any(Function), mockSettings);
      expect(mockCache.load).toHaveBeenCalled();
    });
  });

  describe('setEnabled', () => {
    it('should clear caches and callbacks when disabled', () => {
      manager.setEnabled(false);

      expect(mockCache.clear).toHaveBeenCalled();
      expect(mockCallbackManager.clear).toHaveBeenCalled();
    });

    it('should not clear anything when enabled', () => {
      manager.setEnabled(true);

      expect(mockCache.clear).not.toHaveBeenCalled();
      expect(mockCallbackManager.clear).not.toHaveBeenCalled();
    });
  });

  describe('handleActiveLeafChange', () => {
    it('should process file when leaf has valid MarkdownView', () => {
      const mockFile = {path: 'test.md', stat: {mtime: 1000}} as TFile;
      const mockView = {file: mockFile} as MarkdownView;
      const mockLeaf = {view: mockView} as unknown as WorkspaceLeaf;

      // Mock MarkdownView instance check
      Object.setPrototypeOf(mockView, require('obsidian').MarkdownView.prototype);

      manager.handleActiveLeafChange(mockLeaf);

      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockProcessor.computeFileState).toHaveBeenCalledWith(mockFile, undefined);
    });

    it('should ignore non-MarkdownView leaves', () => {
      const mockLeaf = {view: {file: 'test.md'}} as any;

      manager.handleActiveLeafChange(mockLeaf);

      expect(mockFilter.isApplicable).not.toHaveBeenCalled();
    });

    it('should ignore null leaf', () => {
      manager.handleActiveLeafChange(null);

      expect(mockFilter.isApplicable).not.toHaveBeenCalled();
    });
  });

  describe('handleMetadataChanged', () => {
    it('should process file with cache', () => {
      const mockFile = {path: 'test.md', stat: {mtime: 1000}} as TFile;
      const mockCache = {frontmatter: {}} as CachedMetadata;

      manager.handleMetadataChanged(mockFile, 'data', mockCache);

      expect(mockProcessor.computeFileState).toHaveBeenCalledWith(mockFile, mockCache);
    });
  });

  describe('file processing with callback', () => {
    let mockFile: TFile;
    let mockCacheData: CachedMetadata;

    beforeEach(() => {
      mockFile = {path: 'test.md', stat: {mtime: 2000}} as any;
      mockCacheData = {frontmatter: {}} as CachedMetadata;
    });

    it('should detect file class changes and schedule callback', () => {
      const oldState = {checksum: 'old-checksum', fileClass: 'old-class', mtime: 1000};
      const newState = {checksum: 'new-checksum', fileClass: 'new-class', mtime: 2000};

      mockCache.get.mockReturnValue(oldState);
      mockProcessor.computeFileState.mockReturnValue(newState);

      manager.handleMetadataChanged(mockFile, 'data', mockCacheData);

      expect(mockCache.set).toHaveBeenCalledWith('test.md', newState);
      expect(mockCallbackManager.schedule).toHaveBeenCalledWith('test.md', {
        file: mockFile,
        cache: mockCacheData,
        oldFileClass: 'old-class',
        newFileClass: 'new-class'
      });
    });

    it('should skip processing if file is being processed by callback', () => {
      mockCallbackManager.isProcessing.mockReturnValue(true);

      manager.handleMetadataChanged(mockFile, 'data', mockCacheData);

      expect(mockProcessor.computeFileState).not.toHaveBeenCalled();
    });

    it('should skip processing if modification time is same', () => {
      const oldState = {checksum: 'checksum', fileClass: 'class', mtime: 2000};
      mockCache.get.mockReturnValue(oldState);

      manager.handleMetadataChanged(mockFile, 'data', mockCacheData);

      expect(mockProcessor.computeFileState).not.toHaveBeenCalled();
    });

    it('should not schedule callback if no old state exists', () => {
      mockCache.get.mockReturnValue(undefined);

      manager.handleMetadataChanged(mockFile, 'data', mockCacheData);

      expect(mockCallbackManager.schedule).not.toHaveBeenCalled();
    });

    it('should not schedule callback if checksums are same', () => {
      const oldState = {checksum: 'same-checksum', fileClass: 'old-class', mtime: 1000};
      const newState = {checksum: 'same-checksum', fileClass: 'new-class', mtime: 2000};

      mockCache.get.mockReturnValue(oldState);
      mockProcessor.computeFileState.mockReturnValue(newState);

      manager.handleMetadataChanged(mockFile, 'data', mockCacheData);

      expect(mockCallbackManager.schedule).not.toHaveBeenCalled();
    });
  });

  describe('handleCreateFileEvent', () => {
    it('should process applicable files', () => {
      const mockFile = {path: 'test.md', name: 'test.md', stat: {mtime: 1000}} as any;

      manager.handleCreateFileEvent(mockFile);

      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockProcessor.computeFileState).toHaveBeenCalledWith(mockFile, undefined);
    });

    it('should ignore non-applicable files', () => {
      const mockFile = {path: 'test.txt', stat: {mtime: 1000}} as any;
      mockFilter.isApplicable.mockReturnValue(false);

      manager.handleCreateFileEvent(mockFile);

      expect(mockProcessor.computeFileState).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteFileEvent', () => {
    it('should delete from cache for applicable files', () => {
      const mockFile = {path: 'test.md', stat: {mtime: 1000}} as any;

      manager.handleDeleteFileEvent(mockFile);

      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockCache.delete).toHaveBeenCalledWith('test.md');
    });

    it('should ignore non-applicable files', () => {
      const mockFile = {path: 'test.txt', stat: {mtime: 1000}} as any;
      mockFilter.isApplicable.mockReturnValue(false);

      manager.handleDeleteFileEvent(mockFile);

      expect(mockCache.delete).not.toHaveBeenCalled();
    });
  });

  describe('handleRenameFileEvent', () => {
    it('should delete old path and process new file', () => {
      const mockFile = {path: 'new.md', stat: {mtime: 1000}} as any;
      const oldPath = 'old.md';

      manager.handleRenameFileEvent(mockFile, oldPath);

      expect(mockCache.delete).toHaveBeenCalledWith(oldPath);
      expect(mockProcessor.computeFileState).toHaveBeenCalledWith(mockFile, undefined);
    });

    it('should ignore renames triggered by callback', () => {
      const mockFile = {path: 'new.md', stat: {mtime: 1000}} as any;
      const oldPath = 'old.md';

      // Simulate a file being renamed by callback
      (manager as any).renamingFiles.add(oldPath);

      manager.handleRenameFileEvent(mockFile, oldPath);

      expect(mockCache.delete).toHaveBeenCalledWith(oldPath);
      expect(mockProcessor.computeFileState).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup all components', async () => {
      await manager.cleanup();

      expect(mockCallbackManager.clear).toHaveBeenCalled();
      expect(mockCache.cleanup).toHaveBeenCalled();
    });
  });
});
