import {ServiceContainer} from './ServiceContainer';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {TFile, FileStats} from 'obsidian';
import {LogManagerInterface} from 'src/managers/types';

// Mock Obsidian modules
jest.mock('obsidian', () => ({
  Notice: jest.fn(),
  TFile: jest.fn(),
  TFolder: jest.fn(),
  normalizePath: jest.fn().mockImplementation((path: string) => path.replace(/\\/g, '/')),
}));

describe('ServiceContainer', () => {
  let mockApp: any;
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
      metadataCache: {
        getFileCache: jest.fn().mockReturnValue({
          frontmatter: {fileClass: 'test'}
        }),
      },
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

    serviceContainer = new ServiceContainer(mockApp, DEFAULT_SETTINGS);
  });

  describe('Service Container Functionality', () => {
    test('should be instantiated correctly', () => {
      expect(serviceContainer).toBeDefined();
      expect(serviceContainer).toBeInstanceOf(ServiceContainer);
    });

    test('should provide access to fileClassDeductionService', () => {
      expect(serviceContainer.fileClassDeductionService).toBeDefined();

      const content = '---\nfileClass: book\n---\nContent';
      const result = serviceContainer.fileClassDeductionService.getFileClassFromContent(content);
      expect(result).toBe('book');
    });

    test('should provide access to fileValidationService', () => {
      expect(serviceContainer.fileValidationService).toBeDefined();
      expect(() => serviceContainer.fileValidationService.checkIfValidFile(mockFile)).not.toThrow();
    });

    test('should provide access to propertyManagementService', () => {
      expect(serviceContainer.propertyManagementService).toBeDefined();

      const frontmatter = {title: 'Test', author: 'Author'};
      const result = serviceContainer.propertyManagementService.sortProperties(frontmatter, false);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    test('should provide access to noteTitleService', () => {
      expect(serviceContainer.noteTitleService).toBeDefined();

      const metadata = {title: 'Test Title'};
      const result = serviceContainer.noteTitleService.formatNoteTitle(mockFile, 'default', metadata, mockLogManager);
      expect(typeof result).toBe('string');
    });

    test('should provide access to fileOperationsService', () => {
      expect(serviceContainer.fileOperationsService).toBeDefined();
    });

    test('should provide access to uiService', () => {
      expect(serviceContainer.uiService).toBeDefined();
      expect(() => serviceContainer.uiService.togglePropertiesVisibility(true)).not.toThrow();
    });

    test('should provide access to frontMatterService', () => {
      expect(serviceContainer.frontMatterService).toBeDefined();

      const content = '---\ntitle: Test\n---\nContent';
      const result = serviceContainer.frontMatterService.parseFrontmatter(content);
      expect(result).toBeDefined();
      expect(result?.metadata?.title).toBe('Test');
    });

    test('should share the same settings across services', () => {
      expect(serviceContainer.metaFlowSettings).toBe(DEFAULT_SETTINGS);
      expect(serviceContainer.fileValidationService).toBeDefined();
      expect(serviceContainer.fileClassDeductionService).toBeDefined();
    });
  });
});
