import {FileClassStateManager} from './FileClassStateManager';
import {FileStateCache} from './FileStateCache';
import {DebouncedCallbackManager} from './DebouncedCallbackManager';
import {FileProcessor} from './FileProcessor';
import {FileFilter} from './FileFilter';
import {DelayedFileProcessor} from './DelayedFileProcessor';
import {TFile, CachedMetadata, MarkdownView, WorkspaceLeaf} from 'obsidian';
import {MetaFlowSettings} from '../settings/types';
import {ObsidianAdapter} from '../externalApi/ObsidianAdapter';
import {FileClassDeductionService} from '../services/FileClassDeductionService';
import {FileValidationService} from '../services/FileValidationService';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';

// Mock TFile
jest.mock('obsidian', () => ({
  TFile: jest.fn().mockImplementation(function (this: any) {
    this.path = '';
    this.basename = '';
    this.extension = 'md';
    this.saving = false;
  }),
  MarkdownView: jest.fn()
}));

// Mock the components
jest.mock('./FileStateCache');
jest.mock('./DebouncedCallbackManager');
jest.mock('./FileProcessor');
jest.mock('./FileFilter');
jest.mock('./DelayedFileProcessor');

// Mock timers
jest.useFakeTimers();

describe('FileClassStateManager', () => {
  let manager: FileClassStateManager;
  let mockSettings: MetaFlowSettings;
  let mockObsidianAdapter: jest.Mocked<ObsidianAdapter>;
  let mockFileClassDeductionService: jest.Mocked<FileClassDeductionService>;
  let mockFileValidationService: jest.Mocked<FileValidationService>;
  let mockCallback: jest.Mock;

  // Component mocks
  let mockCache: jest.Mocked<FileStateCache>;
  let mockCallbackManager: jest.Mocked<DebouncedCallbackManager<any>>;
  let mockProcessor: jest.Mocked<FileProcessor>;
  let mockFilter: jest.Mocked<FileFilter>;
  let mockDelayedProcessor: jest.Mocked<DelayedFileProcessor>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock settings
    mockSettings = {
      ...DEFAULT_SETTINGS,
      debugMode: false,
      enableAutoRename: true,
      autoUpdateField: 'fileClass',
      debouncingDelay: 1000,
    } as MetaFlowSettings;

    // Mock dependencies
    mockObsidianAdapter = {
      app: {} as any,
      getActiveFile: jest.fn(),
      getCachedMetadata: jest.fn(),
    } as any;

    mockFileClassDeductionService = {
      deduceFileClass: jest.fn(),
    } as any;

    mockFileValidationService = {
      ifFileExcluded: jest.fn(),
    } as any;

    mockCallback = jest.fn();

    // Mock component instances
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      load: jest.fn(),
      cleanup: jest.fn(),
    } as any;

    mockCallbackManager = {
      schedule: jest.fn(),
      clear: jest.fn(),
      isProcessing: jest.fn().mockReturnValue(false),
    } as any;

    mockProcessor = {
      process: jest.fn(),
    } as any;

    mockFilter = {
      isApplicable: jest.fn().mockReturnValue(true),
    } as any;

    mockDelayedProcessor = {
      scheduleProcessing: jest.fn(),
      clear: jest.fn(),
    } as any;

    // Mock constructors
    (FileStateCache as jest.Mock).mockReturnValue(mockCache);
    (DebouncedCallbackManager as jest.Mock).mockReturnValue(mockCallbackManager);
    (FileProcessor as jest.Mock).mockReturnValue(mockProcessor);
    (FileFilter as jest.Mock).mockReturnValue(mockFilter);
    (DelayedFileProcessor as jest.Mock).mockReturnValue(mockDelayedProcessor);

    // Create manager
    manager = new FileClassStateManager(
      mockSettings,
      mockObsidianAdapter,
      mockFileClassDeductionService,
      mockFileValidationService,
      mockCallback
    );
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('initialization', () => {
    it('should initialize all components correctly', () => {
      expect(FileStateCache).toHaveBeenCalledWith(mockObsidianAdapter, mockSettings);
      expect(FileProcessor).toHaveBeenCalledWith(mockFileClassDeductionService, mockObsidianAdapter, mockSettings);
      expect(FileFilter).toHaveBeenCalledWith(mockFileValidationService, mockObsidianAdapter);
      expect(DebouncedCallbackManager).toHaveBeenCalledWith(expect.any(Function), mockSettings);
      expect(DelayedFileProcessor).toHaveBeenCalledWith(
        expect.objectContaining({
          cache: mockCache,
          processor: mockProcessor,
          filter: mockFilter,
          callbackManager: mockCallbackManager,
          settings: mockSettings,
          isFileBeingProcessed: expect.any(Function),
          isFileBeingRenamed: expect.any(Function),
          stackTrace: expect.any(Function)
        }),
        mockCallback
      );
      expect(mockCache.load).toHaveBeenCalled();
    });
  });

  describe('setEnabled', () => {
    it('should clear all components when disabled', () => {
      manager.setEnabled(false);

      expect(mockCache.clear).toHaveBeenCalled();
      expect(mockCallbackManager.clear).toHaveBeenCalled();
    });

    it('should not clear components when enabled is true', () => {
      manager.setEnabled(true);

      expect(mockCache.clear).not.toHaveBeenCalled();
      expect(mockCallbackManager.clear).not.toHaveBeenCalled();
      expect(mockDelayedProcessor.clear).not.toHaveBeenCalled();
    });
  });

  describe('handleActiveLeafChange', () => {
    let mockFile: TFile;
    let mockLeaf: WorkspaceLeaf;
    let mockView: MarkdownView;

    beforeEach(() => {
      mockFile = Object.create(require('obsidian').TFile.prototype);
      mockFile.path = 'test.md';

      // Create a proper MarkdownView mock
      const MarkdownViewConstructor = require('obsidian').MarkdownView;
      mockView = Object.create(MarkdownViewConstructor.prototype);
      mockView.file = mockFile;

      mockLeaf = {
        view: mockView
      } as any;
    });

    it('should schedule processing for valid markdown files', () => {
      manager.handleActiveLeafChange(mockLeaf);

      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockDelayedProcessor.scheduleProcessing).toHaveBeenCalledWith(mockFile);
    });

    it('should not process non-markdown views', () => {
      mockLeaf.view = {} as any; // Not a MarkdownView

      manager.handleActiveLeafChange(mockLeaf);

      expect(mockDelayedProcessor.scheduleProcessing).not.toHaveBeenCalled();
    });

    it('should not process if filter rejects file', () => {
      mockFilter.isApplicable.mockReturnValue(false);

      manager.handleActiveLeafChange(mockLeaf);

      expect(mockDelayedProcessor.scheduleProcessing).not.toHaveBeenCalled();
    });

    it('should handle null leaf', () => {
      manager.handleActiveLeafChange(null);

      expect(mockDelayedProcessor.scheduleProcessing).not.toHaveBeenCalled();
    });
  });

  describe('handleMetadataChanged', () => {
    let mockFile: TFile;
    let mockCachedMetadata: CachedMetadata;

    beforeEach(() => {
      mockFile = Object.create(require('obsidian').TFile.prototype);
      mockFile.path = 'test.md';
      mockCachedMetadata = {} as CachedMetadata;
    });

    it('should schedule processing for metadata changes', () => {
      manager.handleMetadataChanged(mockFile, 'data', mockCachedMetadata);

      expect(mockDelayedProcessor.scheduleProcessing).toHaveBeenCalledWith(mockFile, mockCachedMetadata);
    });
  });

  describe('handleCreateFileEvent', () => {
    let mockFile: TFile;

    beforeEach(() => {
      mockFile = Object.create(require('obsidian').TFile.prototype);
      mockFile.path = 'test.md';
      mockFile.name = 'test.md';
    });

    it('should schedule processing for new files', () => {
      manager.handleCreateFileEvent(mockFile);

      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockDelayedProcessor.scheduleProcessing).toHaveBeenCalledWith(mockFile);
    });

    it('should not process if filter rejects file', () => {
      mockFilter.isApplicable.mockReturnValue(false);

      manager.handleCreateFileEvent(mockFile);

      expect(mockDelayedProcessor.scheduleProcessing).not.toHaveBeenCalled();
    });
  });

  describe('handleModifyFileEvent', () => {
    let mockFile: TFile;

    beforeEach(() => {
      mockFile = Object.create(require('obsidian').TFile.prototype);
      mockFile.path = 'test.md';
    });

    it('should schedule processing for modified files', () => {
      manager.handleModifyFileEvent(mockFile);

      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockDelayedProcessor.scheduleProcessing).toHaveBeenCalledWith(mockFile);
    });

    it('should not process if filter rejects file', () => {
      mockFilter.isApplicable.mockReturnValue(false);

      manager.handleModifyFileEvent(mockFile);

      expect(mockDelayedProcessor.scheduleProcessing).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteFileEvent', () => {
    let mockFile: TFile;

    beforeEach(() => {
      mockFile = Object.create(require('obsidian').TFile.prototype);
      mockFile.path = 'test.md';
    });

    it('should delete from cache when file is deleted', () => {
      manager.handleDeleteFileEvent(mockFile);

      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockCache.delete).toHaveBeenCalledWith(mockFile.path);
    });

    it('should not process if filter rejects file', () => {
      mockFilter.isApplicable.mockReturnValue(false);

      manager.handleDeleteFileEvent(mockFile);

      expect(mockCache.delete).not.toHaveBeenCalled();
    });
  });

  describe('handleRenameFileEvent', () => {
    let mockFile: TFile;
    const oldPath = 'old-test.md';

    beforeEach(() => {
      mockFile = Object.create(require('obsidian').TFile.prototype);
      mockFile.path = 'new-test.md';
    });

    it('should handle normal file renames', () => {
      manager.handleRenameFileEvent(mockFile, oldPath);

      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockCache.delete).toHaveBeenCalledWith(oldPath);
      expect(mockDelayedProcessor.scheduleProcessing).toHaveBeenCalledWith(mockFile);
    });

    it('should ignore renames triggered by callback', () => {
      // Mark file as being renamed by callback
      const renamingFiles = (manager as any).renamingFiles;
      renamingFiles.add(oldPath);

      manager.handleRenameFileEvent(mockFile, oldPath);

      expect(mockCache.delete).toHaveBeenCalledWith(oldPath);
      expect(mockDelayedProcessor.scheduleProcessing).not.toHaveBeenCalled();
    });

    it('should not process if filter rejects file', () => {
      mockFilter.isApplicable.mockReturnValue(false);

      manager.handleRenameFileEvent(mockFile, oldPath);

      expect(mockCache.delete).not.toHaveBeenCalled();
      expect(mockDelayedProcessor.scheduleProcessing).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup all components', async () => {
      await manager.clear();

      expect(mockCallbackManager.clear).toHaveBeenCalled();
      expect(mockDelayedProcessor.clear).toHaveBeenCalled();
      expect(mockCache.clear).toHaveBeenCalled();
    });
  });
});
