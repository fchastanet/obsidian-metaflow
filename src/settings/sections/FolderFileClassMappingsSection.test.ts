/**
 * @jest-environment jsdom
 */
import {ObsidianAdapter} from "../../externalApi/ObsidianAdapter";
import {FolderFileClassMappingsSection} from "./FolderFileClassMappingsSection";
import {MetadataMenuAdapter} from "../../externalApi/MetadataMenuAdapter";
import {TemplaterAdapter} from "../../externalApi/TemplaterAdapter";
import {LogNoticeManager} from "../../managers/LogNoticeManager";

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

jest.mock('../modals/FileClassAvailableFieldsHelpModal.ts', () => ({
  FileClassAvailableFieldsHelpModal: jest.fn().mockImplementation(() => ({
    open: jest.fn()
  }))
}));

describe('FolderFileClassMappingsSection', () => {
  let mockApp: any;
  let mockPlugin: any;
  let folderFileClassMappingsSection: FolderFileClassMappingsSection;

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
    folderFileClassMappingsSection = getFolderFileClassMappingsSection();
  });

  function getFolderFileClassMappingsSection(): FolderFileClassMappingsSection {
    const obsidianAdapter = new ObsidianAdapter(mockApp, mockPlugin.settings);
    return new FolderFileClassMappingsSection(
      mockApp,
      document.createElement('div'),
      mockPlugin.settings.folderFileClassMappings,
      obsidianAdapter,
      new MetadataMenuAdapter(mockApp, mockPlugin.settings),
      new TemplaterAdapter(mockApp, mockPlugin.settings),
      new LogNoticeManager(obsidianAdapter),
      jest.fn() // Mock saveSettings function
    );
  }

  describe('Auto-populate from Templater', () => {
    test('should import folder mappings from Templater settings', async () => {
      // Clear existing mappings
      mockPlugin.settings.folderFileClassMappings = [];

      await folderFileClassMappingsSection['importFolderMappingsFromTemplater']();

      const folderFileClassMappings = folderFileClassMappingsSection['folderFileClassMappings'];
      expect(folderFileClassMappings).toHaveLength(2);
      expect(folderFileClassMappings[0]).toEqual({
        folder: 'Books',
        fileClass: '',
        moveToFolder: true,
        noteTitleTemplates: []
      });
      expect(folderFileClassMappings[1]).toEqual({
        folder: 'Articles',
        fileClass: '',
        moveToFolder: true,
        noteTitleTemplates: []
      });
      expect(folderFileClassMappingsSection['onChange']).toHaveBeenCalled();
    });

    test('should not duplicate existing mappings', async () => {
      // Add existing mapping
      mockPlugin.settings.folderFileClassMappings = [
        {folder: 'Books', fileClass: 'existing-book', moveToFolder: false, noteTitleTemplates: []}
      ];
      folderFileClassMappingsSection = getFolderFileClassMappingsSection();

      await folderFileClassMappingsSection['importFolderMappingsFromTemplater']();

      // Should still have only one mapping (the existing one)
      const folderFileClassMappings = folderFileClassMappingsSection['folderFileClassMappings'];
      expect(folderFileClassMappings).toStrictEqual([
        {"fileClass": "existing-book", "folder": "Books", "moveToFolder": false, "noteTitleTemplates": []},
        {"fileClass": "", "folder": "Articles", "moveToFolder": true, "noteTitleTemplates": []}
      ]);
    });

    test('should handle missing Templater plugin gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.resetModules();
      jest.doMock('../../externalApi/TemplaterAdapter', () => ({
        TemplaterAdapter: jest.fn().mockImplementation(async () => ({
          getFolderTemplatesMapping: jest.fn().mockReturnValue([]),
        }))
      }));

      // Re-import after mocking
      const {MetaFlowSettingTab} = require('../MetaFlowSettingTab');
      folderFileClassMappingsSection = getFolderFileClassMappingsSection();
      await folderFileClassMappingsSection['importFolderMappingsFromTemplater']();

      // Should not throw error
      expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

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
        folderFileClassMappingsSection['displayFolderMappings'](mockContainer as any);
      }).not.toThrow();

      expect(mockContainer.empty).toHaveBeenCalled();
    });
  });

});
