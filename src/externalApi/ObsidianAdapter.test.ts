import {ObsidianAdapter} from './ObsidianAdapter';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {Notice, TFile} from 'obsidian';

// Mock the entire obsidian module
jest.mock('obsidian');

describe('ObsidianAdapter', () => {
  let mockApp: any;
  let adapter: ObsidianAdapter;

  function createMockTFile(path: string): TFile {
    return {
      path,
      name: path.split('/').pop() || path,
      stat: {} as any,
      basename: path.split('/').pop() || path,
      extension: 'md',
      vault: {} as any,
      parent: {} as any,
    } as TFile;
  }

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    mockApp = {
      fileManager: {
        generateMarkdownLink: jest.fn((targetFile, sourcePath) => `[[${targetFile.path}|${sourcePath}]]`),
        renameFile: jest.fn((file, newPath) => Promise.resolve(undefined))
      }
    };
    adapter = new ObsidianAdapter(mockApp, DEFAULT_SETTINGS);
  });

  test('generateMarkdownLink should call app.fileManager.generateMarkdownLink with correct args', () => {
    const targetFile = createMockTFile('target.md');
    const sourceFile = createMockTFile('source.md');
    const result = adapter.generateMarkdownLink(targetFile, sourceFile);
    expect(mockApp.fileManager.generateMarkdownLink).toHaveBeenCalledWith(targetFile, 'source.md');
    expect(result).toBe('[[target.md|source.md]]');
  });

  test('generateMarkdownLink should use empty string for sourceFile if not provided', () => {
    const targetFile = createMockTFile('target.md');
    const result = adapter.generateMarkdownLink(targetFile);
    expect(mockApp.fileManager.generateMarkdownLink).toHaveBeenCalledWith(targetFile, '');
    expect(result).toBe('[[target.md|]]');
  });

  test('moveNote should call app.fileManager.renameFile with correct args', async () => {
    const file = createMockTFile('old/path/note.md');
    const newPath = 'new/path/note.md';
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => { });
    await adapter.moveNote(file, newPath);
    expect(mockApp.fileManager.renameFile).toHaveBeenCalledWith(file, newPath);
    expect(consoleSpy).toHaveBeenCalledWith('Moving note old/path/note.md to new/path/note.md');
    consoleSpy.mockRestore();
  });

  test('moveNote should resolve without error and call renameFile', async () => {
    const file = createMockTFile('old/path/note.md');
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

});
