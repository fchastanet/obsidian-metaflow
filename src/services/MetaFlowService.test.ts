import {FileStats, normalizePath, Plugin, TFile} from 'obsidian';

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
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {MetaFlowSettings} from '../settings/types';
import {MetaFlowException} from '../MetaFlowException';
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
  let mockFile: TFile;
  let mockLogManager: LogManagerInterface;

  beforeEach(() => {
    // Setup mock app first
    mockApp = {
      plugins: {
        enabledPlugins: new Map([['metadata-menu', true]]),
        plugins: {
          'metadata-menu': {
            api: {},
            settings: {
              fileClassAlias: 'fileClass',
            },
          }
        },
      },
      vault: {
        read: jest.fn(),
        modify: jest.fn(),
        getAbstractFileByPath: jest.fn().mockImplementation((path) => {
          if (path === 'test.md') {
            return mockFile;
          }
          return null;
        }),
        createFolder: jest.fn().mockImplementation((path) => {
          return {
            path,
            name: path.split('/').pop() || path,
            vault: mockApp.vault,
            children: [],
          };
        }),
      },
      fileManager: {
        generateMarkdownLink: jest.fn(),
        renameFile: jest.fn().mockImplementation((file, newPath) => {
          file.path = newPath;
          return Promise.resolve(file);
        })
      }
    };
    mockLogManager = {
      addDebug: jest.fn(),
      addWarning: jest.fn(),
      addError: jest.fn(),
      addInfo: jest.fn(),
      addMessage: jest.fn(),
    };

    // Create a real MetadataMenuAdapter instance to get the actual getFileClassByName method
    const realMetadataMenuAdapter = new (jest.requireActual('../externalApi/MetadataMenuAdapter').MetadataMenuAdapter)(
      mockApp,
      {
        ...DEFAULT_SETTINGS,
        metadataMenuIntegration: true,
      }
    );

    // Initialize all mocks here for clean state between tests
    mockMetadataMenuAdapter = {
      isMetadataMenuAvailable: jest.fn().mockReturnValue(true),
      getFileClassByName: jest.fn().mockResolvedValue({
        name: 'default',
        fields: []
      }),
      syncFields: jest.fn().mockImplementation((frontmatter) => frontmatter),
      getFileClassFromMetadata: realMetadataMenuAdapter.getFileClassFromMetadata.bind(realMetadataMenuAdapter), // Use real implementation
      getFileClassAlias: jest.fn().mockReturnValue('fileClass'),
      getFileClassAndAncestorsFields: jest.fn().mockReturnValue([
        {name: 'title', type: 'string'},
        {name: 'author', type: 'number'},
      ])
    };

    mockTemplaterAdapter = {
      isTemplaterAvailable: jest.fn().mockReturnValue(true)
    };

    mockScriptContextService = {
      executeScript: jest.fn().mockImplementation((script, file, fileClass, metadata) => {
        // Simple script evaluation for testing
        if (script.includes('new Date().toISOString()')) {
          return new Date().toISOString();
        }
        if (script.includes('fileClass + "-" + file.name')) {
          return `${fileClass}-${file.name}`;
        }
        if (script.includes('return "first"')) return 'first';
        if (script.includes('return "second"')) return 'second';
        if (script.includes('return "third"')) return 'third';
        return script;
      }),
      getScriptContext: jest.fn().mockImplementation((file, fileClass, metadata) => ({
        fileClass,
        file,
        metadata
      }))
    };

    // Setup mock file
    mockFile = new TFile();
    mockFile.basename = 'test';
    mockFile.extension = 'md';
    mockFile.name = 'test.md';
    mockFile.path = 'test.md';

    // Create the command instance
    metaFlowService = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
  });

  describe('FileClass Deduction', () => {
    test('should deduce fileClass from folder mapping', () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        folderFileClassMappings: [
          {folder: 'Books', fileClass: 'book', moveToFolder: true, noteTitleTemplates: []},
          {folder: 'Articles', fileClass: 'article', moveToFolder: true, noteTitleTemplates: []},
          {folder: '/', fileClass: 'default', moveToFolder: false, noteTitleTemplates: []}
        ]
      };

      const command = new MetaFlowService(mockApp, settings);
      const deduceFileClass = (command as any).deduceFileClassFromPath.bind(command);

      expect(deduceFileClass('Books/my-book.md')).toBe('book');
      expect(deduceFileClass('Articles/my-article.md')).toBe('article');
      expect(deduceFileClass('Notes/my-note.md')).toBe('default');
      expect(deduceFileClass('my-note.md')).toBe('default');
    });
  });

  describe('Command Execution', () => {
    test('should fail if MetadataMenu is not available', async () => {
      mockMetadataMenuAdapter.isMetadataMenuAvailable.mockReturnValue(false);
      expect.assertions(2);
      try {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
        metaFlowService.processContent('', mockFile, mockLogManager);
        expect(spy).toHaveBeenCalledWith('Error updating metadata fields: MetadataMenu plugin not available');
        spy.mockRestore();
      } catch (error) {
        expect(error).toBeInstanceOf(MetaFlowException);
        expect(error.message).toBe('MetadataMenu plugin not available');
      }
    });

    test('should fail if file is not md file', async () => {
      expect.assertions(2);
      try {
        mockFile.extension = 'jpg';
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
        metaFlowService.processContent('', mockFile, mockLogManager);
        expect(spy).toHaveBeenCalledWith('Error updating metadata fields: File test.md is not a markdown file');
        spy.mockRestore();
      } catch (error) {
        expect(error).toBeInstanceOf(MetaFlowException);
        expect(error.message).toBe('File test.md is not a markdown file');
      }
    });

    test('should process file with existing fileClass', async () => {
      const contentWithFileClass = `---
fileClass: book
title: Test Book
---

Content here`;

      const result = metaFlowService.processContent(contentWithFileClass, mockFile, mockLogManager);
      const expectedFrontmatter = {
        fileClass: 'book',
        title: 'Test Book'
      };
      expect(mockMetadataMenuAdapter.syncFields).toHaveBeenCalledWith(expectedFrontmatter, 'book', mockLogManager);
      expect(typeof result).toBe('string');
      expect(result).toContain('fileClass: book');
      expect(mockLogManager.addError).not.toHaveBeenCalled();
    });

    test('should deduce fileClass from folder mapping', async () => {
      const contentWithoutFileClass = `---
title: Test Note
---

Content here`;

      const settings = {
        ...DEFAULT_SETTINGS,
        folderFileClassMappings: [
          {folder: 'Books', fileClass: 'book', moveToFolder: true, noteTitleTemplates: []},
          {folder: '/', fileClass: 'note', moveToFolder: false, noteTitleTemplates: []}
        ]
      };

      const command = new MetaFlowService(mockApp, settings);

      command.processContent(contentWithoutFileClass, mockFile, mockLogManager);

      const expectedFrontmatter = {
        title: 'Test Note'
      };
      expect(mockMetadataMenuAdapter.syncFields).
        toHaveBeenCalledWith(expectedFrontmatter, 'note', mockLogManager);
      expect(mockLogManager.addError).not.toHaveBeenCalled();
    });
  });

  describe('Script Execution', () => {
    test('should execute simple property script', async () => {
      const script = {
        propertyName: 'created',
        script: 'return new Date().toISOString();',
        enabled: true
      };

      const executeScript = (metaFlowService as any).executePropertyScript.bind(metaFlowService);

      const result = await executeScript(script, mockFile, 'default', {});

      expect(typeof result).toBe('string');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO date format
    });

    test('should have access to context variables', async () => {
      const script = {
        propertyName: 'testProp',
        script: 'return fileClass + "-" + file.name;',
        enabled: true
      };

      const executeScript = (metaFlowService as any).executePropertyScript.bind(metaFlowService);

      const result = await executeScript(script, mockFile, 'book', {});

      expect(result).toBe('book-test.md');
    });
  });

  describe('Script Ordering', () => {
    test('should execute scripts in order when order is specified', () => {
      const settingsWithOrderedScripts: MetaFlowSettings = {
        ...DEFAULT_SETTINGS,
        propertyDefaultValueScripts: [
          {
            propertyName: 'title',
            script: 'return "first";',
            enabled: true,
            order: 2
          },
          {
            propertyName: 'author',
            script: 'return "second";',
            enabled: true,
            order: 1
          },
          {
            propertyName: 'date',
            script: 'return "third";',
            enabled: true,
            order: 3
          }
        ]
      };
      const commandWithOrderedScripts = new MetaFlowService(mockApp, settingsWithOrderedScripts);

      // Mock the method to track execution order
      const executionOrder: string[] = [];
      const originalExecuteScript = (commandWithOrderedScripts as any).executePropertyScript.bind(commandWithOrderedScripts);
      (commandWithOrderedScripts as any).executePropertyScript = jest.fn().mockImplementation((script) => {
        executionOrder.push(script.propertyName);
        return originalExecuteScript(script, mockFile, 'book', {});
      });

      const result = (commandWithOrderedScripts as any).addDefaultValuesToProperties({}, mockFile, 'book');

      // Scripts should be executed in order: author (1), title (2), date (3)
      expect(executionOrder).toEqual(['author', 'title']);
      expect(result.author).toBe('second');
      expect(result.title).toBe('first');
      expect(result).not.toHaveProperty('date'); // date script not executed
    });

    test('should handle scripts without order specification', async () => {
      const settingsWithMixedOrder: MetaFlowSettings = {
        ...DEFAULT_SETTINGS,
        propertyDefaultValueScripts: [
          {
            propertyName: 'title',
            script: 'return "first";',
            enabled: true,
            order: 1
          },
          {
            propertyName: 'author',
            script: 'return "second";',
            enabled: true
            // No order specified
          },
          {
            propertyName: 'date',
            script: 'return "third";',
            enabled: true,
            order: 2
          }
        ]
      };

      const commandWithMixedOrder = new MetaFlowService(mockApp, settingsWithMixedOrder);

      const executionOrder: string[] = [];
      const originalExecuteScript = (commandWithMixedOrder as any).executePropertyScript.bind(commandWithMixedOrder);
      (commandWithMixedOrder as any).executePropertyScript = jest.fn().mockImplementation(async (script) => {
        executionOrder.push(script.propertyName);
        return originalExecuteScript(script, mockFile, 'book', {});
      });

      const result = await (commandWithMixedOrder as any).addDefaultValuesToProperties({}, mockFile, 'book');

      // Scripts with order should come first, then scripts without order
      expect(executionOrder).toEqual(['title', 'author']);
    });
  });

  describe('sortProperties', () => {
    test('should sort properties based on propertyDefaultValueScripts order', () => {
      const settingsWithOrder: MetaFlowSettings = {
        ...DEFAULT_SETTINGS,
        propertyDefaultValueScripts: [
          {propertyName: 'title', script: '', enabled: true, order: 1},
          {propertyName: 'author', script: '', enabled: true, order: 2},
          {propertyName: 'date', script: '', enabled: true, order: 3},
          {propertyName: 'tags', script: '', enabled: true, order: 4}
        ]
      };

      const serviceWithOrder = new MetaFlowService(mockApp, settingsWithOrder);
      const sortProperties = (serviceWithOrder as any).sortProperties.bind(serviceWithOrder);

      const frontmatter = {
        tags: ['tag1'],
        author: 'John Doe',
        title: 'Test Title',
        date: '2023-01-01',
        unknown: 'value',
        fieldUnknown: 'value',
      };

      const result = sortProperties(frontmatter, false);
      const keys = Object.keys(result);

      expect(keys).toEqual(['fieldUnknown', 'unknown', 'title', 'author', 'date', 'tags']);
      expect(result.title).toBe('Test Title');
      expect(result.author).toBe('John Doe');
      expect(result.date).toBe('2023-01-01');
      expect(result.tags).toEqual(['tag1']);
      expect(result.unknown).toBe('value');
    });

    test('should handle scripts without order', () => {
      const settings: MetaFlowSettings = {
        ...DEFAULT_SETTINGS,
        propertyDefaultValueScripts: [
          {propertyName: 'title', script: '', enabled: true, order: 1},
          {propertyName: 'author', script: '', enabled: true, order: 2}
        ]
      };

      const service = new MetaFlowService(mockApp, settings);
      const sortProperties = (service as any).sortProperties.bind(service);

      const frontmatter = {
        category: 'work',
        author: 'John Doe',
        title: 'Test Title',
        status: 'active',
        priority: 'high'
      };

      const result = sortProperties(frontmatter, false);
      const keys = Object.keys(result);

      // With sortUnknownPropertiesLast=false, unknown properties come first (alphabetically), then ordered properties
      expect(keys).toEqual(['category', 'priority', 'status', 'title', 'author']);
    });

    test('should sort unknown properties last when sortUnknownPropertiesLast is true', () => {
      const settingsWithOrder: MetaFlowSettings = {
        ...DEFAULT_SETTINGS,
        propertyDefaultValueScripts: [
          {propertyName: 'title', script: '', enabled: true, order: 1},
          {propertyName: 'author', script: '', enabled: true, order: 2}
        ]
      };

      const serviceWithOrder = new MetaFlowService(mockApp, settingsWithOrder);
      const sortProperties = (serviceWithOrder as any).sortProperties.bind(serviceWithOrder);

      const frontmatter = {
        unknown2: 'value2',
        author: 'John Doe',
        title: 'Test Title',
        unknown1: 'value1',
        fieldUnknown: 'value',
      };

      const result = sortProperties(frontmatter, true);
      const keys = Object.keys(result);

      expect(keys).toEqual(['title', 'author', 'fieldUnknown', 'unknown1', 'unknown2']);
    });

    test('should sort unknown properties first when sortUnknownPropertiesLast is false', () => {
      const settingsWithOrder: MetaFlowSettings = {
        ...DEFAULT_SETTINGS,
        propertyDefaultValueScripts: [
          {propertyName: 'title', script: '', enabled: true, order: 1},
          {propertyName: 'author', script: '', enabled: true, order: 2}
        ]
      };

      const serviceWithOrder = new MetaFlowService(mockApp, settingsWithOrder);
      const sortProperties = (serviceWithOrder as any).sortProperties.bind(serviceWithOrder);

      const frontmatter = {
        unknown2: 'value2',
        author: 'John Doe',
        title: 'Test Title',
        unknown1: 'value1'
      };

      const result = sortProperties(frontmatter, false);
      const keys = Object.keys(result);

      expect(keys).toEqual(['unknown1', 'unknown2', 'title', 'author']);
    });

    test('should sort unknown properties alphabetically', () => {
      const settingsWithOrder: MetaFlowSettings = {
        ...DEFAULT_SETTINGS,
        propertyDefaultValueScripts: [
          {propertyName: 'title', script: '', enabled: true, order: 1}
        ]
      };

      const serviceWithOrder = new MetaFlowService(mockApp, settingsWithOrder);
      const sortProperties = (serviceWithOrder as any).sortProperties.bind(serviceWithOrder);

      const frontmatter = {
        zebra: 'z',
        apple: 'a',
        title: 'Test Title',
        banana: 'b'
      };

      const result = sortProperties(frontmatter, true);
      const keys = Object.keys(result);

      expect(keys).toEqual(['title', 'apple', 'banana', 'zebra']);
    });

    test('should handle scripts with mixed order values', () => {
      const settingsWithMixedOrder: MetaFlowSettings = {
        ...DEFAULT_SETTINGS,
        propertyDefaultValueScripts: [
          {propertyName: 'date', script: '', enabled: true, order: 3},
          {propertyName: 'title', script: '', enabled: true, order: 1},
          {propertyName: 'tags', script: '', enabled: true}, // No order
          {propertyName: 'author', script: '', enabled: true, order: 2}
        ]
      };

      const serviceWithMixedOrder = new MetaFlowService(mockApp, settingsWithMixedOrder);
      const sortProperties = (serviceWithMixedOrder as any).sortProperties.bind(serviceWithMixedOrder);

      const frontmatter = {
        tags: ['tag1'],
        author: 'John Doe',
        title: 'Test Title',
        date: '2023-01-01'
      };

      const result = sortProperties(frontmatter, false);
      const keys = Object.keys(result);

      // Should be: title (1), author (2), date (3), tags (no order - comes after ordered)
      expect(keys).toEqual(['title', 'author', 'date', 'tags']);
    });

    test('should handle null or undefined frontmatter', () => {
      const service = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
      const sortProperties = (service as any).sortProperties.bind(service);

      expect(sortProperties(null, false)).toBe(null);
      expect(sortProperties(undefined, false)).toBe(undefined);
      expect(sortProperties({}, false)).toEqual({});
    });

    test('should handle non-object frontmatter', () => {
      const service = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
      const sortProperties = (service as any).sortProperties.bind(service);

      expect(sortProperties('string', false)).toBe('string');
      expect(sortProperties(123, false)).toBe(123);
      expect(sortProperties([], false)).toEqual([]);
    });

    test('should preserve property values during sorting', () => {
      const settingsWithOrder: MetaFlowSettings = {
        ...DEFAULT_SETTINGS,
        propertyDefaultValueScripts: [
          {propertyName: 'title', script: '', enabled: true, order: 1},
          {propertyName: 'data', script: '', enabled: true, order: 2}
        ]
      };

      const serviceWithOrder = new MetaFlowService(mockApp, settingsWithOrder);
      const sortProperties = (serviceWithOrder as any).sortProperties.bind(serviceWithOrder);

      const complexData = {
        nested: {key: 'value'},
        array: [1, 2, 3],
        boolean: true,
        number: 42,
        string: 'test'
      };

      const frontmatter = {
        data: complexData,
        title: 'Test Title'
      };

      const result = sortProperties(frontmatter, false);

      expect(result.title).toBe('Test Title');
      expect(result.data).toEqual(complexData);
      expect(result.data.nested).toEqual({key: 'value'});
      expect(result.data.array).toEqual([1, 2, 3]);
    });
  });

  describe('moveNoteToTheRightFolder', () => {
    test('should move note to the right folder when autoMoveNoteToRightFolder is enabled and mapping exists', async () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        autoMoveNoteToRightFolder: true,
        folderFileClassMappings: [
          {folder: 'Books', fileClass: 'book', moveToFolder: true, noteTitleTemplates: []},
          {folder: 'Articles', fileClass: 'article', moveToFolder: true, noteTitleTemplates: []}
        ]
      };
      const service = new MetaFlowService(mockApp, settings);
      // Mock obsidianAdapter.moveNote as a jest mock function
      (service as any).obsidianAdapter.moveNote = jest.fn();
      const file = mockFile;
      file.path = 'Books/my-book.md';
      file.name = 'my-book.md';
      await service.moveNoteToTheRightFolder(file, 'book');
      expect((service as any).obsidianAdapter.moveNote).toHaveBeenCalledWith(file, 'Books/my-book.md');
    });

    test('should not move note if no target folder is found', async () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        autoMoveNoteToRightFolder: true,
        folderFileClassMappings: [
          {folder: 'Books', fileClass: 'book', moveToFolder: false, noteTitleTemplates: []}
        ]
      };
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyInfo = jest.spyOn(console, 'info').mockImplementation(() => { });
      const service = new MetaFlowService(mockApp, settings);
      // Mock obsidianAdapter.moveNote as a jest mock function
      (service as any).obsidianAdapter.moveNote = jest.fn();
      const file = mockFile;
      file.path = 'Books/my-book.md';
      file.name = 'my-book.md';

      try {
        await (service as any).moveNoteToTheRightFolder(file, 'book');
      } catch (error) {
        expect(error).toBeInstanceOf(MetaFlowException);
        expect(error.message).toBe('No target folder defined for fileClass "book"');
      }
      expect(spyInfo).toHaveBeenCalledWith('Auto-move for the folder "Books" is disabled');
      spy.mockRestore();
      expect((service as any).obsidianAdapter.moveNote).not.toHaveBeenCalled();
    });

    test('should not move note if target file exists', async () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        autoMoveNoteToRightFolder: true,
        folderFileClassMappings: [
          {folder: 'Books', fileClass: 'book', moveToFolder: true, noteTitleTemplates: []}
        ]
      };
      mockApp.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile); // Simulate existing file
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const service = new MetaFlowService(mockApp, settings);
      // Mock obsidianAdapter.moveNote as a jest mock function
      (service as any).obsidianAdapter.moveNote = jest.fn();
      const file = mockFile;
      file.path = 'Books/my-book.md';
      file.name = 'my-book.md';

      try {
        await (service as any).moveNoteToTheRightFolder(file, 'book');
      } catch (error) {
        expect(error).toBeInstanceOf(MetaFlowException);
        expect(error.message).toBe('Target file "Books/my-book.md" already exists');
      }
      spy.mockRestore();
      expect((service as any).obsidianAdapter.moveNote).not.toHaveBeenCalled();
    });
  });

  describe('getTargetFolderForFileClass', () => {
    test('should return folder if mapping exists and moveToFolder is true', () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        folderFileClassMappings: [
          {folder: 'Books', fileClass: 'book', moveToFolder: true, noteTitleTemplates: []},
          {folder: 'Articles', fileClass: 'article', moveToFolder: false, noteTitleTemplates: []},
          {folder: 'Articles2', fileClass: 'article', moveToFolder: true, noteTitleTemplates: []},
        ]
      };
      const spy = jest.spyOn(console, 'info').mockImplementation(() => { });
      const service = new MetaFlowService(mockApp, settings);
      expect((service as any).getTargetFolderForFileClass('book')).toBe('Books');
      expect((service as any).getTargetFolderForFileClass('article')).toBe('Articles2');
      expect(spy).toHaveBeenCalledWith('Auto-move for the folder "Books" is disabled');
      spy.mockRestore();
    });

    test('should return null if no mapping exists for fileClass', () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        folderFileClassMappings: [
          {folder: 'Books', fileClass: 'book', moveToFolder: true, noteTitleTemplates: []}
        ]
      };
      const service = new MetaFlowService(mockApp, settings);
      expect((service as any).getTargetFolderForFileClass('unknown')).toBe(null);
    });
  });

  describe('getFileClassFromContent', () => {
    test('should return fileClass from frontmatter if present', () => {
      const service = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
      const content = `---\nfileClass: book\ntitle: Test Book\n---\nContent here`;
      const result = service.getFileClassFromContent(content);
      expect(result).toBe('book');
    });

    test('should return null if fileClass is not present in frontmatter', () => {
      const service = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
      const content = `---\ntitle: Test Book\n---\nContent here`;
      const result = service.getFileClassFromContent(content);
      expect(result).toBe(null);
    });

    test('should return null if no frontmatter exists', () => {
      const service = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
      const content = `Content here without frontmatter`;
      const result = service.getFileClassFromContent(content);
      expect(result).toBe(null);
    });
  });

  describe('getFileClassFromMetadata', () => {
    test('should return fileClass from metadata using alias', () => {
      const service = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
      // fileClassAlias is mocked to 'fileClass' in beforeEach
      const metadata = {fileClass: 'book', title: 'Test Book'};
      const result = service.getFileClassFromMetadata(metadata);
      expect(result).toBe('book');
    });

    test('should return null if fileClass is not present in metadata', () => {
      const service = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
      const metadata = {title: 'Test Book'};
      const result = service.getFileClassFromMetadata(metadata);
      expect(result).toBe(null);
    });

    test('should return null if metadata is null or undefined', () => {
      const service = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
      expect(service.getFileClassFromMetadata(null)).toBe(null);
      expect(service.getFileClassFromMetadata(undefined)).toBe(null);
    });

    test('should return null if metadata is not an object', () => {
      const service = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
      expect(service.getFileClassFromMetadata('string')).toBe(null);
      expect(service.getFileClassFromMetadata(123)).toBe(null);
      expect(service.getFileClassFromMetadata([])).toBe(null);
    });
  });

  describe('MetaFlowService.updateFrontmatter', () => {
    let service: MetaFlowService;
    let file: any;
    let processFrontMatterMock: jest.Mock;
    beforeEach(() => {
      service = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
      file = {name: 'test.md'};
      processFrontMatterMock = jest.fn();
      mockApp.fileManager.processFrontMatter = processFrontMatterMock;
    });

    test('should update frontmatter with new keys and values', async () => {
      const enrichedFrontmatter = {a: 1, b: 2};
      processFrontMatterMock.mockImplementation((fileArg, updater) => {
        const frontmatter = {old: 'value', empty1: null, empty2: undefined, empty3: ''};
        updater(frontmatter);
        expect(frontmatter).toEqual({a: 1, b: 2, old: 'value', empty1: null, empty2: undefined, empty3: ''});
      });
      await (service as any).updateFrontmatter(file, {a: 1, b: 2}, false);
      expect(processFrontMatterMock).toHaveBeenCalledWith(file, expect.any(Function));
    });

    test('should delete empty keys if deleteEmptyKeys is true', async () => {
      processFrontMatterMock.mockImplementation((fileArg, updater) => {
        const frontmatter = {a: '', b: null, c: undefined, d: 'keep'};
        updater(frontmatter);
        expect(frontmatter).toEqual({d: 'keep'});
      });
      await (service as any).updateFrontmatter(file, {d: 'keep'}, true);
    });

    test('should add keys in desired order', async () => {
      const enrichedFrontmatter = {z: 1, a: 2};
      processFrontMatterMock.mockImplementation((fileArg, updater) => {
        const frontmatter = {x: 0};
        updater(frontmatter);
        // The keys should be in the order of enrichedFrontmatter
        expect(Object.keys(frontmatter)).toEqual(['x', 'z', 'a']);
        expect(frontmatter).toEqual({x: 0, z: 1, a: 2});
      });
      await (service as any).updateFrontmatter(file, enrichedFrontmatter, false);
    });
  });

});
