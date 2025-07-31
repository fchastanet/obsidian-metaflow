import {TFile} from 'obsidian';
// Mock the adapters
const mockMetadataMenuAdapter = {
  isMetadataMenuAvailable: jest.fn().mockReturnValue(true),
  getFileClassByName: jest.fn(),
  insertMissingFields: jest.fn(),
  getFileClassFromMetadata: jest.fn().mockReturnValue('book'),
  getFileClassAlias: jest.fn().mockReturnValue('file_class'),
};

const mockTemplaterAdapter = {
  isTemplaterAvailable: jest.fn().mockReturnValue(false)
};

jest.mock('../externalApi/MetadataMenuAdapter', () => ({
  MetadataMenuAdapter: jest.fn().mockImplementation(() => mockMetadataMenuAdapter)
}));

jest.mock('../externalApi/TemplaterAdapter', () => ({
  TemplaterAdapter: jest.fn().mockImplementation(() => mockTemplaterAdapter)
}));

// Mock ScriptContextService
jest.mock('./ScriptContextService', () => ({
  ScriptContextService: jest.fn().mockImplementation(() => ({
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
  }))
}));

// Mock FrontMatterService
jest.mock('./FrontMatterService', () => ({
  FrontMatterService: jest.fn().mockImplementation(() => ({
    parseFrontmatter: jest.fn().mockImplementation((content) => {
      if (!content || typeof content !== 'string') return null;
      if (content.startsWith('---')) {
        const yamlMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
        if (yamlMatch) {
          const yamlContent = yamlMatch[1];
          const restContent = yamlMatch[2];
          const metadata: any = {};

          // Parse simple YAML for testing
          yamlContent.split('\n').forEach(line => {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
              metadata[match[1]] = match[2];
            }
          });

          return {
            metadata,
            restOfContent: restContent
          };
        }
      }
      return null;
    }),
    serializeFrontmatter: jest.fn().mockImplementation((metadata, content) => {
      const yamlLines = Object.entries(metadata).map(([key, value]) => `${key}: ${value}`);
      return `---\n${yamlLines.join('\n')}\n---\n${content}`;
    })
  }))
}));

import {MetaFlowService} from './MetaFlowService';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {MetaFlowSettings} from '../settings/types';
import {MetaFlowException} from '../MetaFlowException';

// Mock Obsidian modules
jest.mock('obsidian', () => ({
  Notice: jest.fn(),
  TFile: jest.fn()
}));

describe('MetaFlowService', () => {
  let mockApp: any;
  let metaFlowService: MetaFlowService;
  let mockFile: TFile;

  beforeEach(() => {
    // Setup mock app
    mockApp = {
      vault: {
        read: jest.fn(),
        modify: jest.fn()
      },
      fileManager: {
        generateMarkdownLink: jest.fn()
      }
    };

    // Setup mock file
    mockFile = {
      name: 'test.md',
      path: 'test.md',
      extension: 'md'
    } as TFile;

    // Create the command instance
    metaFlowService = new MetaFlowService(mockApp, DEFAULT_SETTINGS);
  });

  describe('Pattern Matching', () => {
    test('should match simple glob patterns', () => {
      // Access private method for testing
      const matchesPattern = (metaFlowService as any).matchesPattern.bind(metaFlowService);

      expect(matchesPattern('Books/note.md', 'Books/*')).toBe(true);
      expect(matchesPattern('Books/subfolder/note.md', 'Books/*')).toBe(true); // minimatch considers this a match
      expect(matchesPattern('Books/subfolder/note.md', 'Books/**')).toBe(true);
      expect(matchesPattern('Articles/note.md', 'Books/*')).toBe(false);
    });

    test('should match regex patterns', () => {
      const matchesPattern = (metaFlowService as any).matchesPattern.bind(metaFlowService);

      expect(matchesPattern('Books/note.md', 'Books/.*', true)).toBe(true);
      expect(matchesPattern('Books/subfolder/note.md', 'Books/.*', true)).toBe(true);
      expect(matchesPattern('Articles/note.md', 'Books/.*', true)).toBe(false);
    });

    test('should handle fallback pattern', () => {
      const matchesPattern = (metaFlowService as any).matchesPattern.bind(metaFlowService);

      expect(matchesPattern('any/path/note.md', '.*', true)).toBe(true);
      expect(matchesPattern('note.md', '.*', true)).toBe(true);
    });
  });

  describe('FileClass Deduction', () => {
    test('should deduce fileClass from folder mapping', () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        folderFileClassMappings: [
          {folderPattern: 'Books/**', fileClass: 'book', isRegex: false},
          {folderPattern: 'Articles/**', fileClass: 'article', isRegex: false},
          {folderPattern: '.*', fileClass: 'default', isRegex: true}
        ]
      };

      const command = new MetaFlowService(mockApp, settings);
      const deduceFileClass = (command as any).deduceFileClassFromPath.bind(command);

      expect(deduceFileClass('Books/my-book.md')).toBe('book');
      expect(deduceFileClass('Articles/my-article.md')).toBe('article');
      expect(deduceFileClass('Notes/my-note.md')).toBe('default');
    });
  });

  describe('Command Execution', () => {
    beforeEach(() => {
      // Reset mocks
      mockMetadataMenuAdapter.isMetadataMenuAvailable.mockReturnValue(true);
      mockTemplaterAdapter.isTemplaterAvailable.mockReturnValue(false);
      mockMetadataMenuAdapter.getFileClassByName.mockResolvedValue({
        name: 'default',
        fields: []
      } as any);
      mockMetadataMenuAdapter.insertMissingFields.mockResolvedValue(undefined);
    });

    test('should fail if MetadataMenu is not available', async () => {
      mockMetadataMenuAdapter.isMetadataMenuAvailable.mockReturnValue(false);
      expect.assertions(2);
      try {
        await metaFlowService.processContent('', mockFile);
      } catch (error) {
        expect(error).toBeInstanceOf(MetaFlowException);
        expect(error.message).toBe('Error updating metadata fields: MetadataMenu plugin not available');
      }
      // The command should handle the error gracefully
    });

    test('should process file with existing fileClass', async () => {
      const contentWithFileClass = `---
fileClass: book
title: Test Book
---

Content here`;

      // Mock vault.read to return the updated content after MetadataMenu processing
      mockApp.vault.read.mockResolvedValue(contentWithFileClass);

      const result = await metaFlowService.processContent(contentWithFileClass, mockFile);

      expect(mockMetadataMenuAdapter.insertMissingFields).toHaveBeenCalledWith(mockFile, 'book');
      expect(typeof result).toBe('string');
      expect(result).toContain('fileClass: book');
    });

    test('should deduce fileClass from folder mapping', async () => {
      const contentWithoutFileClass = `---
title: Test Note
---

Content here`;

      const settings = {
        ...DEFAULT_SETTINGS,
        folderFileClassMappings: [
          {folderPattern: '.*', fileClass: 'book', isRegex: true}
        ]
      };

      const command = new MetaFlowService(mockApp, settings);

      mockApp.vault.read
        .mockResolvedValueOnce(contentWithoutFileClass)
        .mockResolvedValueOnce(contentWithoutFileClass);

      await command.processContent(contentWithoutFileClass, mockFile);

      expect(mockMetadataMenuAdapter.insertMissingFields).toHaveBeenCalledWith(mockFile, 'book');
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
    test('should execute scripts in order when order is specified', async () => {
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
      (commandWithOrderedScripts as any).executePropertyScript = jest.fn().mockImplementation(async (script) => {
        executionOrder.push(script.propertyName);
        return originalExecuteScript(script, mockFile, 'book', {});
      });

      const result = await (commandWithOrderedScripts as any).addDefaultValuesToProperties({}, mockFile, 'book');

      // Scripts should be executed in order: author (1), title (2), date (3)
      expect(executionOrder).toEqual(['author', 'title', 'date']);
      expect(result.author).toBe('second');
      expect(result.title).toBe('first');
      expect(result.date).toBe('third');
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
      expect(executionOrder).toEqual(['title', 'date', 'author']);
    });
  });
});
