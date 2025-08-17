import {ObsidianAdapter} from './ObsidianAdapter';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {Notice} from 'obsidian';
import {TFile as MockTFile} from '../__mocks__/obsidian';


describe('ObsidianAdapter', () => {
  let mockApp: any;
  let adapter: ObsidianAdapter;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock obsidian modules
    jest.mock('obsidian', () => ({
      TFile: MockTFile,
      MarkdownView: jest.fn(),
      WorkspaceLeaf: jest.fn()
    }));
    mockApp = {
      fileManager: {
        generateMarkdownLink: jest.fn((targetFile, sourcePath) => `[[${targetFile.path}|${sourcePath}]]`),
        renameFile: jest.fn((file, newPath) => Promise.resolve(undefined))
      },
      vault: {
        rename: jest.fn((file, newPath) => Promise.resolve()),
        getAbstractFileByPath: jest.fn((path) => ObsidianAdapter.createMockTFile(path))
      }
    };
    adapter = new ObsidianAdapter(mockApp, DEFAULT_SETTINGS);
  });

  test('generateMarkdownLink should call app.fileManager.generateMarkdownLink with correct args', () => {
    const targetFile = ObsidianAdapter.createMockTFile('target.md');
    const sourceFile = ObsidianAdapter.createMockTFile('source.md');
    const result = adapter.generateMarkdownLink(targetFile, sourceFile);
    expect(mockApp.fileManager.generateMarkdownLink).toHaveBeenCalledWith(targetFile, 'source.md');
    expect(result).toBe('[[target.md|source.md]]');
  });

  test('generateMarkdownLink should use empty string for sourceFile if not provided', () => {
    const targetFile = ObsidianAdapter.createMockTFile('target.md');
    const result = adapter.generateMarkdownLink(targetFile);
    expect(mockApp.fileManager.generateMarkdownLink).toHaveBeenCalledWith(targetFile, '');
    expect(result).toBe('[[target.md|]]');
  });

  test('moveNote should call app.fileManager.renameFile with correct args', async () => {
    const file = ObsidianAdapter.createMockTFile('old/path/note.md');
    const newPath = 'new/path/note.md';
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => { });
    await adapter.moveNote(file, newPath);
    expect(mockApp.fileManager.renameFile).toHaveBeenCalledWith(file, newPath);
    expect(consoleSpy).toHaveBeenCalledWith('Moving note old/path/note.md to new/path/note.md');
    consoleSpy.mockRestore();
  });

  test('moveNote should resolve without error and call renameFile', async () => {
    const file = ObsidianAdapter.createMockTFile('old/path/note.md');
    const newPath = 'new/path/note.md';
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => { });
    await expect(adapter.moveNote(file, newPath)).resolves.toBeUndefined();
    expect(mockApp.fileManager.renameFile).toHaveBeenCalledWith(file, newPath);
    expect(consoleSpy).toHaveBeenCalledWith('Moving note old/path/note.md to new/path/note.md');
    consoleSpy.mockRestore();
  });

  test('notice should call Notice with the correct message', () => {
    const message = 'Test message';
    adapter.notice(message);
    expect(Notice).toHaveBeenCalledWith(message);
  });

  describe('renameNote', () => {
    test('should rename note using vault.rename and return renamed file', async () => {
      const file = ObsidianAdapter.createMockTFile('folder/old-name.md');
      file.parent = {path: 'folder'} as any;
      const newName = 'new-name.md';
      const expectedPath = 'folder/new-name.md';

      const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => { });

      const result = await adapter.renameNote(file, newName);

      expect(mockApp.vault.rename).toHaveBeenCalledWith(file, expectedPath);
      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith(expectedPath);
      expect(consoleSpy).toHaveBeenCalledWith(`Renaming note folder/old-name.md to ${expectedPath}`);
      expect(result).toBeDefined();
      expect(result.path).toBe(expectedPath);

      consoleSpy.mockRestore();
    });

    test('should handle file in root folder (no parent)', async () => {
      const file = ObsidianAdapter.createMockTFile('old-name.md');
      file.parent = null;
      const newName = 'new-name.md';

      const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => { });

      const result = await adapter.renameNote(file, newName);

      expect(mockApp.vault.rename).toHaveBeenCalledWith(file, newName);
      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith(newName);
      expect(consoleSpy).toHaveBeenCalledWith(`Renaming note old-name.md to ${newName}`);

      consoleSpy.mockRestore();
    });

    test('should throw error if renamed file cannot be found', async () => {
      const file = ObsidianAdapter.createMockTFile('folder/old-name.md');
      file.parent = {path: 'folder'} as any;
      const newName = 'new-name.md';
      const expectedPath = 'folder/new-name.md';
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => { });

      // Mock that the file is not found after rename
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      await expect(adapter.renameNote(file, newName))
        .rejects.toThrow(`Failed to get renamed file at ${expectedPath}`);
      expect(consoleSpy).toHaveBeenCalledWith(`Renaming note folder/old-name.md to folder/new-name.md`);
    });

    test('should throw error if vault.rename fails', async () => {
      const file = ObsidianAdapter.createMockTFile('folder/old-name.md');
      file.parent = {path: 'folder'} as any;
      const newName = 'new-name.md';
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => { });

      mockApp.vault.rename.mockRejectedValue(new Error('Rename failed'));

      await expect(adapter.renameNote(file, newName))
        .rejects.toThrow('Rename failed');
      expect(consoleSpy).toHaveBeenCalledWith(`Renaming note folder/old-name.md to folder/new-name.md`);
    });
  });

});
