import {MarkdownView, TAbstractFile, TFile, WorkspaceLeaf, } from "obsidian";
import {MetaFlowSettings} from "@metaflow/settings/types";
import {FileFilter} from "./FileFilter";
import {FileStateCache} from "./cache/FileStateCache";
import EventManager from "./EventManager";

describe('EventManager', () => {
  let eventManager: EventManager;
  let mockSettings: jest.Mocked<MetaFlowSettings>;
  let mockFilter: jest.Mocked<FileFilter>;
  let mockFileStateCache: jest.Mocked<FileStateCache>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSettings = {
      debugMode: false,
    } as unknown as jest.Mocked<MetaFlowSettings>;

    mockFilter = {
      isApplicable: jest.fn(),
    } as unknown as jest.Mocked<FileFilter>;

    mockFileStateCache = {
      updateState: jest.fn(),
      popState: jest.fn(),
      renameState: jest.fn(),
      loadCache: jest.fn(),
    } as unknown as jest.Mocked<FileStateCache>;

    eventManager = new EventManager(mockSettings, mockFilter as FileFilter, mockFileStateCache);
  });

  it('should create EventManager instance', () => {
    expect(eventManager).toBeDefined();
  });

  it('init should call loadCache on fileStateCache', async () => {
    await eventManager.init();
    expect(mockFileStateCache.loadCache).toHaveBeenCalled();
  });

  describe('handleActiveLeafChange', () => {
    it('should ignore non-MarkdownView leaves', () => {
      // Mock MarkdownView as a class to avoid TypeError in instanceof
      (global as any).MarkdownView = {};
      const mockLeaf: any = {view: {}};
      eventManager.handleActiveLeafChange(mockLeaf);
      expect(mockFilter.isApplicable).not.toHaveBeenCalled();
      expect(mockFileStateCache.updateState).not.toHaveBeenCalled();
    });

    it('should ignore non-applicable files', () => {
      const mockFile = {path: 'file.md', stat: {mtime: 1234567890}} as TFile;
      const mockLeaf: any = {view: new MarkdownView(mockFile as unknown as WorkspaceLeaf)};
      mockFilter.isApplicable.mockReturnValue(false);

      eventManager.handleActiveLeafChange(mockLeaf);
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.updateState).not.toHaveBeenCalled();
    });

    it('should update state for applicable files', () => {

      const mockFile = {path: 'file.md', stat: {mtime: 1234567890}} as TFile;
      const mockLeaf: any = {view: new MarkdownView(mockFile as unknown as WorkspaceLeaf)};
      mockFilter.isApplicable.mockReturnValue(true);

      eventManager.handleActiveLeafChange(mockLeaf);
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.updateState).toHaveBeenCalledWith('file.md', {fileMtime: 1234567890});
    });
  });

  describe('handleMetadataChanged', () => {
    it('should ignore non-applicable files', () => {
      const mockFile = {path: 'file.md', stat: {mtime: 1234567890}} as TFile;
      mockFilter.isApplicable.mockReturnValue(false);

      eventManager.handleMetadataChanged(mockFile, '', {});
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.updateState).not.toHaveBeenCalled();
    });

    it('should update state for applicable files', () => {
      const mockFile = {path: 'file.md', stat: {mtime: 1234567890}} as TFile;
      mockFilter.isApplicable.mockReturnValue(true);

      eventManager.handleMetadataChanged(mockFile, '', {});
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.updateState).toHaveBeenCalledWith('file.md', {fileMtime: 1234567890});
    });
  });

  describe('handleCreateFileEvent', () => {
    it('should ignore non-applicable files', () => {
      const mockFile = {path: 'file.md', stat: {mtime: 1234567890}} as unknown as TAbstractFile;
      mockFilter.isApplicable.mockReturnValue(false);

      eventManager.handleCreateFileEvent(mockFile);
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.updateState).not.toHaveBeenCalled();
    });

    it('should update state for applicable files', () => {
      const mockFile = {path: 'file.md', stat: {mtime: 1234567890}} as unknown as TAbstractFile;
      mockFilter.isApplicable.mockReturnValue(true);

      eventManager.handleCreateFileEvent(mockFile);
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.updateState).toHaveBeenCalledWith('file.md', {fileMtime: 1234567890});
    });
  });

  describe('handleModifyFileEvent', () => {
    it('should ignore non-applicable files', () => {
      const mockFile = {path: 'file.md', stat: {mtime: 1234567890}} as unknown as TAbstractFile;
      mockFilter.isApplicable.mockReturnValue(false);

      eventManager.handleModifyFileEvent(mockFile);
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.updateState).not.toHaveBeenCalled();
    });

    it('should update state for applicable files', () => {
      const mockFile = {path: 'file.md', stat: {mtime: 1234567890}} as unknown as TAbstractFile;
      mockFilter.isApplicable.mockReturnValue(true);

      eventManager.handleModifyFileEvent(mockFile);
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.updateState).toHaveBeenCalledWith('file.md', {fileMtime: 1234567890});
    });
  });

  describe('handleDeleteFileEvent', () => {
    it('should ignore non-applicable files', () => {
      const mockFile = {path: 'file.md', stat: {mtime: 1234567890}} as unknown as TAbstractFile;
      mockFilter.isApplicable.mockReturnValue(false);

      eventManager.handleDeleteFileEvent(mockFile);
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.popState).not.toHaveBeenCalled();
    });

    it('should pop state for applicable files', () => {
      const mockFile = {path: 'file.md', stat: {mtime: 1234567890}} as unknown as TAbstractFile;
      mockFilter.isApplicable.mockReturnValue(true);

      eventManager.handleDeleteFileEvent(mockFile);
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.popState).toHaveBeenCalledWith('file.md');
    });
  });

  describe('handleRenameFileEvent', () => {
    it('should ignore non-applicable files', () => {
      const mockFile = {path: 'new-file.md', stat: {mtime: 1234567890}} as unknown as TAbstractFile;
      const oldPath = 'old-file.md';
      mockFilter.isApplicable.mockReturnValue(false);

      eventManager.handleRenameFileEvent(mockFile, oldPath);
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.renameState).not.toHaveBeenCalled();
      expect(mockFileStateCache.updateState).not.toHaveBeenCalled();
    });

    it('should rename and update state for applicable files', () => {
      const mockFile = {path: 'new-file.md', stat: {mtime: 1234567890}} as unknown as TAbstractFile;
      const oldPath = 'old-file.md';
      mockFilter.isApplicable.mockReturnValue(true);

      eventManager.handleRenameFileEvent(mockFile, oldPath);
      expect(mockFilter.isApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockFileStateCache.renameState).toHaveBeenCalledWith(oldPath, mockFile.path);
      expect(mockFileStateCache.updateState).toHaveBeenCalledWith('new-file.md', {fileMtime: 1234567890});
    });
  });
});
