import {FileClassStateManager} from './FileClassStateManager';
import {TFile} from 'obsidian';

// Mock TFile
jest.mock('obsidian', () => ({
  TFile: jest.fn().mockImplementation(function (this: any) {
    this.path = '';
  })
}));

// Mock timers
jest.useFakeTimers();

describe('FileClassStateManager', () => {
  let manager: any;
  let mockObsidianAdapter: any;
  let mockFileClassDeductionService: any;

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

    // Create manager with minimal setup
    manager = Object.create(FileClassStateManager.prototype);
    manager.app = {};
    manager.settings = {debugMode: true}; // Enable debug mode for tests
    manager.logManager = {};
    manager.obsidianAdapter = mockObsidianAdapter;
    manager.fileClassDeductionService = mockFileClassDeductionService;
    manager.fileValidationService = {ifFileExcluded: jest.fn().mockReturnValue(false)};
    manager.fileClassChangedCallback = jest.fn();
    manager.fileMap = new Map();
    manager.fileRenamedMap = new Map();
    manager.enabled = true;
    manager.isDirty = false;
    manager.saveTimer = null;
    manager.SAVE_INTERVAL = 15000;
    // Initialize new debouncing properties
    manager.callbackDebounceTimers = new Map();
    manager.pendingCallbacks = new Map();
    manager.processingFiles = new Set();
    manager.renamingFiles = new Set();
    manager.CALLBACK_DEBOUNCE_DELAY = 1000;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
  });

  describe('setEnabled', () => {
    it('should enable the manager', () => {
      manager.setEnabled(true);
      expect(manager.enabled).toBe(true);
    });

    it('should disable and clear maps', () => {
      manager.fileMap.set('test.md', {checksum: 'hash', fileClass: 'class', mtime: 1000});
      manager.fileRenamedMap.set('old.md', 'new.md');

      manager.setEnabled(false);

      expect(manager.enabled).toBe(false);
      expect(manager.fileMap.size).toBe(0);
      expect(manager.fileRenamedMap.size).toBe(0);
    });
  });

  describe('scheduleSave', () => {
    it('should set isDirty and schedule save when no timer exists', () => {
      manager.scheduleSave();

      expect(manager.isDirty).toBe(true);
      expect(manager.saveTimer).not.toBeNull();
      expect(console.debug).toHaveBeenCalledWith('FileClassStateManager: Scheduled save in 15000ms');
    });

    it('should not create new timer when one already exists', () => {
      manager.scheduleSave();
      const firstTimer = manager.saveTimer;

      manager.scheduleSave();
      const secondTimer = manager.saveTimer;

      expect(firstTimer).toBe(secondTimer);
      expect(console.debug).toHaveBeenCalledWith('FileClassStateManager: Save already scheduled, keeping existing timer');
    });

    it('should call saveFileMapCache when timer expires', () => {
      const saveFileSpy = jest.spyOn(manager, 'saveFileMapCache').mockResolvedValue(undefined);

      manager.scheduleSave();
      jest.advanceTimersByTime(15000);

      expect(saveFileSpy).toHaveBeenCalled();
      expect(manager.saveTimer).toBeNull();
    });
  });

  describe('saveFileMapCache', () => {
    it('should save fileMap to plugin directory', async () => {
      manager.fileMap.set('test.md', {checksum: 'hash', fileClass: 'class', mtime: 1000});
      manager.isDirty = true;

      await manager.saveFileMapCache();

      expect(mockObsidianAdapter.saveToPluginDirectory).toHaveBeenCalledWith(
        'fileClassStateCache.json',
        [['test.md', {checksum: 'hash', fileClass: 'class', mtime: 1000}]]
      );
      expect(manager.isDirty).toBe(false);
    });

    it('should handle save errors', async () => {
      mockObsidianAdapter.saveToPluginDirectory.mockRejectedValue(new Error('Save failed'));
      manager.isDirty = true;

      await manager.saveFileMapCache();

      expect(console.error).toHaveBeenCalledWith('FileClassStateManager: Failed to save file map cache:', expect.any(Error));
    });
  });

  describe('handleDeleteFileEvent', () => {
    it('should remove file from map and schedule save', () => {
      // Create a proper TFile instance that passes isFileApplicable
      const file = Object.create(require('obsidian').TFile.prototype);
      file.path = 'test.md';
      file.basename = 'test';
      file.extension = 'md';
      file.saving = false;
      file.stat = {mtime: 1000};

      manager.fileMap.set('test.md', {checksum: 'hash', fileClass: 'class', mtime: 1000});
      const scheduleSaveSpy = jest.spyOn(manager, 'scheduleSave');

      manager.handleDeleteFileEvent(file);

      expect(manager.fileMap.has('test.md')).toBe(false);
      expect(scheduleSaveSpy).toHaveBeenCalled();
    });

    it('should ignore non-TFile', () => {
      const notAFile = {path: 'test.md'};
      const scheduleSaveSpy = jest.spyOn(manager, 'scheduleSave');

      // This should fail the instanceof check
      manager.handleDeleteFileEvent(notAFile);

      expect(scheduleSaveSpy).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clear timer and save if dirty', async () => {
      const saveFileSpy = jest.spyOn(manager, 'saveFileMapCache').mockResolvedValue(undefined);

      manager.scheduleSave();
      expect(manager.saveTimer).not.toBeNull();
      expect(manager.isDirty).toBe(true);

      await manager.cleanup();

      expect(manager.saveTimer).toBeNull();
      expect(saveFileSpy).toHaveBeenCalled();
    });

    it('should not save if not dirty', async () => {
      const saveFileSpy = jest.spyOn(manager, 'saveFileMapCache').mockResolvedValue(undefined);

      manager.isDirty = false;

      await manager.cleanup();

      expect(saveFileSpy).not.toHaveBeenCalled();
    });
  });

  describe('debouncing functionality', () => {
    let mockFile: any;
    let mockCache: any;

    beforeEach(() => {
      // Create proper TFile instances that pass isFileApplicable
      mockFile = Object.create(require('obsidian').TFile.prototype);
      mockFile.path = 'test.md';
      mockFile.basename = 'test';
      mockFile.extension = 'md';
      mockFile.saving = false;
      mockFile.stat = {mtime: 1000};

      mockCache = {
        frontmatter: {fileClass: 'new-class'}
      };
    });

    it('should debounce multiple rapid fileClass changes and use the last event', async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      manager.fileClassChangedCallback = callback;

      // Simulate existing file state
      manager.fileMap.set('test.md', {
        checksum: 'old-checksum',
        fileClass: 'old-class',
        mtime: 500
      });

      // Create separate mock files with different mtimes to trigger checksum computation
      const mockFile1 = Object.create(require('obsidian').TFile.prototype);
      Object.assign(mockFile1, mockFile, {stat: {mtime: 1001}});

      const mockFile2 = Object.create(require('obsidian').TFile.prototype);
      Object.assign(mockFile2, mockFile, {stat: {mtime: 1002}});

      const mockFile3 = Object.create(require('obsidian').TFile.prototype);
      Object.assign(mockFile3, mockFile, {stat: {mtime: 1003}});

      // Mock the checksum computation to return different values
      const sha256Spy = jest.spyOn(require('../utils/Utils').Utils, 'sha256')
        .mockReturnValueOnce('checksum1')
        .mockReturnValueOnce('checksum2')
        .mockReturnValueOnce('checksum3');

      // Mock deduction service to return different fileClasses
      mockFileClassDeductionService.getFileClassFromMetadata
        .mockReturnValueOnce('class1')
        .mockReturnValueOnce('class2')
        .mockReturnValueOnce('class3');

      // Trigger multiple rapid changes through metadata events with different mtimes
      manager.handleMetadataChanged(mockFile1, 'content1', {frontmatter: {fileClass: 'class1'}});
      manager.handleMetadataChanged(mockFile2, 'content2', {frontmatter: {fileClass: 'class2'}});
      manager.handleMetadataChanged(mockFile3, 'content3', {frontmatter: {fileClass: 'class3'}});

      // Verify that callback is not called immediately
      expect(callback).not.toHaveBeenCalled();
      expect(manager.callbackDebounceTimers.has('test.md')).toBe(true);
      expect(manager.pendingCallbacks.has('test.md')).toBe(true);

      // Verify the last event parameters are stored (most important part of the test)
      const pendingCallback = manager.pendingCallbacks.get('test.md');
      expect(pendingCallback?.newFileClass).toBe('class3');
      expect(pendingCallback?.file.stat.mtime).toBe(1003);

      // Fast-forward time to trigger the debounced callback
      jest.advanceTimersByTime(1000);

      // Wait for promise resolution
      await jest.runAllTicks();

      // Verify callback was called only once (most important - no multiple calls)
      expect(callback).toHaveBeenCalledTimes(1);

      // Verify it was called with the last file class (class3)
      const callArgs = callback.mock.calls[0];
      expect(callArgs[3]).toBe('class3'); // newFileClass is the 4th argument

      // Verify cleanup
      expect(manager.callbackDebounceTimers.has('test.md')).toBe(false);
      expect(manager.pendingCallbacks.has('test.md')).toBe(false);

      sha256Spy.mockRestore();
    }, 10000);

    it('should prevent concurrent execution for the same file', async () => {
      const callback = jest.fn().mockImplementation(async () => {
        // Simulate long-running callback
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      manager.fileClassChangedCallback = callback;

      // Add file to processing set to simulate concurrent execution
      manager.processingFiles.add('test.md');
      manager.pendingCallbacks.set('test.md', {
        file: mockFile,
        cache: mockCache,
        oldFileClass: 'old-class',
        newFileClass: 'new-class'
      });

      // Try to execute callback through the private method
      await manager['executeFileClassChangedCallback']('test.md');

      // Verify callback was not called due to concurrent execution
      expect(callback).not.toHaveBeenCalled();
      expect(manager.pendingCallbacks.has('test.md')).toBe(false);
    });

    it('should skip processing if file is being processed by callback', () => {
      // Add file to processing set
      manager.processingFiles.add('test.md');

      const oldSize = manager.fileMap.size;

      // Try to trigger processing through public method
      manager.handleMetadataChanged(mockFile, 'content', mockCache);

      // Verify file was not processed (fileMap should not have changed)
      expect(manager.fileMap.size).toBe(oldSize);
    });

    it('should ignore rename events triggered by callback', () => {
      const oldPath = 'old/path.md';
      const newPath = 'new/path.md';

      // Mark file as being renamed
      manager.renamingFiles.add(oldPath);

      // Add old path to fileMap
      manager.fileMap.set(oldPath, {
        checksum: 'old-checksum',
        fileClass: 'old-class',
        mtime: 1000
      });

      // Verify the file was added
      expect(manager.fileMap.has(oldPath)).toBe(true);

      // Create a mock file that will pass the TFile instanceof check and isFileApplicable
      const mockRenamedFile = Object.create(require('obsidian').TFile.prototype);
      mockRenamedFile.path = newPath;
      mockRenamedFile.basename = 'new-file';
      mockRenamedFile.extension = 'md';
      mockRenamedFile.saving = false;
      mockRenamedFile.stat = {mtime: 2000};

      // Trigger rename event
      manager.handleRenameFileEvent(mockRenamedFile, oldPath);

      // The important test: verify old path was deleted when rename is ignored
      expect(manager.fileMap.has(oldPath)).toBe(false);
    });
  });
});
