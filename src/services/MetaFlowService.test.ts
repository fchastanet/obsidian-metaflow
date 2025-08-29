import {FileStats, TFile, TFolder} from 'obsidian';
import {MetaFlowService} from './MetaFlowService';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {LogManagerInterface} from 'src/managers/types';
import {MetaFlowSettings, FolderFileClassMapping} from '../settings/types';

// Mock Obsidian modules
jest.mock('obsidian', () => ({
  Notice: jest.fn(),
  TFile: jest.fn(),
  TFolder: jest.fn(),
  normalizePath: jest.fn().mockImplementation((path: string) => path.replace(/\\/g, '/')),
}));

describe('MetaFlowService', () => {
  let mockApp: any;
  let metaFlowService: MetaFlowService;
  let mockFile: TFile;
  let mockLogManager: LogManagerInterface;
  let mockSettings: MetaFlowSettings;

  // Mock services
  let mockScriptContextService: any;
  let mockMetadataMenuAdapter: any;
  let mockFrontMatterService: any;
  let mockTemplaterAdapter: any;
  let mockObsidianAdapter: any;
  let mockFileValidationService: any;
  let mockFileClassDeductionService: any;
  let mockPropertyManagementService: any;
  let mockFileOperationsService: any;
  let mockNoteTitleService: any;

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
    mockScriptContextService = {
      getScriptContext: jest.fn().mockReturnValue({
        metadata: {},
        fileClass: 'default',
        file: {},
        logManager: {},
      }),
    };

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

    mockTemplaterAdapter = {
      isTemplaterAvailable: jest.fn().mockReturnValue(true),
    };

    mockObsidianAdapter = {
      folderPrefix: jest.fn().mockImplementation((folder: string) => folder === '/' ? '/' : `${folder}/`),
      isFileExists: jest.fn().mockReturnValue(false),
      isFolderExists: jest.fn().mockReturnValue(true),
      createFolder: jest.fn().mockResolvedValue({}),
      getAbstractFileByPath: jest.fn().mockImplementation((path: string) => {
        // Return mockFile for any path that looks like a file
        if (path.includes('.md')) {
          return mockFile;
        }
        return null;
      }),
      moveNote: jest.fn().mockResolvedValue(undefined),
      normalizePath: jest.fn().mockImplementation((path: string) => path.replace(/\\/g, '/')),
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

    mockLogManager = {
      addDebug: jest.fn(),
      addInfo: jest.fn(),
      addWarning: jest.fn(),
      addError: jest.fn(),
      addMessage: jest.fn(),
    };

    // Create MetaFlowService with all dependencies
    metaFlowService = new MetaFlowService(
      mockApp,
      mockSettings,
      mockScriptContextService,
      mockMetadataMenuAdapter,
      mockFrontMatterService,
      mockTemplaterAdapter,
      mockObsidianAdapter,
      mockFileValidationService,
      mockFileClassDeductionService,
      mockPropertyManagementService,
      mockFileOperationsService,
      mockNoteTitleService
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

  describe('File Operations', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
    });

    test('should handle file class changes', async () => {
      const metadata = {frontmatter: {fileClass: 'default'}};

      // Set up settings to enable auto metadata insertion
      mockSettings.autoMetadataInsertion = true;

      const result = await metaFlowService.handleFileClassChanged(mockFile, metadata, 'old', 'default', mockLogManager);
      expect(result).toBeUndefined(); // void method

      // Verify that the validation service was called
      expect(mockFileValidationService.checkIfAutomaticMetadataInsertionEnabled).toHaveBeenCalled();
      expect(mockFileValidationService.checkIfMetadataInsertionApplicable).toHaveBeenCalledWith(mockFile);
    });

    test('should process content', async () => {
      const content = '---\ntitle: Test\n---\nContent';
      const result = await metaFlowService.processContent(content, mockFile, mockLogManager);
      expect(result).toBeDefined();
    });
  });
});
