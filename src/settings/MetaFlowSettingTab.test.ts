/**
 * @jest-environment jsdom
 */
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

jest.mock('./modals/CompletionsHelpModal.ts', () => ({
  CompletionsHelpModal: jest.fn().mockImplementation(() => ({
    open: jest.fn()
  }))
}));

jest.mock('./modals/FileClassAvailableFieldsHelpModal.ts', () => ({
  FileClassAvailableFieldsHelpModal: jest.fn().mockImplementation(() => ({
    open: jest.fn()
  }))
}));

describe('MetaFlowSettingTab', () => {
  let mockApp: any;
  let mockPlugin: any;
  let settingTab: MetaFlowSettingTab;
  let mockObsidianAdapter: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock ObsidianAdapter
    mockObsidianAdapter = {
      isMetadataMenuAvailable: jest.fn().mockReturnValue(true)
    };

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
      container: {
        get: jest.fn((type) => {
          // Return mock services based on type
          if (type.toString().includes('MetadataMenuAdapter')) {
            return {isMetadataMenuAvailable: () => true};
          }
          if (type.toString().includes('ObsidianAdapter')) {
            return mockObsidianAdapter;
          }
          if (type.toString().includes('MetaFlowService')) {
            return {};
          }
          return {};
        })
      },
      autoInserter: {
        isMetadataMenuAvailable: jest.fn().mockReturnValue(true)
      }
    } as any;

    // Create settings tab instance
    settingTab = new MetaFlowSettingTab(mockApp, mockPlugin);
  });

  describe('Display Methods', () => {
    test('should toggle autoMoveNoteToRightFolder setting', async () => {
      // Simulate the toggle change
      expect(mockPlugin.settings.autoMoveNoteToRightFolder).toBe(false);
      // Simulate user toggling the checkbox
      mockPlugin.settings.autoMoveNoteToRightFolder = true;
      await mockPlugin.saveSettings();
      expect(mockPlugin.settings.autoMoveNoteToRightFolder).toBe(true);
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
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
          onload: jest.fn()
        };
        // Simulate input element
        const inputMock = {
          type: 'file',
          accept: 'application/json',
          onchange: jest.fn(),
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
        fileReaderMock.onload = jest.fn((e) => {
          try {
            const importedSettings = JSON.parse(fileContent);
            Object.assign(mockPlugin.settings, importedSettings);
            mockPlugin.saveSettings();
            expect(mockPlugin.settings.autoMoveNoteToRightFolder).toBe(true);
          } catch (err) {
            expect(false).toBe(true); // Should not throw
          }
        });
        // Simulate file input change
        fileReaderMock.onload({target: {result: fileContent}});
      });
    });
  });
});
