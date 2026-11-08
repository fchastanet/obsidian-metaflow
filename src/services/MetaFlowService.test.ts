import {FileStats, TFile} from 'obsidian';
import {MetaFlowService} from './MetaFlowService';
import {DEFAULT_SETTINGS} from '@metaflow/settings/defaultSettings';
import {LogNoticeManagerInterface} from '@metaflow/managers/types';
import {Utils} from '@metaflow/utils/Utils';
import {MetaFlowSettings} from '@metaflow/settings/types';

// Mock Obsidian modules
jest.mock('obsidian', () => ({
  Notice: jest.fn(),
  TFile: jest.fn(),
  TFolder: jest.fn(),
  normalizePath: jest.fn().mockImplementation((path: string) => path.replace(/\\/g, '/')),
}));

// Mock Utils module
jest.mock('@metaflow/utils/Utils', () => ({
  Utils: {
    sleep: jest.fn()
  }
}));

describe('MetaFlowService', () => {
  let mockApp: any;
  let metaFlowService: MetaFlowService;
  let mockFile: TFile;
  let mockLogNoticeManager: LogNoticeManagerInterface;
  let mockSettings: MetaFlowSettings;

  // Mock services
  let mockMetadataMenuAdapter: any;
  let mockFrontMatterService: any;
  let mockFileValidationService: any;
  let mockFileClassDeductionService: any;
  let mockPropertyManagementService: any;
  let mockFileOperationsService: any;
  let mockNoteTitleService: any;
  let mockFileStateCache: any;

  beforeEach(() => {
    // Setup mock settings
    mockSettings = {...DEFAULT_SETTINGS};

    // Setup mock app
    mockApp = {
      plugins: {
        enabledPlugins: new Map([['metadata-menu', true]]),
        plugins: {
          'metadata-menu': {
            api: {},
            settings: {
              fileClassAlias: 'fileClass',
            },
          },
          'templater-obsidian': {
            settings: {},
          },
        },
      },
      vault: {
        getName: jest.fn().mockReturnValue('TestVault'),
        exists: jest.fn().mockReturnValue(false),
        rename: jest.fn().mockResolvedValue({} as TFile),
        createFolder: jest.fn().mockResolvedValue({}),
        getFolderByPath: jest.fn().mockReturnValue({}),
      },
      fileManager: {
        processFrontMatter: jest.fn().mockImplementation((file: any, callback: any) => {
          const frontmatter = {};
          callback(frontmatter);
          return Promise.resolve();
        }),
      },
      workspace: {},
    };

    // Setup mock services
    mockMetadataMenuAdapter = {
      isMetadataMenuAvailable: jest.fn().mockReturnValue(true),
      getFileClassAlias: jest.fn().mockReturnValue('fileClass'),
      getFileClassAndAncestorsFields: jest.fn().mockReturnValue([]),
      syncFields: jest.fn().mockImplementation((frontmatter) => frontmatter),
      getFileClassByName: jest.fn().mockReturnValue({}),
      getFileClassFromMetadata: jest.fn().mockReturnValue('default'),
    };

    mockFrontMatterService = {
      parseFrontmatter: jest.fn().mockImplementation((content: string) => {
        if (content.includes('fileClass: book')) {
          return {
            metadata: {fileClass: 'book', title: 'Test'},
            body: 'Content'
          };
        }
        return {metadata: {}, body: content};
      }),
      serializeFrontmatter: jest.fn().mockReturnValue('---\nfileClass: book\ntitle: Test\n---\nContent'),
    };

    mockFileValidationService = {
      checkIfAutomaticMetadataInsertionEnabled: jest.fn(),
      checkIfMetadataInsertionApplicable: jest.fn(),
      checkIfValidFile: jest.fn(),
      checkIfExcluded: jest.fn(),
    };

    mockFileClassDeductionService = {
      getFileClassFromContent: jest.fn().mockReturnValue('book'),
      getFileClassFromMetadata: jest.fn().mockImplementation((metadata) => {
        if (metadata === null || metadata === undefined) return null;
        return metadata.fileClass || 'article';
      }),
      deduceFileClassFromPath: jest.fn().mockReturnValue('default'),
      validateFileClassAgainstMapping: jest.fn().mockReturnValue(true),
    };

    mockPropertyManagementService = {
      sortProperties: jest.fn().mockImplementation((frontmatter) => frontmatter),
      addDefaultValuesToProperties: jest.fn().mockImplementation((frontmatter) => frontmatter),
    };

    // Create a proper mock TFile instance
    mockFile = Object.create(TFile.prototype);
    Object.assign(mockFile, {
      name: 'test.md',
      basename: 'test',
      extension: 'md',
      path: 'test.md',
      parent: {path: ''},
      stat: {} as FileStats,
    });

    mockFileOperationsService = {
      updateFrontmatter: jest.fn().mockResolvedValue(undefined),
      renameNote: jest.fn().mockResolvedValue(undefined),
      moveNoteToTheRightFolder: jest.fn().mockResolvedValue('new/path/test.md'),
      getNewNoteTitle: jest.fn().mockReturnValue('Generated Title'),
      getNewNoteFolder: jest.fn().mockReturnValue('/Books'),
      applyFileChanges: jest.fn().mockResolvedValue(mockFile),
    };

    mockNoteTitleService = {
      formatNoteTitle: jest.fn().mockReturnValue('Generated Title'),
    };

    mockLogNoticeManager = {
      addDebug: jest.fn(),
      addInfo: jest.fn(),
      addWarning: jest.fn(),
      addError: jest.fn(),
      addMessage: jest.fn(),
    };

    mockFileStateCache = {
      getState: jest.fn(),
      setState: jest.fn(),
      popState: jest.fn(),
    };

    // Create MetaFlowService with all dependencies
    metaFlowService = new MetaFlowService(
      mockApp,
      mockSettings,
      mockMetadataMenuAdapter,
      mockFrontMatterService,
      mockFileValidationService,
      mockFileClassDeductionService,
      mockPropertyManagementService,
      mockFileOperationsService,
      mockNoteTitleService,
      mockLogNoticeManager,
      mockFileStateCache,
    );
  });

  describe('Basic Service Functionality', () => {
    test('should be instantiated correctly', () => {
      expect(metaFlowService).toBeDefined();
      expect(metaFlowService).toBeInstanceOf(MetaFlowService);
    });

    test('should get file class from content via fileClassDeductionService', () => {
      const content = '---\nfileClass: book\n---\nContent';
      const result = mockFileClassDeductionService.getFileClassFromContent(content);
      expect(result).toBe('book');
    });

    test('should get file class from metadata via fileClassDeductionService', () => {
      const metadata = {fileClass: 'article', title: 'Test'};
      const result = mockFileClassDeductionService.getFileClassFromMetadata(metadata);
      expect(result).toBe('article');
    });

    test('should handle null metadata via fileClassDeductionService', () => {
      expect(mockFileClassDeductionService.getFileClassFromMetadata(null)).toBe(null);
      expect(mockFileClassDeductionService.getFileClassFromMetadata(undefined)).toBe(null);
    });

    test('should get frontmatter from content', () => {
      const content = '---\nfileClass: book\ntitle: Test\n---\nContent';
      const result = metaFlowService.getFrontmatterFromContent(content);
      expect(result).toEqual({fileClass: 'book', title: 'Test'});
    });

    test('should handle null frontmatter content', () => {
      const content = 'No frontmatter here';
      const result = metaFlowService.getFrontmatterFromContent(content);
      expect(result).toEqual({});
    });
  });

  describe('processContent', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should process content with existing fileClass', () => {
      mockMetadataMenuAdapter.getFileClassFromMetadata.mockReturnValue('book');
      mockMetadataMenuAdapter.syncFields.mockReturnValue({
        frontmatter: {fileClass: 'book', title: 'Test'},
        addedFields: []
      });

      const content = '---\nfileClass: book\ntitle: Test\n---\nContent';
      const result = metaFlowService.processContent(content, mockFile);

      expect(mockFileValidationService.checkIfMetadataInsertionApplicable).toHaveBeenCalledWith(mockFile);
      expect(mockMetadataMenuAdapter.getFileClassByName).toHaveBeenCalledWith('book');
      expect(result).toBe('---\nfileClass: book\ntitle: Test\n---\nContent');
    });

    test('should deduce fileClass when not present in metadata', () => {
      mockMetadataMenuAdapter.getFileClassFromMetadata.mockReturnValue(null);
      mockFileClassDeductionService.deduceFileClassFromPath.mockReturnValue('article');
      mockMetadataMenuAdapter.syncFields.mockReturnValue({
        frontmatter: {fileClass: 'article'},
        addedFields: []
      });

      const content = '---\ntitle: Test\n---\nContent';
      const result = metaFlowService.processContent(content, mockFile);

      expect(mockFileClassDeductionService.deduceFileClassFromPath).toHaveBeenCalledWith(mockFile.path);
      expect(mockFileClassDeductionService.validateFileClassAgainstMapping).toHaveBeenCalledWith(mockFile.path, 'article');
      expect(result).toBeDefined();
    });

    test('should throw error when no fileClass can be deduced', () => {
      mockMetadataMenuAdapter.getFileClassFromMetadata.mockReturnValue(null);
      mockFileClassDeductionService.deduceFileClassFromPath.mockReturnValue(null);

      const content = '---\ntitle: Test\n---\nContent';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      expect(() => metaFlowService.processContent(content, mockFile))
        .toThrow('No fileClass found for file "test.md" and no matching folder pattern.');
      expect(consoleSpy).toHaveBeenCalledWith("Error in auto update metadata fields:", expect.anything());
      consoleSpy.mockRestore();
    });

    test('should throw error when deduced fileClass validation fails', () => {
      mockMetadataMenuAdapter.getFileClassFromMetadata.mockReturnValue(null);
      mockFileClassDeductionService.deduceFileClassFromPath.mockReturnValue('invalid');
      mockFileClassDeductionService.validateFileClassAgainstMapping.mockReturnValue(false);

      const content = '---\ntitle: Test\n---\nContent';

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      expect(() => metaFlowService.processContent(content, mockFile))
        .toThrow('FileClass "invalid" does not match any folder/fileClass mapping.');
      expect(consoleSpy).toHaveBeenCalledWith("Error in auto update metadata fields:", expect.anything());
      consoleSpy.mockRestore();
    });

    test('should log info when fileClass changes', () => {
      mockMetadataMenuAdapter.getFileClassFromMetadata.mockReturnValue(null);
      mockFileClassDeductionService.deduceFileClassFromPath.mockReturnValue('new-class');
      mockMetadataMenuAdapter.syncFields.mockReturnValue({
        frontmatter: {fileClass: 'new-class'},
        addedFields: []
      });

      const content = '---\nfileClass: old-class\n---\nContent';
      metaFlowService.processContent(content, mockFile);

      expect(mockLogNoticeManager.addInfo).toHaveBeenCalledWith(
        'File class changed for "test.md": null -> new-class'
      );
    });

    test('should sort properties when autoSort is enabled', () => {
      mockSettings.autoSort = true;
      mockMetadataMenuAdapter.syncFields.mockReturnValue({
        frontmatter: {title: 'Test', fileClass: 'book'},
        addedFields: []
      });

      const content = '---\nfileClass: book\ntitle: Test\n---\nContent';
      metaFlowService.processContent(content, mockFile);

      expect(mockPropertyManagementService.sortProperties).toHaveBeenCalledWith(
        {title: 'Test', fileClass: 'book'},
        mockSettings.sortUnknownPropertiesLast
      );
    });

    test('should handle error in processContent', () => {
      mockMetadataMenuAdapter.getFileClassFromMetadata.mockImplementation(() => {
        throw new Error('Test error');
      });

      const content = '---\nfileClass: book\n---\nContent';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      expect(() => metaFlowService.processContent(content, mockFile))
        .toThrow('Error updating metadata fields: Test error');
      expect(consoleSpy).toHaveBeenCalledWith("Error in auto update metadata fields:", expect.anything());
      consoleSpy.mockRestore();
    });
  });

  describe('processSortContent', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Mock Utils.sleep to execute immediately
      (Utils.sleep as jest.Mock).mockImplementation(
        (timeout: number, fn: () => Promise<void>) => fn()
      );
    });

    test('should sort content successfully', async () => {
      mockFrontMatterService.parseFrontmatter.mockReturnValue({
        metadata: {title: 'Test', author: 'John'},
        restOfContent: 'Content'
      });

      const content = '---\ntitle: Test\nauthor: John\n---\nContent';
      await metaFlowService.processSortContent(content, mockFile);

      expect(mockFileValidationService.checkIfValidFile).toHaveBeenCalledWith(mockFile);
      expect(mockFileValidationService.checkIfExcluded).toHaveBeenCalledWith(mockFile);
      expect(mockPropertyManagementService.sortProperties).toHaveBeenCalled();
      expect(mockFileOperationsService.updateFrontmatter).toHaveBeenCalled();
    });

    test('should handle content without frontmatter', async () => {
      mockFrontMatterService.parseFrontmatter.mockReturnValue(null);

      const content = 'Just content without frontmatter';
      await metaFlowService.processSortContent(content, mockFile);

      expect(mockPropertyManagementService.sortProperties).toHaveBeenCalledWith(
        {},
        mockSettings.sortUnknownPropertiesLast
      );
    });

    test('should handle error in processSortContent', async () => {
      mockPropertyManagementService.sortProperties.mockImplementation(() => {
        throw new Error('Sort error');
      });

      const content = '---\ntitle: Test\n---\nContent';

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      await expect(metaFlowService.processSortContent(content, mockFile))
        .rejects.toThrow('Error sorting metadata fields: Sort error');
      expect(consoleSpy).toHaveBeenCalledWith("Error sorting metadata fields:", expect.anything());
      consoleSpy.mockRestore();
    });

  });

  describe('fixSettings', () => {
    test('should fix undefined settings', () => {
      const serviceWithUndefinedSettings = new MetaFlowService(
        mockApp,
        undefined as any,
        mockMetadataMenuAdapter,
        mockFrontMatterService,
        mockFileValidationService,
        mockFileClassDeductionService,
        mockPropertyManagementService,
        mockFileOperationsService,
        mockNoteTitleService,
        mockLogNoticeManager,
        mockFileStateCache,
      );

      expect(serviceWithUndefinedSettings).toBeDefined();
    });

    test('should fix boolean settings', () => {
      const corruptedSettings = {
        ...DEFAULT_SETTINGS,
        autoSort: 'true' as any,
        sortUnknownPropertiesLast: 1 as any,
        autoMetadataInsertion: null as any,
      };

      const service = new MetaFlowService(
        mockApp,
        corruptedSettings,
        mockMetadataMenuAdapter,
        mockFrontMatterService,
        mockFileValidationService,
        mockFileClassDeductionService,
        mockPropertyManagementService,
        mockFileOperationsService,
        mockNoteTitleService,
        mockLogNoticeManager,
        mockFileStateCache,
      );

      expect(service).toBeDefined();
    });

    test('should fix array settings', () => {
      const corruptedSettings = {
        ...DEFAULT_SETTINGS,
        folderFileClassMappings: null as any,
        propertyDefaultValueScripts: 'invalid' as any,
        excludeFolders: undefined as any,
      };

      const service = new MetaFlowService(
        mockApp,
        corruptedSettings,
        mockMetadataMenuAdapter,
        mockFrontMatterService,
        mockFileValidationService,
        mockFileClassDeductionService,
        mockPropertyManagementService,
        mockFileOperationsService,
        mockNoteTitleService,
        mockLogNoticeManager,
        mockFileStateCache,
      );

      expect(service).toBeDefined();
    });

    test('should fix empty folderFileClassMappings', () => {
      const corruptedSettings = {
        ...DEFAULT_SETTINGS,
        folderFileClassMappings: [],
      };

      const service = new MetaFlowService(
        mockApp,
        corruptedSettings,
        mockMetadataMenuAdapter,
        mockFrontMatterService,
        mockFileValidationService,
        mockFileClassDeductionService,
        mockPropertyManagementService,
        mockFileOperationsService,
        mockNoteTitleService,
        mockLogNoticeManager,
        mockFileStateCache,
      );

      expect(service).toBeDefined();
    });

    test('should fix individual folderFileClassMapping properties', () => {
      const corruptedSettings = {
        ...DEFAULT_SETTINGS,
        folderFileClassMappings: [{
          folder: null,
          fileClass: 'test',
          templateMode: null,
          noteTitleScript: {enabled: null, script: null},
          noteTitleTemplates: null,
        }],
      };

      const service = new MetaFlowService(
        mockApp,
        corruptedSettings as any,
        mockMetadataMenuAdapter,
        mockFrontMatterService,
        mockFileValidationService,
        mockFileClassDeductionService,
        mockPropertyManagementService,
        mockFileOperationsService,
        mockNoteTitleService,
        mockLogNoticeManager,
        mockFileStateCache,
      );

      expect(service).toBeDefined();
    });

    test('should fix propertyDefaultValueScript properties', () => {
      const corruptedSettings = {
        ...DEFAULT_SETTINGS,
        propertyDefaultValueScripts: [{
          propertyName: null,
          script: null,
          enabled: 'true',
          order: 'invalid',
          fileClasses: 'not-array',
        }],
      };

      const service = new MetaFlowService(
        mockApp,
        corruptedSettings as any,
        mockMetadataMenuAdapter,
        mockFrontMatterService,
        mockFileValidationService,
        mockFileClassDeductionService,
        mockPropertyManagementService,
        mockFileOperationsService,
        mockNoteTitleService,
        mockLogNoticeManager,
        mockFileStateCache,
      );

      expect(service).toBeDefined();
    });
  });

  describe('importSettings', () => {
    test('should import valid JSON settings', () => {
      const newSettings = {
        autoSort: true,
        debugMode: true,
        excludeFolders: ['temp']
      };

      const result = metaFlowService.importSettings(JSON.stringify(newSettings));

      expect(result).toBeDefined();
      expect(result.autoSort).toBe(true);
      expect(result.debugMode).toBe(true);
      expect(result.excludeFolders).toContain('temp');
    });

    test('should handle invalid JSON', () => {
      expect(() => metaFlowService.importSettings('invalid json'))
        .toThrow();
    });

    test('should merge settings correctly', () => {
      const originalAutoSort = mockSettings.autoSort;
      const newSettings = {debugMode: true};

      const result = metaFlowService.importSettings(JSON.stringify(newSettings));

      expect(result.autoSort).toBe(originalAutoSort); // Should preserve original
      expect(result.debugMode).toBe(true); // Should update with new value
    });
  });

  describe('formatNoteTitle', () => {
    test('should delegate to noteTitleService', () => {
      const metadata = {title: 'Test Title'};
      const result = metaFlowService.formatNoteTitle(mockFile, 'book', metadata, mockLogNoticeManager);

      expect(mockNoteTitleService.formatNoteTitle).toHaveBeenCalledWith(mockFile, 'book', metadata);
      expect(result).toBe('Generated Title');
    });

    test('should handle different file classes', () => {
      const metadata = {title: 'Article Title'};
      metaFlowService.formatNoteTitle(mockFile, 'article', metadata, mockLogNoticeManager);

      expect(mockNoteTitleService.formatNoteTitle).toHaveBeenCalledWith(mockFile, 'article', metadata);
    });
  });

});
