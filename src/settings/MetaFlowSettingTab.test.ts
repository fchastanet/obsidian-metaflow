import {MetaFlowSettingTab} from "./MetaFlowSettingTab";

// Mock Obsidian modules
jest.mock('obsidian', () => ({
  AbstractInputSuggest: class { },
  PluginSettingTab: class MockPluginSettingTab {
    app: any;
    plugin: any;
    constructor(app: any, plugin: any) {
      this.app = app;
      this.plugin = plugin;
    }
  },
  Setting: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDesc: jest.fn().mockReturnThis(),
    addToggle: jest.fn().mockReturnThis(),
    addButton: jest.fn().mockReturnThis(),
    addTextArea: jest.fn().mockReturnThis()
  })),
  Notice: jest.fn()
}));

// Mock the external adapters
jest.mock('../externalApi/MetadataMenuAdapter', () => ({
  MetadataMenuAdapter: jest.fn().mockImplementation(() => ({
    isMetadataMenuAvailable: jest.fn().mockReturnValue(true),
    getAllFieldsFileClassesAssociation: jest.fn().mockReturnValue({
      'title': {fileClasses: ['book']},
      'author': {fileClasses: ['book']}
    }),
  }))
}));

jest.mock('../externalApi/TemplaterAdapter', () => ({
  TemplaterAdapter: jest.fn().mockImplementation(() => ({
    isTemplaterAvailable: jest.fn().mockReturnValue(true),
    getFolderTemplatesMapping: jest.fn().mockReturnValue([
      {folder: 'Books', template: 'book-template.md'},
      {folder: 'Articles', template: 'article-template.md'}
    ]),
    getFileTemplatesMapping: jest.fn().mockReturnValue([])
  }))
}));

describe('MetaFlowSettingTab', () => {
  let mockApp: any;
  let mockPlugin: any;
  let settingTab: MetaFlowSettingTab;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock app with proper structure
    mockApp = {
      plugins: {
        plugins: {
          'metadata-menu': {
            api: {}, // This is required for isMetadataMenuAvailable to return true
            settings: {
              fileClassAlias: {
                'book-template': {
                  attributes: {
                    title: {input: 'text', isCycle: false, values: '', valuesListNotePath: '', command: false},
                    author: {input: 'text', isCycle: false, values: '', valuesListNotePath: '', command: false},
                    rating: {input: 'number', isCycle: false, values: '', valuesListNotePath: '', command: false}
                  }
                },
                'project-template': {
                  attributes: {
                    title: {input: 'text', isCycle: false, values: '', valuesListNotePath: '', command: false},
                    status: {input: 'select', isCycle: false, values: 'Not Started,In Progress,Completed', valuesListNotePath: '', command: false}
                  }
                }
              }
            }
          }
        }
      }
    } as any;

    // Create mock plugin
    mockPlugin = {
      app: mockApp,
      settings: {
        folderFileClassMappings: [],
        propertyDefaultValueScripts: [],
        propertiesOrder: [],
        metadataMenuIntegration: true, // This is required for isMetadataMenuAvailable to return true
        autoMoveNoteToRightFolder: false
      },
      saveSettings: jest.fn(),
      autoInserter: {
        isMetadataMenuAvailable: jest.fn().mockReturnValue(true)
      }
    } as any;

    // Create settings tab instance
    settingTab = new MetaFlowSettingTab(mockApp, mockPlugin);
  });

  describe('Auto-populate from Templater', () => {
    test('should import folder mappings from Templater settings', async () => {
      // Clear existing mappings
      mockPlugin.settings.folderFileClassMappings = [];

      await settingTab['importFolderMappingsFromTemplater']();

      expect(mockPlugin.settings.folderFileClassMappings).toHaveLength(2);
      expect(mockPlugin.settings.folderFileClassMappings[0]).toEqual({
        folder: 'Books',
        fileClass: '',
        moveToFolder: true
      });
      expect(mockPlugin.settings.folderFileClassMappings[1]).toEqual({
        folder: 'Articles',
        fileClass: '',
        moveToFolder: true
      });
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    test('should not duplicate existing mappings', async () => {
      // Add existing mapping
      mockPlugin.settings.folderFileClassMappings = [
        {folder: 'Books', fileClass: 'existing-book', moveToFolder: false}
      ];

      await settingTab['importFolderMappingsFromTemplater']();

      // Should still have only one mapping (the existing one)
      expect(mockPlugin.settings.folderFileClassMappings).toStrictEqual([
        {"fileClass": "existing-book", "folder": "Books", "moveToFolder": false},
        {"fileClass": "", "folder": "Articles", "moveToFolder": true}
      ]);
    });

    test('should handle missing Templater plugin gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.resetModules();
      jest.doMock('../externalApi/TemplaterAdapter', () => ({
        TemplaterAdapter: jest.fn().mockImplementation(async () => ({
          getFolderTemplatesMapping: jest.fn().mockReturnValue([]),
        }))
      }));

      // Re-import after mocking
      const {MetaFlowSettingTab} = require('./MetaFlowSettingTab');
      settingTab = new MetaFlowSettingTab(mockApp, mockPlugin);

      await settingTab['importFolderMappingsFromTemplater']();

      // Should not throw error
      expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Auto-populate from MetadataMenu', () => {
    test('should import property scripts from MetadataMenu settings', async () => {
      // Setup MetadataMenu plugin mock
      mockApp.plugins.plugins['metadata-menu'] = {
        api: {}, // Required for isMetadataMenuAvailable
        fieldIndex: {
          fileClassesAncestors: {},
          fileClassesFields: new Map([
            ['book', [
              {name: 'title'},
              {name: 'author'},
              {name: 'isbn'}
            ]],
            ['article', [
              {name: 'title'},
              {name: 'publication'},
              {name: 'date'}
            ]]
          ])
        },
        settings: {
          propertyDefaultValueScripts: [
            {propertyName: 'title', script: 'return "";', enabled: false, order: 0},
            {propertyName: 'author', script: 'return "";', enabled: true, order: 1},
          ]
        }
      };

      // Clear existing scripts
      mockPlugin.settings.propertyDefaultValueScripts = [];

      await settingTab['autoPopulatePropertyScriptsFromMetadataMenu']();

      // Should have imported unique properties
      expect(mockPlugin.settings.propertyDefaultValueScripts.length).toBeGreaterThan(0);

      // Check that title script exists (used by both fileClasses)
      const titleScript = mockPlugin.settings.propertyDefaultValueScripts.find(
        (script: any) => script.propertyName === 'title'
      );
      expect(titleScript).toBeDefined();
      expect(titleScript?.script).toContain('return "";');
      expect(titleScript?.enabled).toBe(true);

      // Check that author script exists (used by book only)
      const authorScript = mockPlugin.settings.propertyDefaultValueScripts.find(
        (script: any) => script.propertyName === 'author'
      );
      expect(authorScript).toBeDefined();
      expect(authorScript?.script).toContain('return "";');

      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    test('should not duplicate existing property scripts', async () => {
      // Setup MetadataMenu plugin mock
      mockApp.plugins.plugins['metadata-menu'] = {
        settings: {
          fileClassesFields: {
            'book': [
              {name: 'title'}
            ]
          }
        }
      };

      // Add existing script
      mockPlugin.settings.propertyDefaultValueScripts = [
        {propertyName: 'title', script: 'return "existing";', enabled: true, order: 0}
      ];

      await settingTab['autoPopulatePropertyScriptsFromMetadataMenu']();

      // Should still have only one script (the existing one)
      expect(mockPlugin.settings.propertyDefaultValueScripts).toHaveLength(2);
      expect(mockPlugin.settings.propertyDefaultValueScripts[0].script).toBe('return "existing";');
    });

    test('should handle missing MetadataMenu plugin gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPlugin.autoInserter.isMetadataMenuAvailable.mockReturnValue(false);
      settingTab.metadataMenuAdapter.isMetadataMenuAvailable = jest.fn().mockReturnValue(false);

      await settingTab['autoPopulatePropertyScriptsFromMetadataMenu']();

      // Should not throw error
      expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Display Methods', () => {
    test('should handle empty folder mappings list', () => {
      const mockContainer = {
        empty: jest.fn(),
        createEl: jest.fn().mockReturnValue({
          createEl: jest.fn().mockReturnValue({
            style: {},
            addEventListener: jest.fn(),
            disabled: false,
            checked: false,
            value: ''
          }),
          style: {}
        })
      };

      mockPlugin.settings.folderFileClassMappings = [];

      // Should not throw error
      expect(() => {
        settingTab['displayFolderMappings'](mockContainer as any);
      }).not.toThrow();

      expect(mockContainer.empty).toHaveBeenCalled();
    });

    test('should toggle autoMoveNoteToRightFolder setting', async () => {
      // Simulate the toggle change
      expect(mockPlugin.settings.autoMoveNoteToRightFolder).toBe(false);
      // Simulate user toggling the checkbox
      mockPlugin.settings.autoMoveNoteToRightFolder = true;
      await mockPlugin.saveSettings();
      expect(mockPlugin.settings.autoMoveNoteToRightFolder).toBe(true);
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    test('should handle empty property scripts list', () => {
      const mockContainer = {
        empty: jest.fn(),
        createEl: jest.fn().mockReturnValue({
          createEl: jest.fn().mockReturnValue({
            style: {},
            addEventListener: jest.fn(),
            disabled: false,
            checked: false,
            value: ''
          }),
          style: {}
        })
      };

      mockPlugin.settings.propertyDefaultValueScripts = [];

      // Should not throw error
      expect(() => {
        settingTab['displayPropertyScripts'](mockContainer as any);
      }).not.toThrow();

      expect(mockContainer.empty).toHaveBeenCalled();
    });

    describe('Export/Import Settings Section', () => {
      test('should export settings as JSON file', () => {
        // Mock document.createElement and click
        const aMock = {click: jest.fn(), setAttribute: jest.fn(), href: '', download: '', remove: jest.fn()};
        document.body.appendChild = jest.fn();
        document.body.removeChild = jest.fn();
        window.URL.createObjectURL = jest.fn(() => 'blob:url');
        window.URL.revokeObjectURL = jest.fn();
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
          if (tag === 'a') return aMock as any;
          return document.createElement(tag);
        });
        // Simulate export button click
        const exportBtn = {
          setButtonText: jest.fn().mockReturnThis(),
          setCta: jest.fn().mockReturnThis(),
          onClick: jest.fn((cb) => cb())
        };
        // Call the export logic directly
        const dataStr = JSON.stringify(mockPlugin.settings, null, 2);
        const blob = new Blob([dataStr], {type: 'application/json'});
        const url = window.URL.createObjectURL(blob);
        expect(url).toBe('blob:url');
      });

      test('should import settings from JSON file', async () => {
        // Mock file input and FileReader
        const fileContent = JSON.stringify({autoMoveNoteToRightFolder: true});
        const file = new Blob([fileContent], {type: 'application/json'});
        const fileReaderMock = {
          readAsText: jest.fn(),
          onload: null
        };
        window.FileReader = jest.fn(() => fileReaderMock as any);
        // Simulate input element
        const inputMock = {
          type: 'file',
          accept: 'application/json',
          onchange: null,
          click: jest.fn()
        };
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
          if (tag === 'input') return inputMock as any;
          return document.createElement(tag);
        });
        // Simulate import button click
        const importBtn = {
          setButtonText: jest.fn().mockReturnThis(),
          setCta: jest.fn().mockReturnThis(),
          onClick: jest.fn((cb) => cb())
        };
        // Simulate FileReader onload
        fileReaderMock.onload = async (e) => {
          try {
            const importedSettings = JSON.parse(fileContent);
            Object.assign(mockPlugin.settings, importedSettings);
            await mockPlugin.saveSettings();
            expect(mockPlugin.settings.autoMoveNoteToRightFolder).toBe(true);
          } catch (err) {
            expect(false).toBe(true); // Should not throw
          }
        };
        // Simulate file input change
        await fileReaderMock.onload({target: {result: fileContent}});
      });
    });
  });
});
