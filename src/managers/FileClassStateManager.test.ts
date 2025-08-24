import {FileClassStateManager} from "./FileClassStateManager";
import type {FileClassDeductionService} from "../services/FileClassDeductionService";
import {TFile, WorkspaceLeaf, MarkdownView} from "obsidian";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import {expectNoLogs, mockLogManager} from "../__mocks__/logManager";
import {DEFAULT_SETTINGS} from "../settings/defaultSettings";

// Mock obsidian modules
jest.mock('obsidian', () => ({
  TFile: jest.fn(),
  MarkdownView: jest.fn(),
  WorkspaceLeaf: jest.fn()
}));

describe('FileClassStateManager', () => {
  let mockApp: any;
  let mockFileClassDeductionService: FileClassDeductionService;
  let manager: FileClassStateManager;
  let mockSettings: any;
  let mockFileClassChangedCallback: any;
  let obsidianAdapter: ObsidianAdapter;

  beforeEach(() => {
    obsidianAdapter = new ObsidianAdapter(mockApp, mockSettings);
    const spy = jest.spyOn(console, 'debug').mockImplementation(() => { });

    mockApp = {
      metadataCache: {
        getFileCache: jest.fn()
      },
      vault: {
        getName: jest.fn().mockReturnValue('TestVault'),
      },
      plugins: {
        enabledPlugins: new Map([['metadata-menu', true]]),
        plugins: {
          'metadata-menu': {
            api: {},
            settings: {
              fileClassAlias: 'fileClass',
            },
          },
        },
      },
    };
    mockSettings = {
      ...DEFAULT_SETTINGS,
      autoMetadataInsertion: true,
      debugMode: true,
    };

    mockFileClassDeductionService = {
      getFileClassFromMetadata: jest.fn()
    } as any;
    mockFileClassChangedCallback = jest.fn();
    manager = new FileClassStateManager(mockApp, mockSettings, mockLogManager, mockFileClassDeductionService, mockFileClassChangedCallback);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  function createMockMarkdownView(file?: TFile): MarkdownView {
    const view = {file} as MarkdownView;
    Object.setPrototypeOf(view, MarkdownView.prototype);
    return view;
  }

  test('constructor initializes fileClassMap and fileClassDeductionService', () => {
    expect(manager['fileClassMap']).toBeInstanceOf(Map);
    expect(manager['fileClassDeductionService']).toBeDefined();
    expect(mockFileClassChangedCallback).toHaveBeenCalledTimes(0);
    expectNoLogs();
  });

  describe('handleActiveLeafChange', () => {
    test('does nothing if leaf is null', () => {
      const spy = jest.spyOn(manager as any, 'registerFileClass');
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => { });
      manager.handleActiveLeafChange(null);
      expect(mockFileClassChangedCallback).toHaveBeenCalledTimes(0);
      expect(spy).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Active leaf is not a Markdown view or is null');
      expectNoLogs();
    });

    test('does nothing if leaf.view is null', () => {
      const leaf = {view: null} as unknown as WorkspaceLeaf;
      const spy = jest.spyOn(manager as any, 'registerFileClass');
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => { });
      manager.handleActiveLeafChange(leaf);
      expect(mockFileClassChangedCallback).toHaveBeenCalledTimes(0);
      expect(spy).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Active leaf is not a Markdown view or is null');
      expectNoLogs();
    });

    test('does nothing if leaf.view is not MarkdownView', () => {
      // Provide a plain object that is NOT an instance of MarkdownView
      const leaf = {view: {}} as unknown as WorkspaceLeaf;
      const spy = jest.spyOn(manager as any, 'registerFileClass');
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => { });
      manager.handleActiveLeafChange(leaf);
      expect(mockFileClassChangedCallback).toHaveBeenCalledTimes(0);
      expect(spy).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Active leaf is not a Markdown view or is null');
      expectNoLogs();
    });

    test('does nothing if file is missing', () => {
      const view = createMockMarkdownView();
      const leaf = {view} as unknown as WorkspaceLeaf;
      const spy = jest.spyOn(manager as any, 'registerFileClass');
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => { });
      manager.handleActiveLeafChange(leaf);
      expect(mockFileClassChangedCallback).toHaveBeenCalledTimes(0);
      expect(spy).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('No file associated with the active view');
      expectNoLogs();
    });

    test('does nothing if file is not TFile', () => {
      // Use mock MarkdownView with a plain object (not TFile)
      const view = createMockMarkdownView({} as any);
      const leaf = {view} as unknown as WorkspaceLeaf;
      const spy = jest.spyOn(manager as any, 'registerFileClass');
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => { });
      manager.handleActiveLeafChange(leaf);
      expect(mockFileClassChangedCallback).toHaveBeenCalledTimes(0);
      expect(spy).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Active view does not have a valid file');
      expectNoLogs();
    });

    test('calls registerFileClass if valid', () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      const view = createMockMarkdownView(file);
      const leaf = {view} as unknown as WorkspaceLeaf;
      const spy = jest.spyOn(manager as any, 'registerFileClass');
      manager.handleActiveLeafChange(leaf);
      expect(mockFileClassChangedCallback).toHaveBeenCalledTimes(0);
      expect(spy).toHaveBeenCalledWith(file);
      expectNoLogs();
    });
  });

  describe('handleCreateFileEvent', () => {
    test('handleCreateFileEvent sets fileModifiedMap for TFile', () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      manager.handleCreateFileEvent(file);
      expect(manager['fileModifiedMap'].get(file.path)).toBe(true);
      expectNoLogs();
    });

    test('handleCreateFileEvent does nothing for non-TFile', () => {
      manager.handleCreateFileEvent({path: 'not.md'} as any);
      expect(manager['fileModifiedMap'].get('not.md')).toBeUndefined();
      expectNoLogs();
    });
  });

  describe('handleModifyFileEvent', () => {

    test('handleModifyFileEvent calls callback if fileClass changes', () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      manager['fileModifiedMap'].set(file.path, true);
      manager['fileClassMap'].set(file.path, 'oldClass');
      mockApp.metadataCache.getFileCache.mockReturnValue({frontmatter: {fileClass: 'newClass'}});

      // Mock the serviceContainer's method
      jest.spyOn(mockFileClassDeductionService, 'getFileClassFromMetadata')
        .mockReturnValue('newClass');

      manager.handleModifyFileEvent(file);
      expect(mockFileClassChangedCallback).toHaveBeenCalledWith(file, expect.anything(), 'oldClass', 'newClass');
      expectNoLogs();
    });

    test('handleModifyFileEvent does nothing if not TFile', () => {
      manager.handleModifyFileEvent({path: 'not.md'} as any);
      expect(mockFileClassChangedCallback).not.toHaveBeenCalled();
      expectNoLogs();
    });

    test('handleModifyFileEvent does nothing if saving', () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      (file as any).saving = true;
      manager.handleModifyFileEvent(file);
      expect(mockFileClassChangedCallback).not.toHaveBeenCalled();
      expectNoLogs();
    });

    test('handleModifyFileEvent does nothing if fileModifiedMap not set', () => {
      const spy = jest.spyOn(console, 'debug').mockImplementation(() => { });
      const file = ObsidianAdapter.createMockTFile('test.md');
      manager.handleModifyFileEvent(file);
      expect(spy).toHaveBeenCalledWith("File test.md modified without prior typing or create event");
      expect(mockFileClassChangedCallback).not.toHaveBeenCalled();
      expectNoLogs();
    });
  });

  describe('handleDeleteFileEvent', () => {

    test('handleDeleteFileEvent removes file from maps', () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      manager['fileModifiedMap'].set(file.path, true);
      manager['fileClassMap'].set(file.path, 'class');
      manager.handleDeleteFileEvent(file);
      expect(manager['fileModifiedMap'].has(file.path)).toBe(false);
      expect(manager['fileClassMap'].has(file.path)).toBe(false);
      expectNoLogs();
    });

    test('handleDeleteFileEvent does nothing for non-TFile', () => {
      manager.handleDeleteFileEvent({path: 'not.md'} as any);
      // Should not throw or modify maps
      expectNoLogs();
    });
  });

  describe('handleRenameFileEvent', () => {

    test('handleRenameFileEvent moves fileClass and fileModifiedMap', () => {
      const oldPath = 'old.md';
      const newFile = ObsidianAdapter.createMockTFile('new.md');
      manager['fileModifiedMap'].set(oldPath, true);
      manager['fileClassMap'].set(oldPath, 'class');
      manager.handleRenameFileEvent(newFile, oldPath);
      expect(manager['fileModifiedMap'].has(oldPath)).toBe(false);
      expect(manager['fileModifiedMap'].get(newFile.path)).toBe(true);
      expect(manager['fileClassMap'].has(oldPath)).toBe(false);
      expect(manager['fileClassMap'].get(newFile.path)).toBe('class');
      expectNoLogs();
    });

    test('handleRenameFileEvent does nothing if not TFile', () => {
      manager.handleRenameFileEvent({path: 'not.md'} as any, 'old.md');
      // Should not throw or modify maps
      expectNoLogs();
    });

    test('handleRenameFileEvent does nothing if oldPath not in fileModifiedMap', () => {
      const newFile = ObsidianAdapter.createMockTFile('new.md');
      manager.handleRenameFileEvent(newFile, 'old.md');
      expect(manager['fileModifiedMap'].has('old.md')).toBe(false);
      expect(manager['fileModifiedMap'].get(newFile.path)).toBeUndefined();
      expectNoLogs();
    });

    test('handleRenameFileEvent does nothing if oldPath not in fileClassMap', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const oldPath = 'old.md';
      const newFile = ObsidianAdapter.createMockTFile('new.md');
      manager['fileModifiedMap'].set(oldPath, true);
      manager.handleRenameFileEvent(newFile, oldPath);
      expect(mockLogManager.addWarning).toHaveBeenCalledWith(`File class for ${oldPath} not found in fileClassMap`);
      expect(manager['fileClassMap'].has(oldPath)).toBe(false);
      expect(manager['fileClassMap'].get(newFile.path)).toBeUndefined();
      expect(mockLogManager.addDebug).not.toHaveBeenCalled();
      expect(mockLogManager.addInfo).not.toHaveBeenCalled();
      expect(mockLogManager.addWarning).toHaveBeenCalledWith(`File class for ${oldPath} not found in fileClassMap`);
      expect(mockLogManager.addError).not.toHaveBeenCalled();
      expect(mockLogManager.addMessage).not.toHaveBeenCalled();
    });
  });

  describe('registerFileClass', () => {
    test('sets fileClass from metadata if present', () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      mockApp.metadataCache.getFileCache.mockReturnValue({frontmatter: {fileClass: 'book'}});

      jest.spyOn(mockFileClassDeductionService, 'getFileClassFromMetadata')
        .mockReturnValue('book');

      (manager as any).registerFileClass(file);
      expect(mockFileClassChangedCallback).toHaveBeenCalledTimes(0);
      expect(manager['fileClassMap'].get(file.path)).toBe('book');
      expectNoLogs();
    });

    test('sets fileClass to empty string if no fileCache', () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      mockApp.metadataCache.getFileCache.mockReturnValue(null);
      (manager as any).registerFileClass(file);
      expect(mockFileClassChangedCallback).toHaveBeenCalledTimes(0);
      expect(manager['fileClassMap'].get(file.path)).toBe('');
      expectNoLogs();
    });
  });

  describe('handleMetadataChanged', () => {
    test('updates fileClassMap and logs change if fileClass changed', () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      manager['fileClassMap'].set(file.path, 'oldClass');
      // Set fileModifiedMap to true so the log will trigger
      manager['fileModifiedMap'].set(file.path, true);

      jest.spyOn(mockFileClassDeductionService, 'getFileClassFromMetadata')
        .mockReturnValue('newClass');

      const logSpy = jest.spyOn(console, 'info').mockImplementation(() => { });
      // Provide file content as string, cache as third argument
      manager.handleMetadataChanged(file, '---\nfileClass: newClass\n---\n', {frontmatter: {fileClass: 'newClass'}});
      expect(mockFileClassChangedCallback).toHaveBeenCalledTimes(1);
      expect(manager['fileClassMap'].get(file.path)).toBe('newClass');
      expect(logSpy).toHaveBeenCalledWith(
        `File class changed for ${file.path}: oldClass -> newClass`
      );
      expectNoLogs();
    });

    test('updates fileClassMap and does not log if fileClass unchanged', () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      manager['fileClassMap'].set(file.path, 'sameClass');

      jest.spyOn(mockFileClassDeductionService, 'getFileClassFromMetadata')
        .mockReturnValue('sameClass');

      const spy = jest.spyOn(console, 'debug').mockImplementation(() => { });
      const logSpy = jest.spyOn(console, 'info').mockImplementation(() => { });
      manager.handleMetadataChanged(file, '---\nfileClass: sameClass\n---\n', {frontmatter: {fileClass: 'sameClass'}});
      expect(mockFileClassChangedCallback).toHaveBeenCalledTimes(0);
      expect(manager['fileClassMap'].get(file.path)).toBe('sameClass');
      expect(logSpy).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith("File test.md modified without prior typing or create event");
      expectNoLogs();
    });
  });
});
