import {ObsidianAdapter} from './ObsidianAdapter';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {TFile} from 'obsidian';

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
    mockApp = {
      fileManager: {
        generateMarkdownLink: jest.fn((targetFile, sourcePath) => `[[${targetFile.path}|${sourcePath}]]`)
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
});
