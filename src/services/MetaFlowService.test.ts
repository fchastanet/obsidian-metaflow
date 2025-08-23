import {FileStats, TFile} from 'obsidian';

// Declare mock variables that will be initialized in beforeEach
let mockMetadataMenuAdapter: any;
let mockTemplaterAdapter: any;
let mockScriptContextService: any;

jest.mock('../externalApi/MetadataMenuAdapter', () => ({
  MetadataMenuAdapter: jest.fn().mockImplementation(() => mockMetadataMenuAdapter)
}));

jest.mock('../externalApi/TemplaterAdapter', () => ({
  TemplaterAdapter: jest.fn().mockImplementation(() => mockTemplaterAdapter)
}));

jest.mock('./ScriptContextService', () => ({
  ScriptContextService: jest.fn().mockImplementation(() => mockScriptContextService)
}));

import {MetaFlowService} from './MetaFlowService';
import {ServiceContainer} from './ServiceContainer';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {LogManagerInterface} from 'src/managers/types';

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
  let serviceContainer: ServiceContainer;
  let mockFile: TFile;
  let mockLogManager: LogManagerInterface;

  beforeEach(() => {
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

    // Setup mocks
    mockMetadataMenuAdapter = {
      isMetadataMenuAvailable: jest.fn().mockReturnValue(true),
      getFileClassAlias: jest.fn().mockReturnValue('fileClass'),
      getFileClassAndAncestorsFields: jest.fn().mockReturnValue([]),
      syncFields: jest.fn().mockResolvedValue(undefined),
      getFileClassByName: jest.fn().mockReturnValue({}),
      getFileClassFromMetadata: jest.fn().mockReturnValue('default'),
    };

    mockTemplaterAdapter = {
      isTemplaterAvailable: jest.fn().mockReturnValue(true),
    };

    mockScriptContextService = {
      getScriptContext: jest.fn().mockReturnValue({
        metadata: {},
        fileClass: 'default',
        file: {},
        logManager: {},
      }),
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

    metaFlowService = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
    serviceContainer = new ServiceContainer(mockApp, DEFAULT_SETTINGS);
  });

  describe('Basic Service Functionality', () => {
    test('should be instantiated correctly', () => {
      expect(metaFlowService).toBeDefined();
      expect(metaFlowService).toBeInstanceOf(MetaFlowService);
    });

    test('should get file class from content via serviceContainer', () => {
      const content = '---\nfileClass: book\n---\nContent';
      const result = serviceContainer.fileClassDeductionService.getFileClassFromContent(content);
      expect(result).toBe('book');
    });

    test('should get file class from metadata via serviceContainer', () => {
      const metadata = {fileClass: 'article', title: 'Test'};
      const result = serviceContainer.fileClassDeductionService.getFileClassFromMetadata(metadata);
      expect(result).toBe('article');
    });

    test('should handle null metadata via serviceContainer', () => {
      expect(serviceContainer.fileClassDeductionService.getFileClassFromMetadata(null)).toBe(null);
      expect(serviceContainer.fileClassDeductionService.getFileClassFromMetadata(undefined)).toBe(null);
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
    test('should handle file class changes', async () => {
      const metadata = {frontmatter: {fileClass: 'default'}};
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => { });
      const result = await metaFlowService.handleFileClassChanged(mockFile, metadata, 'old', 'default', mockLogManager);
      expect(result).toBeUndefined(); // void method
      expect(consoleSpy).toHaveBeenCalledWith('Auto-move for the folder "/" is disabled');
      consoleSpy.mockRestore();
    });

    test('should process content', async () => {
      const content = '---\ntitle: Test\n---\nContent';
      const result = await metaFlowService.processContent(content, mockFile, mockLogManager);
      expect(result).toBeDefined();
    });
  });
});
