import {TemplaterAdapter} from './TemplaterAdapter';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {expectNoLogs} from '../__mocks__/logManager';
import {ObsidianAdapter} from './ObsidianAdapter';

describe('TemplaterAdapter', () => {
  let mockApp: any;
  let templaterAdapter: TemplaterAdapter;

  beforeEach(() => {
    // Setup mock app
    mockApp = {
      plugins: {
        enabledPlugins: new Set(['templater-obsidian']),
        plugins: {}
      },
      fileManager: {
        generateMarkdownLink: jest.fn((file, path) => `[[${file.name}]]`)
      },
      vault: {
        getAbstractFileByPath: jest.fn(),
      },
    };

    templaterAdapter = new TemplaterAdapter(mockApp, DEFAULT_SETTINGS);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Templater Integration', () => {
    test('should detect Templater availability when plugin exists', () => {
      mockApp.plugins.plugins['templater-obsidian'] = {
        settings: {},
        templater: {}
      };
      const adapter = new TemplaterAdapter(mockApp, {...DEFAULT_SETTINGS});
      const result = adapter.isTemplaterAvailable();
      expect(result).toBe(true);
    });

    test('should detect Templater unavailability when plugin missing', () => {
      delete mockApp.plugins.plugins['templater-obsidian'];
      const adapter = new TemplaterAdapter(mockApp, DEFAULT_SETTINGS);
      const result = adapter.isTemplaterAvailable();
      expect(result).toBe(false);
    });

    test('should get Templater instance when plugin available', () => {
      const templater = {
        settings: {},
        templater: {}
      };
      mockApp.plugins.plugins['templater-obsidian'] = templater;
      const adapter = new TemplaterAdapter(mockApp, DEFAULT_SETTINGS);
      const result = adapter.getTemplaterSettings();
      expect(result).toBe(templater.settings);
    });

    test('should get undefined instance when plugin missing', () => {
      delete mockApp.plugins.plugins['templater-obsidian'];
      const adapter = new TemplaterAdapter(mockApp, DEFAULT_SETTINGS);
      const result = adapter.getTemplaterSettings();
      expect(result).toEqual({folder_templates: [], file_templates: [], });
    });
  });

  describe('checkTemplaterConsistency', () => {
    test('should return warning when Templater enabled but plugin missing', async () => {
      const adapter = new TemplaterAdapter(mockApp, {...DEFAULT_SETTINGS});
      const result = await adapter.checkTemplaterConsistency();
      expect(result.isConsistent).toBe(false);
      expect(result.warnings).toContain('Templater plugin not found but integration is enabled');
    });

    test('should return consistent when Templater available and enabled', async () => {
      mockApp.plugins.plugins['templater-obsidian'] = {
        settings: {
          folder_templates: [
            {folder: '/', template: 'default-template.md'}  // Match the default folder mapping
          ],
          file_templates: []
        },
        templater: {}
      };
      const adapter = new TemplaterAdapter(mockApp, {...DEFAULT_SETTINGS});
      const result = await adapter.checkTemplaterConsistency();
      expect(result.isConsistent).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    test('should return warnings when folder mappings dont match Templater templates', async () => {
      mockApp.plugins.plugins['templater-obsidian'] = {
        settings: {
          file_templates: [{regex: 'Books/*', template: 'book-template.md'}],
          folder_templates: []
        },
        templater: {}
      };
      const settingsWithMappings = {
        ...DEFAULT_SETTINGS,
        enableTemplaterIntegration: true,
        folderFileClassMappings: [
          {folder: 'Articles/*', fileClass: 'article', moveToFolder: true}  // Different pattern
        ]
      };
      const adapter = new TemplaterAdapter(mockApp, settingsWithMappings);
      const result = await adapter.checkTemplaterConsistency();
      expect(result.isConsistent).toBe(false);
      expect(result.warnings).toContain('No matching Templater mapping found for folder pattern: Articles/*');
    });
  });

  describe('TemplaterAdapter methods', () => {
    beforeEach(() => {
      (window as any).moment = undefined; // Mock moment as undefined
    });

    afterEach(() => {
      delete (window as any).moment;
    });

    test('prompt should return default if Templater unavailable', async () => {
      const result = await templaterAdapter.prompt('Enter value', 'defaultVal');
      expect(result).toBe('defaultVal');
    });

    test('prompt should call Templater prompt if available', async () => {
      const mockPrompt = jest.fn().mockResolvedValue('userInput');
      mockApp.plugins.plugins['templater-obsidian'] = {prompt: mockPrompt};
      // Recreate adapter to pick up new plugin
      const adapter = new TemplaterAdapter(mockApp, {...DEFAULT_SETTINGS});
      const result = await adapter.prompt('Enter value', 'defaultVal');
      expect(mockPrompt).toHaveBeenCalledWith('Enter value');
      expect(result).toBe('userInput');
    });

    test('date should use Templater date if available', () => {
      const adapter = new TemplaterAdapter(mockApp, {...DEFAULT_SETTINGS});
      const result = adapter.formatDate(new Date(), 'YYYY-MM-DD');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('formatDate should fallback to ISO string if Templater not available', () => {
      const result = templaterAdapter.formatDate(new Date());
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('now should return formatted date', () => {
      const result = templaterAdapter.now('YYYY-MM-DD');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('tomorrow should return tomorrow\'s formatted date', () => {
      const today = new Date();
      today.setDate(today.getDate() + 1);
      const expected = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      const result = templaterAdapter.tomorrow('YYYY-MM-DD');
      expect(result).toContain(expected);
    });

    test('yesterday should return yesterday\'s formatted date', () => {
      const today = new Date();
      today.setDate(today.getDate() - 1);
      const expected = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      const result = templaterAdapter.yesterday('YYYY-MM-DD');
      expect(result).toContain(expected);
    });

    describe('getParentFile', () => {
      let obsidianAdapter: ObsidianAdapter;
      beforeEach(() => {
        obsidianAdapter = new ObsidianAdapter(mockApp, DEFAULT_SETTINGS);
      });
      afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
      });

      test('returns parent file from recentFileTracker if find_tfile is available', () => {
        const currentFile = ObsidianAdapter.createMockTFile('file.md');
        const activeFile = ObsidianAdapter.createMockTFile('file.md');
        const parentFileObj = ObsidianAdapter.createMockTFile('parent.md');
        mockApp.workspace = {
          getActiveFile: () => activeFile,
          recentFileTracker: {lastOpenFiles: ['file.md', 'parent.md']}
        };
        mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(parentFileObj);
        const adapter = new TemplaterAdapter(mockApp, {...DEFAULT_SETTINGS});
        const result = adapter.getParentFile(currentFile);
        expect(result).toBe(parentFileObj.path);
        expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith('parent.md');
        expectNoLogs();
      });

      test('returns activeFile if currentFile is not activeFile', () => {
        const currentFile = ObsidianAdapter.createMockTFile('file.md');
        const activeFile = ObsidianAdapter.createMockTFile('active.md');
        mockApp.workspace = {
          getActiveFile: () => activeFile
        };
        mockApp.plugins.plugins['templater-obsidian'] = {};
        const adapter = new TemplaterAdapter(mockApp, {...DEFAULT_SETTINGS});
        const result = adapter.getParentFile(currentFile);
        expect(result).toBe(activeFile.path);
        expectNoLogs();
      });

      test('returns null if parentFile path is same as currentFile path', () => {
        const currentFile = ObsidianAdapter.createMockTFile('file.md');
        const activeFile = ObsidianAdapter.createMockTFile('file.md');
        mockApp.workspace = {
          getActiveFile: () => activeFile,
          recentFileTracker: {lastOpenFiles: ['file.md', 'parent.md']}
        };
        mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
        const spy = jest.spyOn(console, 'debug').mockImplementation(() => { });
        const adapter = new TemplaterAdapter(mockApp, {...DEFAULT_SETTINGS, debugMode: true});
        const result = adapter.getParentFile(currentFile);
        expect(result).toBeNull();
        expect(spy).toHaveBeenCalledWith('Parent file not found in recent files, using active file as parent');
        expectNoLogs();
      });

      test('returns null if parentFile path is found but same as currentFile', () => {
        const currentFile = ObsidianAdapter.createMockTFile('file.md');
        const activeFile = ObsidianAdapter.createMockTFile('file.md');
        mockApp.workspace = {
          getActiveFile: () => activeFile,
          recentFileTracker: {lastOpenFiles: ['file.md', 'parent.md']}
        };
        mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(currentFile);
        const spy = jest.spyOn(console, 'debug').mockImplementation(() => { });
        const adapter = new TemplaterAdapter(mockApp, {...DEFAULT_SETTINGS, debugMode: true});
        const result = adapter.getParentFile(currentFile);
        expect(result).toBeNull();
        expect(spy).toHaveBeenCalledWith('Parent file is the same as current file, cannot deduce parent file');
        expectNoLogs();
      });
    });
  });
});
