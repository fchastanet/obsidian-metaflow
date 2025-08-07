import {ScriptContextService} from './ScriptContextService';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import {expectNoLogs, mockLogManager} from '../__mocks__/logManager';
import {TFile} from 'obsidian';
import {ObsidianAdapter as OriginalObsidianAdapter} from '../externalApi/ObsidianAdapter';

// Mock the adapters
jest.mock('../externalApi/TemplaterAdapter', () => ({
  TemplaterAdapter: jest.fn().mockImplementation(() => ({
    formatDate: jest.fn((format?: string) => '2025-07-30'),
    now: jest.fn(() => '2025-07-30'),
    tomorrow: jest.fn(() => '2025-07-31'),
    yesterday: jest.fn(() => '2025-07-29'),
    prompt: jest.fn(async (message: string) => 'mocked-input'),
    getParentFile: jest.fn((currentFile: TFile) => 'mocked-parent-file')
  }))
}));


describe('ScriptContextService', () => {
  let mockApp: any;
  let scriptContextService: ScriptContextService;

  beforeEach(() => {
    // Setup mock app
    mockApp = {
      plugins: {
        plugins: {}
      },
      fileManager: {
        generateMarkdownLink: jest.fn((file, path) => `[[${file.name}]]`)
      },
      vault: {
        getAbstractFileByPath: jest.fn((path: string) => OriginalObsidianAdapter.createMockTFile(path)),
        getMarkdownFiles: jest.fn(() => [])
      }
    };

    jest.mock('../externalApi/ObsidianAdapter', () => {
      return {
        ObsidianAdapter: jest.fn().mockImplementation(() => ({
          generateMarkdownLink: jest.fn((file: any) => `[[${file.name}]]`),
          getAbstractFileByPath: jest.fn((path: string) => {
            return OriginalObsidianAdapter.createMockTFile(path);
          }),
          createMockTFile: OriginalObsidianAdapter.createMockTFile
        }))
      };
    });
    scriptContextService = new ScriptContextService(mockApp, DEFAULT_SETTINGS);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Language Detection', () => {
    test('should detect English text', () => {
      const englishText = "The quick brown fox jumps over the lazy dog and runs away with it";
      const result = scriptContextService.detectLanguage(englishText);
      expect(result).toBe('English');
    });

    test('should detect French text', () => {
      const frenchText = "Le renard brun et rapide saute par-dessus le chien paresseux dans le jardin";
      const result = scriptContextService.detectLanguage(frenchText);
      expect(result).toBe('French');
    });

    test('should detect Spanish text', () => {
      const spanishText = "El perro que está en la casa es muy grande y no se puede mover";
      const result = scriptContextService.detectLanguage(spanishText);
      expect(result).toBe('Spanish');
    });

    test('should detect German text', () => {
      const germanText = "Der Mann und die Frau sind in das Haus mit den Kindern";
      const result = scriptContextService.detectLanguage(germanText);
      expect(result).toBe('German');
    });

    test('should detect Italian text', () => {
      const italianText = "Il cane che è nella casa con la famiglia e non si muove";
      const result = scriptContextService.detectLanguage(italianText);
      expect(result).toBe('Italian');
    });

    test('should return English for empty text', () => {
      const result = scriptContextService.detectLanguage('');
      expect(result).toBe('English');
    });

    test('should return English for Thinking in systems', () => {
      const result = scriptContextService.detectLanguage('Thinking in systems');
      expect(result).toBe('English');
    });

    test('should return English for ambiguous text', () => {
      const ambiguousText = "123 456 789";
      const result = scriptContextService.detectLanguage(ambiguousText);
      expect(result).toBe('English');
    });

    test('should detect Chinese text', () => {
      const chineseText = "你好世界";
      const result = scriptContextService.detectLanguage(chineseText);
      expect(result).toBe('Chinese');
    });

    test('should detect Japanese text', () => {
      const japaneseText = "こんにちはひらがな";
      const result = scriptContextService.detectLanguage(japaneseText);
      expect(result).toBe('Japanese');
    });

    test('should detect Russian text', () => {
      const russianText = "Привет мир";
      const result = scriptContextService.detectLanguage(russianText);
      expect(result).toBe('Russian');
    });
  });

  describe('Script Context', () => {
    test('should return complete script context', () => {
      const mockFile = {name: 'test.md', path: 'folder/test.md'} as any;
      const fileClass = 'article';
      const metadata = {title: 'Test', author: 'John'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      expect(context.file).toBe(mockFile);
      expect(context.fileClass).toBe(fileClass);
      expect(context.metadata).toBe(metadata);
      expect(typeof context.formatDate).toBe('function');
      expect(typeof context.now).toBe('function');
      expect(typeof context.tomorrow).toBe('function');
      expect(typeof context.yesterday).toBe('function');
      expect(typeof context.generateMarkdownLink).toBe('function');
      expect(typeof context.detectLanguage).toBe('function');
      expect(typeof context.prompt).toBe('function');
      expectNoLogs();
    });

    test('should bind adapter methods correctly', () => {
      const mockFile = {name: 'test.md', path: 'folder/test.md'} as any;
      const fileClass = 'article';
      const metadata = {title: 'Test'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      // Test that the bound methods work correctly
      expect(context.now()).toBe('2025-07-30');
      expect(context.tomorrow()).toBe('2025-07-31');
      expect(context.yesterday()).toBe('2025-07-29');
      expect(context.formatDate(new Date('2025-07-30'), 'YYYY-MM-DD')).toBe('2025-07-30');
      expectNoLogs();
    });

    test('should provide working detectLanguage function', () => {
      const mockFile = {name: 'test.md', path: 'folder/test.md'} as any;
      const fileClass = 'article';
      const metadata = {title: 'Test'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      expect(context.detectLanguage('The quick brown fox and the lazy dog')).toBe('English');
      expect(context.detectLanguage('Le renard brun et le chien paresseux')).toBe('French');
      expectNoLogs();
    });

    test('should provide working generateMarkdownLink function', () => {
      const mockFile = OriginalObsidianAdapter.createMockTFile('folder/test.md');
      const linkTarget = OriginalObsidianAdapter.createMockTFile('folder/target.md');
      const fileClass = 'article';
      const metadata = {title: 'Test'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      expect(context.generateMarkdownLink(linkTarget)).toBe('[[target.md]]');
      expectNoLogs();
    });

    test('generateMarkdownLink with file path', () => {
      const mockFile = OriginalObsidianAdapter.createMockTFile('folder/test.md');
      const linkTarget = 'folder/target.md';
      const fileClass = 'article';
      const metadata = {title: 'Test'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      expect(context.generateMarkdownLink(linkTarget)).toBe('[[target.md]]');
      expectNoLogs();
    });

    test('should provide working prompt function', async () => {
      const mockFile = {name: 'test.md', path: 'folder/test.md'} as any;
      const fileClass = 'article';
      const metadata = {title: 'Test'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      const result = await context.prompt('Enter value');
      expect(result).toBe('mocked-input');
      expectNoLogs();
    });
  });

  describe('Language Detection Edge Cases', () => {
    test('should handle mixed language text', () => {
      const mixedText = "The quick brown fox and le renard brun";
      const result = scriptContextService.detectLanguage(mixedText);
      expect(result).toBe('English'); // Should favor the language with more matches
    });

    test('should handle very short text', () => {
      const shortText = "the";
      const result = scriptContextService.detectLanguage(shortText);
      expect(result).toBe('English');
    });

    test('should handle punctuation and numbers', () => {
      const punctuationText = "123! @#$ %^& *()";
      const result = scriptContextService.detectLanguage(punctuationText);
      expect(result).toBe('English'); // Should default to English
    });
  });

  describe('Templater Integration through Context', () => {
    test('should provide date functions through context', () => {
      const mockFile = {name: 'test.md', path: 'folder/test.md'} as any;
      const fileClass = 'article';
      const metadata = {title: 'Test'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      // Test that date functions are available and work
      expect(typeof context.formatDate).toBe('function');
      expect(typeof context.now).toBe('function');
      expect(typeof context.tomorrow).toBe('function');
      expect(typeof context.yesterday).toBe('function');

      // Test that they return expected values (mocked)
      expect(context.now()).toBe('2025-07-30');
      expect(context.tomorrow()).toBe('2025-07-31');
      expect(context.yesterday()).toBe('2025-07-29');
      expect(context.formatDate(new Date('2025-07-30'), 'YYYY-MM-DD')).toBe('2025-07-30');

      expectNoLogs();
    });

    test('should provide prompt function through context', async () => {
      const mockFile = {name: 'test.md', path: 'folder/test.md'} as any;
      const fileClass = 'article';
      const metadata = {title: 'Test'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      expect(typeof context.prompt).toBe('function');
      const result = await context.prompt('Enter value', 'default');
      expect(result).toBe('mocked-input');
      expectNoLogs();
    });
  });

  describe('Markdown Link Generation through Context', () => {
    test('should generate markdown link through context', () => {
      const mockFile = {name: 'source.md', path: 'folder/source.md'} as any;
      const targetFile = OriginalObsidianAdapter.createMockTFile('folder/target.md');
      const fileClass = 'article';
      const metadata = {title: 'Test'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      expect(typeof context.generateMarkdownLink).toBe('function');
      const result = context.generateMarkdownLink(targetFile);
      expect(result).toBe('[[target.md]]');
      expectNoLogs();
    });

    test('should handle markdown link generation with different file types', () => {
      const mockFile = OriginalObsidianAdapter.createMockTFile('folder/source.md');
      const fileClass = 'article';
      const metadata = {title: 'Test'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      // Test with different target files
      const pdfFile = OriginalObsidianAdapter.createMockTFile('files/document.pdf');
      const imageFile = OriginalObsidianAdapter.createMockTFile('images/image.png');

      expect(context.generateMarkdownLink(pdfFile)).toBe('[[document.pdf]]');
      expect(context.generateMarkdownLink(imageFile)).toBe('[[image.png]]');
      expectNoLogs();
    });
  });

  describe('Context Object Structure', () => {
    test('should provide all required context properties', () => {
      const mockFile = {name: 'test.md', path: 'folder/test.md'} as any;
      const fileClass = 'article';
      const metadata = {title: 'Test', author: 'John Doe'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      // Verify all required properties exist
      expect(context).toHaveProperty('file');
      expect(context).toHaveProperty('fileClass');
      expect(context).toHaveProperty('metadata');
      expect(context).toHaveProperty('formatDate');
      expect(context).toHaveProperty('now');
      expect(context).toHaveProperty('tomorrow');
      expect(context).toHaveProperty('yesterday');
      expect(context).toHaveProperty('generateMarkdownLink');
      expect(context).toHaveProperty('detectLanguage');
      expect(context).toHaveProperty('prompt');
      expect(context).toHaveProperty('getParentFile');

      // Verify property values
      expect(context.file).toBe(mockFile);
      expect(context.fileClass).toBe(fileClass);
      expect(context.metadata).toBe(metadata);
      expectNoLogs();
    });

    test('should provide working utility functions', () => {
      const mockFile = {name: 'test.md', path: 'folder/test.md'} as any;
      const fileClass = 'article';
      const metadata = {title: 'Test'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      // Test that utility functions work as expected
      expect(context.detectLanguage('The quick brown fox and the lazy dog')).toBe('English');
      expect(context.detectLanguage('Le renard brun et le chien paresseux')).toBe('French');
      expect(context.detectLanguage('')).toBe('English');

      // Test date functions
      expect(context.now()).toBe('2025-07-30');
      expect(context.tomorrow()).toBe('2025-07-31');
      expect(context.yesterday()).toBe('2025-07-29');
      expectNoLogs();
    });
  });

  describe('Integration with Adapters', () => {
    test('should properly bind adapter methods', () => {
      const mockFile = OriginalObsidianAdapter.createMockTFile('folder/test.md');
      const fileClass = 'article';
      const metadata = {title: 'Test'};

      const context = scriptContextService.getScriptContext(mockFile, fileClass, metadata, mockLogManager);

      // Verify that the adapter methods are properly bound
      // (by checking they don't throw when called)
      expect(() => context.now()).not.toThrow();
      expect(() => context.tomorrow()).not.toThrow();
      expect(() => context.yesterday()).not.toThrow();
      expect(() => context.formatDate(new Date(), 'YYYY-MM-DD')).not.toThrow();
      expect(() => context.detectLanguage('test')).not.toThrow();
      expect(() => context.generateMarkdownLink(mockFile)).not.toThrow();
      expect(() => context.getParentFile(mockFile)).not.toThrow();
      expectNoLogs();
    });
  });
});
