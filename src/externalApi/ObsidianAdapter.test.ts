import {ObsidianAdapter} from './ObsidianAdapter';
import {DEFAULT_SETTINGS} from '@metaflow/settings/defaultSettings';
import * as obsidian from 'obsidian';

// Mock obsidian module at top level
jest.mock('obsidian', () => ({
  TFile: class MockTFile {
    path: string;
    name: string;
    basename: string;
    extension: string;
    parent: any;
    stat: any;
    vault: any;
    constructor() {
      this.path = '';
      this.name = '';
      this.basename = '';
      this.extension = 'md';
      this.parent = null;
      this.stat = {};
      this.vault = {};
    }
  },
  TFolder: class MockTFolder {
    path: string;
    name: string;
    parent: any;
    constructor() {
      this.path = '';
      this.name = '';
      this.parent = null;
    }
  },
  normalizePath: jest.fn((path: string) => path),
  getFrontMatterInfo: jest.fn(),
  parseYaml: jest.fn(),
  Notice: jest.fn()
}));


describe('ObsidianAdapter', () => {
  let mockApp: any;
  let adapter: ObsidianAdapter;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
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

  test('moveNote should resolve without error if file is already at new path', async () => {
    const file = ObsidianAdapter.createMockTFile('old/path/note.md');
    const newPath = 'old/path/note.md';
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => { });
    await expect(adapter.moveNote(file, newPath)).resolves.toBeUndefined();
    expect(mockApp.fileManager.renameFile).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(`Note ${file.path} is already at ${newPath}`);
    consoleSpy.mockRestore();
  });

  test('notice should call Notice with the correct message', () => {
    const message = 'Test message';
    const result = adapter.notice(message);
    expect(result).toBeDefined();
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

      await adapter.renameNote(file, newName);

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

  describe('isFileExists', () => {
    test('should return true if file exists and is TFile', () => {
      const filePath = 'test.md';
      const mockFile = ObsidianAdapter.createMockTFile(filePath);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);

      const result = adapter.isFileExists(filePath);

      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith(filePath);
      expect(result).toBe(true);
    });

    test('should return false if file does not exist', () => {
      const filePath = 'nonexistent.md';
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      const result = adapter.isFileExists(filePath);

      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith(filePath);
      expect(result).toBe(false);
    });

    test('should return false if file exists but is not TFile', () => {
      const filePath = 'folder';
      const mockFolder = {path: 'folder'}; // Not a TFile
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFolder);

      const result = adapter.isFileExists(filePath);

      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith(filePath);
      expect(result).toBe(false);
    });
  });

  describe('isFolderExists', () => {
    test('should return true if folder exists and is TFolder', () => {
      const folderPath = 'test-folder';
      const mockFolder = new obsidian.TFolder();
      mockFolder.path = folderPath;
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFolder);

      const result = adapter.isFolderExists(folderPath);

      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith(folderPath);
      expect(result).toBe(true);
    });

    test('should return false if folder does not exist', () => {
      const folderPath = 'nonexistent-folder';
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      const result = adapter.isFolderExists(folderPath);

      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith(folderPath);
      expect(result).toBe(false);
    });

    test('should return false if folder exists but is not TFolder', () => {
      const folderPath = 'file.md';
      const mockFile = new obsidian.TFile();
      mockFile.path = folderPath;
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);

      const result = adapter.isFolderExists(folderPath);

      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith(folderPath);
      expect(result).toBe(false);
    });
  });

  describe('createFolder', () => {
    test('should call vault.createFolder and return TFolder', async () => {
      const folderPath = 'new-folder';
      const mockFolder = new obsidian.TFolder();
      mockFolder.path = folderPath;
      mockApp.vault.createFolder = jest.fn().mockResolvedValue(mockFolder);

      const result = await adapter.createFolder(folderPath);

      expect(mockApp.vault.createFolder).toHaveBeenCalledWith(folderPath);
      expect(result).toBe(mockFolder);
    });

    test('should propagate error if vault.createFolder fails', async () => {
      const folderPath = 'new-folder';
      const error = new Error('Create folder failed');
      mockApp.vault.createFolder = jest.fn().mockRejectedValue(error);

      await expect(adapter.createFolder(folderPath)).rejects.toThrow('Create folder failed');
      expect(mockApp.vault.createFolder).toHaveBeenCalledWith(folderPath);
    });
  });

  describe('getAbstractFileByPath', () => {
    test('should return file from vault.getAbstractFileByPath', () => {
      const filePath = 'test.md';
      const mockFile = ObsidianAdapter.createMockTFile(filePath);
      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);

      const result = adapter.getAbstractFileByPath(filePath);

      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith(filePath);
      expect(result).toBe(mockFile);
    });

    test('should return null if file does not exist', () => {
      const filePath = 'nonexistent.md';
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      const result = adapter.getAbstractFileByPath(filePath);

      expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith(filePath);
      expect(result).toBeNull();
    });
  });

  describe('normalizePath', () => {
    test('should normalize file path', () => {
      const filePath = 'folder/../test.md';
      // Mock the normalizePath function from obsidian
      (obsidian.normalizePath as jest.Mock).mockReturnValue('test.md');

      const result = adapter.normalizePath(filePath);

      expect(obsidian.normalizePath).toHaveBeenCalledWith(filePath);
      expect(result).toBe('test.md');
    });
  });

  describe('getCachedFile', () => {
    test('should return cached metadata for file', () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      const mockCache = {frontmatter: {title: 'Test'}};
      mockApp.metadataCache = {
        getFileCache: jest.fn().mockReturnValue(mockCache)
      };

      const result = adapter.getCachedFile(file);

      expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledWith(file);
      expect(result).toBe(mockCache);
    });

    test('should return null if no cache exists', () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      mockApp.metadataCache = {
        getFileCache: jest.fn().mockReturnValue(null)
      };

      const result = adapter.getCachedFile(file);

      expect(mockApp.metadataCache.getFileCache).toHaveBeenCalledWith(file);
      expect(result).toBeNull();
    });
  });

  describe('getFileFrontmatter', () => {
    test('should parse and return frontmatter', async () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      const fileContent = '---\ntitle: Test\nauthor: John\n---\nContent';
      const mockFrontmatter = {title: 'Test', author: 'John'};

      mockApp.vault.read = jest.fn().mockResolvedValue(fileContent);

      // Mock obsidian functions
      (obsidian.getFrontMatterInfo as jest.Mock).mockReturnValue({frontmatter: 'title: Test\nauthor: John'});
      (obsidian.parseYaml as jest.Mock).mockReturnValue(mockFrontmatter);

      const result = await adapter.getFileFrontmatter(file);

      expect(mockApp.vault.read).toHaveBeenCalledWith(file);
      expect(obsidian.getFrontMatterInfo).toHaveBeenCalledWith(fileContent);
      expect(obsidian.parseYaml).toHaveBeenCalledWith('title: Test\nauthor: John');
      expect(result).toEqual(mockFrontmatter);
    });

    test('should handle files without frontmatter', async () => {
      const file = ObsidianAdapter.createMockTFile('test.md');
      const fileContent = 'Just content without frontmatter';

      mockApp.vault.read = jest.fn().mockResolvedValue(fileContent);

      (obsidian.getFrontMatterInfo as jest.Mock).mockReturnValue({frontmatter: ''});
      (obsidian.parseYaml as jest.Mock).mockReturnValue(null);

      const result = await adapter.getFileFrontmatter(file);

      expect(mockApp.vault.read).toHaveBeenCalledWith(file);
      expect(result).toBeNull();
    });
  });

  describe('folderPrefix', () => {
    test('should return folder path with trailing slash', () => {
      (obsidian.normalizePath as jest.Mock).mockReturnValue('folder/subfolder');

      const result = adapter.folderPrefix('folder/subfolder');

      expect(obsidian.normalizePath).toHaveBeenCalledWith('folder/subfolder');
      expect(result).toBe('folder/subfolder/');
    });

    test('should remove leading slash from path', () => {
      (obsidian.normalizePath as jest.Mock).mockReturnValue('/folder/subfolder');

      const result = adapter.folderPrefix('/folder/subfolder');

      expect(result).toBe('folder/subfolder/');
    });

    test('should handle empty path', () => {
      (obsidian.normalizePath as jest.Mock).mockReturnValue('');

      const result = adapter.folderPrefix('');

      expect(result).toBe('/');
    });
  });

  describe('saveToPluginDirectory', () => {
    test('should save data to plugin directory', async () => {
      const fileName = 'test.json';
      const data = {key: 'value'};
      const expectedPath = 'config-dir/plugins/metaflow/test.json';
      const expectedData = JSON.stringify(data, null, 2);

      mockApp.vault.configDir = 'config-dir';
      mockApp.vault.adapter = {
        mkdir: jest.fn().mockResolvedValue(undefined),
        write: jest.fn().mockResolvedValue(undefined)
      };

      (obsidian.normalizePath as jest.Mock).mockReturnValue(expectedPath);

      await adapter.saveToPluginDirectory(fileName, data);

      expect(mockApp.vault.adapter.mkdir).toHaveBeenCalledWith('config-dir/plugins/metaflow');
      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(expectedPath, expectedData);
    });

    test('should handle write error and rethrow', async () => {
      const fileName = 'test.json';
      const data = {key: 'value'};
      const error = new Error('Write failed');

      mockApp.vault.configDir = 'config-dir';
      mockApp.vault.adapter = {
        mkdir: jest.fn().mockResolvedValue(undefined),
        write: jest.fn().mockRejectedValue(error)
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      await expect(adapter.saveToPluginDirectory(fileName, data)).rejects.toThrow('Write failed');
      expect(consoleSpy).toHaveBeenCalledWith('ObsidianAdapter: Failed to save test.json:', error);

      consoleSpy.mockRestore();
    });
  });

  describe('loadFromPluginDirectory', () => {
    test('should load and parse data from plugin directory', async () => {
      const fileName = 'test.json';
      const data = {key: 'value'};
      const jsonData = JSON.stringify(data);
      const expectedPath = 'config-dir/plugins/metaflow/test.json';

      mockApp.vault.configDir = 'config-dir';
      mockApp.vault.adapter = {
        read: jest.fn().mockResolvedValue(jsonData)
      };

      (obsidian.normalizePath as jest.Mock).mockReturnValue(expectedPath);

      const result = await adapter.loadFromPluginDirectory(fileName);

      expect(mockApp.vault.adapter.read).toHaveBeenCalledWith(expectedPath);
      expect(result).toEqual(data);
    });

    test('should return null if file does not exist', async () => {
      const fileName = 'nonexistent.json';
      const error = new Error('ENOENT: no such file or directory');

      mockApp.vault.configDir = 'config-dir';
      mockApp.vault.adapter = {
        read: jest.fn().mockRejectedValue(error)
      };

      const result = await adapter.loadFromPluginDirectory(fileName);

      expect(result).toBeNull();
    });

    test('should return null if file does not exist (different error message)', async () => {
      const fileName = 'nonexistent.json';
      const error = new Error('File does not exist');

      mockApp.vault.configDir = 'config-dir';
      mockApp.vault.adapter = {
        read: jest.fn().mockRejectedValue(error)
      };

      const result = await adapter.loadFromPluginDirectory(fileName);

      expect(result).toBeNull();
    });

    test('should handle read error and rethrow', async () => {
      const fileName = 'test.json';
      const error = new Error('Read failed');

      mockApp.vault.configDir = 'config-dir';
      mockApp.vault.adapter = {
        read: jest.fn().mockRejectedValue(error)
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      await expect(adapter.loadFromPluginDirectory(fileName)).rejects.toThrow('Read failed');
      expect(consoleSpy).toHaveBeenCalledWith('ObsidianAdapter: Failed to load test.json:', error);

      consoleSpy.mockRestore();
    });

    test('should handle JSON parse error', async () => {
      const fileName = 'test.json';
      const invalidJson = '{invalid json}';

      mockApp.vault.configDir = 'config-dir';
      mockApp.vault.adapter = {
        read: jest.fn().mockResolvedValue(invalidJson)
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      await expect(adapter.loadFromPluginDirectory(fileName)).rejects.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('createMockTFile', () => {
    test('should create a valid TFile mock', () => {
      const path = 'folder/test.md';
      const file = ObsidianAdapter.createMockTFile(path);

      expect(file.path).toBe(path);
      expect(file.name).toBe('test.md');
      expect(file.basename).toBe('test.md');
      expect(file.extension).toBe('md');
      expect(file instanceof obsidian.TFile).toBe(true);
    });

    test('should handle file without folder', () => {
      const path = 'test.md';
      const file = ObsidianAdapter.createMockTFile(path);

      expect(file.path).toBe(path);
      expect(file.name).toBe('test.md');
      expect(file.basename).toBe('test.md');
    });
  });

});
