/**
 * @jest-environment jsdom
 */
import {ObsidianAdapter} from "@metaflow/externalApi/ObsidianAdapter";
import {FolderFileClassMappingsSection} from "./FolderFileClassMappingsSection";
import {MetadataMenuAdapter} from "@metaflow/externalApi/MetadataMenuAdapter";
import {TemplaterAdapter} from "@metaflow/externalApi/TemplaterAdapter";
import {LogNoticeManager} from "@metaflow/managers/LogNoticeManager";
import {TemplateMode} from "../types";
import {TFile} from "obsidian";

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
/*
jest.mock('../../externalApi/TemplaterAdapter', () => ({
  TemplaterAdapter: jest.fn().mockImplementation(() => ({
    isTemplaterAvailable: jest.fn().mockReturnValue(true),
    getFolderTemplatesMapping: jest.fn().mockReturnValue([
      {folder: 'Books', template: 'book-template.md'},
      {folder: 'Articles', template: 'article-template.md'}
    ]),
    getFileTemplatesMapping: jest.fn().mockReturnValue([])
  }))
}));*/

jest.mock('../modals/FileClassAvailableFieldsHelpModal.ts', () => ({
  FileClassAvailableFieldsHelpModal: jest.fn().mockImplementation(() => ({
    open: jest.fn()
  }))
}));

jest.mock('../modals/CompletionsHelpModal.ts', () => ({
  CompletionsHelpModal: jest.fn().mockImplementation(() => ({
    open: jest.fn()
  }))
}));

describe('FolderFileClassMappingsSection', () => {
  let mockApp: any;
  let mockPlugin: any;
  let folderFileClassMappingsSection: FolderFileClassMappingsSection;
  let mockLogNoticeManager: jest.Mocked<LogNoticeManager>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock app with proper structure
    mockApp = {
      vault: {
        getAbstractFileByPath: jest.fn().mockImplementation((path: string) => {
          const mockFile = Object.create(TFile.prototype);
          Object.assign(mockFile, {
            name: 'test.md',
            basename: 'test',
            extension: 'md',
            path: 'test.md',
            parent: {path: ''}
          });
          if (path === 'book-template.md') {

            return  mockFile;
          } else if (path === 'article-template.md') {
            return  mockFile;
          }
          return null;
        }),
        read: jest.fn().mockImplementation((file: any) => {
          if (file.path === 'book-template.md') {
            return Promise.resolve('---\nfileClass: book\n---\nBook content');
          } else if (file.path === 'article-template.md') {
            return Promise.resolve('---\nfileClass: article\n---\nArticle content');
          }
          return Promise.reject(new Error('File not found'));
        })
      },
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

    mockLogNoticeManager = {
      addInfo: jest.fn(),
      addWarning: jest.fn(),
      addError: jest.fn()
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

  function getFolderFileClassMappingsSection(templateAdapter: TemplaterAdapter | null = null): FolderFileClassMappingsSection {
    const obsidianAdapter = new ObsidianAdapter(mockApp, mockPlugin.settings);
    return new FolderFileClassMappingsSection(
      mockApp,
      document.createElement('div'),
      mockPlugin.settings.folderFileClassMappings,
      obsidianAdapter,
      new MetadataMenuAdapter(mockApp, mockPlugin.settings, mockLogNoticeManager),
      templateAdapter ?? new TemplaterAdapter(mockApp, mockPlugin.settings, obsidianAdapter),
      new LogNoticeManager(obsidianAdapter),
      jest.fn() // Mock saveSettings function
    );
  }

  describe('getFolderFileClassMappings', () => {
    test('should return folder mappings from Templater settings', () => {
      const msgs: any[] = [];
      folderFileClassMappingsSection['tryToGetFileClassesFromMetadataMenu'] = jest.fn().mockReturnValue([
        'book', 'article'
      ]);
      const mappings = folderFileClassMappingsSection['getFolderFileClassMappings'](msgs);
      expect(mappings).toEqual([
        {folder: '', fileClass: 'article', moveToFolder: false, noteTitleTemplates: [], noteTitleScript: {script: 'return "";', enabled: true}, templateMode: 'template' as TemplateMode},
        {folder: '', fileClass: 'book', moveToFolder: false, noteTitleTemplates: [], noteTitleScript: {script: 'return "";', enabled: true}, templateMode: 'template' as TemplateMode},
      ]);
      expect(msgs).toEqual([
        {"level": "info", "text": "Folder mapping for fileClass book does not exist, adding default mapping"},
        {"level": "info", "text": "Folder mapping for fileClass article does not exist, adding default mapping"},
      ]);
    });

    test('should not duplicate existing mappings', async () => {
      // Add existing mapping
      folderFileClassMappingsSection['folderFileClassMappings'] = [
        {folder: 'Books', fileClass: 'book', moveToFolder: false, noteTitleTemplates: [], noteTitleScript: {script: 'return "";', enabled: true}, templateMode: 'template'},
        // folder: 'Citations' should be removed as file class is not found in MetadataMenu
        {folder: 'Citations', fileClass: 'citation', moveToFolder: false, noteTitleTemplates: [], noteTitleScript: {script: 'return "";', enabled: true}, templateMode: 'template'}
      ];
      const msgs: any[] = [];
      folderFileClassMappingsSection['tryToGetFileClassesFromMetadataMenu'] = jest.fn().mockReturnValue([
        'book', 'article'
      ]);
      const mappings = folderFileClassMappingsSection['getFolderFileClassMappings'](msgs);
      expect(mappings).toEqual([
        {folder: '', fileClass: 'article', moveToFolder: false, noteTitleTemplates: [], noteTitleScript: {script: 'return "";', enabled: true}, templateMode: 'template' as TemplateMode},
        {folder: 'Books', fileClass: 'book', moveToFolder: false, noteTitleTemplates: [], noteTitleScript: {script: 'return "";', enabled: true}, templateMode: 'template' as TemplateMode},
      ]);
      expect(msgs).toEqual([
        {"level": "warning", "text": "Citations - Folder mapping for fileClass citation does not exist, skipping"},
        {"level": "info", "text": "Folder mapping for fileClass article does not exist, adding default mapping"}
      ]);
    });
  });

  describe('importFolderMappingsFromTemplater - Auto-populate from Templater', () => {
    test('should import folder mappings from Templater settings', async () => {
      folderFileClassMappingsSection['getFileClassFromFileFrontmatter'] = jest.fn().mockImplementation((path: string) => {
        if (path === 'book-template.md') {
          return 'book';
        } else if (path === 'article-template.md') {
          return 'article';
        }
        return null;
      });
      folderFileClassMappingsSection['folderFileClassMappings'] = [
        {folder: 'Books', fileClass: '', moveToFolder: true, noteTitleTemplates: [], noteTitleScript: {script: 'return "";', enabled: true}, templateMode: 'template' as TemplateMode},
        {folder: 'Articles', fileClass: '', moveToFolder: true, noteTitleTemplates: [], noteTitleScript: {script: 'return "";', enabled: true}, templateMode: 'template' as TemplateMode}
      ];
      folderFileClassMappingsSection['getFolderFileClassMappings'] = jest.fn().mockReturnValue([
        {folder: 'Books', template: 'templateBooksPath'},
        {folder: 'Articles', template: 'templateArticlesPath'}
      ]);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const templaterAdapter = require('../../externalApi/TemplaterAdapter').TemplaterAdapter;
      templaterAdapter['isTemplaterAvailable'] = jest.fn().mockReturnValue(true);
      templaterAdapter['getFolderTemplatesMapping'] = jest.fn().mockReturnValue([
        {folder: 'Books', template: 'book-template.md'},
        {folder: 'Articles', template: 'article-template.md'}
      ]);
      folderFileClassMappingsSection['templaterAdapter'] = templaterAdapter;

      const msgs: any[] = [];
      await folderFileClassMappingsSection['importFolderMappingsFromTemplater'](msgs);

      expect(folderFileClassMappingsSection['folderFileClassMappings']).toEqual([
        {
          folder: 'Books',
          fileClass: '',
          moveToFolder: true,
          noteTitleTemplates: [],
          noteTitleScript: {
            script: 'return "";',
            enabled: true
          },
          templateMode: 'template'
        },
        {
          folder: 'Articles',
          fileClass: '',
          moveToFolder: true,
          noteTitleTemplates: [],
          noteTitleScript: {
            script: 'return "";',
            enabled: true
          },
          templateMode: 'template'
        }
      ]);
      // This block seems to be an accidental duplicate and should be removed.
      expect(folderFileClassMappingsSection['onChange']).toHaveBeenCalled();
      expect(msgs).toEqual([
        {"level": "info", "text": "Books - Folder mapping for fileClass book does not exist, skipping",},
        {"level": "info", "text": "Articles - Folder mapping for fileClass article does not exist, skipping",},
        {"level": "success", "text": "Imported 0 folder mappings from Templater",},
      ]);

    });
    test('should handle missing Templater plugin gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const templaterAdapter = new TemplaterAdapter(
        mockApp, mockPlugin.settings, new ObsidianAdapter(mockApp, mockPlugin.settings)
      );
      templaterAdapter['isTemplaterAvailable'] = jest.fn().mockReturnValue(false);

      // Re-import after mocking
      folderFileClassMappingsSection = getFolderFileClassMappingsSection(templaterAdapter);
      folderFileClassMappingsSection['getFolderFileClassMappings'] = jest.fn().mockReturnValue([
        {folder: 'Books', template: 'templateBooksPath'},
      ]);
      const msgs: any[] = [];
      await folderFileClassMappingsSection['importFolderMappingsFromTemplater'](msgs);

      // Should not throw error
      expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
      expect(msgs).toEqual([
        { "level": "warning", "text": "Templater plugin not found but integration is enabled" },
        { "level": "success", "text": "Imported 0 folder mappings from Templater" },
      ]);
    });
  });

  describe('displayFolderMappings', () => {
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
      const msgs: any[] = [];
      // Should not throw error
      expect(() => {
        folderFileClassMappingsSection['displayFolderMappings'](mockContainer as any, msgs);
      }).not.toThrow();

      expect(mockContainer.empty).not.toHaveBeenCalled();
    });
  });
});
