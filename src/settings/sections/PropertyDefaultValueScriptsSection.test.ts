/**
 * @jest-environment jsdom
 */
import {PropertyDefaultValueScriptsSection} from "./PropertyDefaultValueScriptsSection";

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
jest.mock('../../externalApi/MetadataMenuAdapter', () => ({
  MetadataMenuAdapter: jest.fn().mockImplementation(() => ({
    isMetadataMenuAvailable: jest.fn().mockReturnValue(true),
    getAllFieldsFileClassesAssociation: jest.fn().mockReturnValue({
      'title': {fileClasses: ['book']},
      'author': {fileClasses: ['book']}
    }),
  }))
}));

jest.mock('../../externalApi/TemplaterAdapter', () => ({
  TemplaterAdapter: jest.fn().mockImplementation(() => ({
    isTemplaterAvailable: jest.fn().mockReturnValue(true),
    getFolderTemplatesMapping: jest.fn().mockReturnValue([
      {folder: 'Books', template: 'book-template.md'},
      {folder: 'Articles', template: 'article-template.md'}
    ]),
    getFileTemplatesMapping: jest.fn().mockReturnValue([])
  }))
}));

describe('PropertyDefaultValueScriptsSection', () => {
  let mockApp: any;
  let mockPlugin: any;
  let mockMetadataMenuAdapter: any;
  let propertyDefaultValueScriptsSection: PropertyDefaultValueScriptsSection;

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

    mockMetadataMenuAdapter = {
      isMetadataMenuAvailable: jest.fn().mockReturnValue(true),
      getFileClassByName: jest.fn().mockResolvedValue({
        name: 'default',
        fields: []
      }),
      getAllFieldsFileClassesAssociation: jest.fn().mockReturnValue(
        {
          title: {fileClasses: ['book']},
          author: {fileClasses: ['book']},
          isbn: {fileClasses: ['book']},
          publication: {fileClasses: ['article']},
          date: {fileClasses: ['article']}
        }
      ),
      syncFields: jest.fn().mockImplementation((frontmatter) => frontmatter),
      getFileClassAlias: jest.fn().mockReturnValue('fileClass'),
      getFileClassAndAncestorsFields: jest.fn().mockReturnValue([
        {name: 'title', type: 'string'},
        {name: 'author', type: 'number'},
      ])
    };

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
    propertyDefaultValueScriptsSection = getPropertyDefaultValueScriptsSection();
  });

  function getPropertyDefaultValueScriptsSection() {
    return new PropertyDefaultValueScriptsSection(
      mockApp,
      document.createElement("div"),
      mockPlugin.settings,
      mockMetadataMenuAdapter,
      jest.fn()
    );
  }

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
      };

      // Clear existing scripts
      mockPlugin.settings.propertyDefaultValueScripts = [
        {propertyName: 'title', script: 'return "";', enabled: false, order: 0},
        {propertyName: 'author', script: 'return "";', enabled: true, order: 1},
      ];
      propertyDefaultValueScriptsSection = getPropertyDefaultValueScriptsSection();

      propertyDefaultValueScriptsSection['autoPopulatePropertyScriptsFromMetadataMenu']();

      // Should have imported unique properties
      const propertyDefaultValueScripts = propertyDefaultValueScriptsSection['settings'].propertyDefaultValueScripts;
      expect(propertyDefaultValueScripts.length).toBeGreaterThan(0);

      // Check that title script exists (used by both fileClasses)
      const titleScript = propertyDefaultValueScripts.find(
        (script: any) => script.propertyName === 'title'
      );
      expect(titleScript).toBeDefined();
      expect(titleScript?.script).toContain('return "";');
      expect(titleScript?.enabled).toBe(false);

      // Check that author script exists (used by book only)
      const authorScript = propertyDefaultValueScripts.find(
        (script: any) => script.propertyName === 'author'
      );
      expect(authorScript).toBeDefined();
      expect(authorScript?.script).toContain('return "";');

      expect(propertyDefaultValueScriptsSection['onChange']).toHaveBeenCalled();
    });

    test('should not duplicate existing property scripts', async () => {
      // Add existing script
      mockPlugin.settings.propertyDefaultValueScripts = [
        {propertyName: 'title', script: 'return "existing";', enabled: true, order: 0}
      ];
      propertyDefaultValueScriptsSection = getPropertyDefaultValueScriptsSection();

      await propertyDefaultValueScriptsSection['autoPopulatePropertyScriptsFromMetadataMenu']();

      // Should still have only one script (the existing one)
      expect(mockPlugin.settings.propertyDefaultValueScripts).toEqual(
        [
          {"enabled": true, "fileClasses": ["book"], "order": 0, "propertyName": "title", "script": "return \"existing\";"},
          {"enabled": true, "fileClasses": ["book"], "order": 1, "propertyName": "author", "script": "return \"\";"},
          {"enabled": true, "fileClasses": ["book"], "order": 2, "propertyName": "isbn", "script": "return \"\";"},
          {"enabled": true, "fileClasses": ["article"], "order": 3, "propertyName": "publication", "script": "return \"\";"},
          {"enabled": true, "fileClasses": ["article"], "order": 4, "propertyName": "date", "script": "return \"\";"}
        ]
      );
      expect(mockPlugin.settings.propertyDefaultValueScripts[0].script).toBe('return "existing";');
    });

    test('should handle missing MetadataMenu plugin gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPlugin.autoInserter.isMetadataMenuAvailable.mockReturnValue(false);
      propertyDefaultValueScriptsSection['metadataMenuAdapter'].isMetadataMenuAvailable = jest.fn().mockReturnValue(false);

      await propertyDefaultValueScriptsSection['autoPopulatePropertyScriptsFromMetadataMenu']();

      // Should not throw error
      expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
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
      propertyDefaultValueScriptsSection = getPropertyDefaultValueScriptsSection();

      // Should not throw error
      expect(() => {
        propertyDefaultValueScriptsSection['displayPropertyScripts'](mockContainer as any);
      }).not.toThrow();

      expect(mockContainer.empty).toHaveBeenCalled();
    });
  });
});
