import {TFile} from "obsidian";
import {NoteTitleService} from "./NoteTitleService";
import {MetaFlowSettings} from "../settings/types";
import {DEFAULT_SETTINGS} from "../settings/defaultSettings";

describe('NoteTitleService', () => {
  let noteTitleService: NoteTitleService;
  let mockMetaFlowSettings: MetaFlowSettings;
  let mockScriptContextService: any;
  let mockFile: TFile;
  let mockLogManager: any;

  beforeEach(() => {
    mockMetaFlowSettings = {
      ...DEFAULT_SETTINGS,
      debugMode: false,
      folderFileClassMappings: [
        {
          folder: '/',
          fileClass: 'default',
          templateMode: 'template',
          moveToFolder: false,
          noteTitleScript: {enabled: false, script: ''},
          noteTitleTemplates: [
            {enabled: true, template: '{{title}}'}
          ]
        },
        {
          folder: 'books',
          fileClass: 'book',
          templateMode: 'script',
          moveToFolder: false,
          noteTitleScript: {
            enabled: true,
            script: 'return metadata.title + " by " + metadata.author;'
          },
          noteTitleTemplates: []
        }
      ]
    };

    mockScriptContextService = {
      getScriptContext: jest.fn().mockReturnValue({
        metadata: {title: 'Test Book', author: 'Test Author'},
        fileClass: 'book',
        file: {},
        logManager: {}
      })
    };

    // Create a proper mock TFile instance
    mockFile = Object.create(TFile.prototype);
    Object.assign(mockFile, {
      name: 'test.md',
      extension: 'md',
      path: 'test.md'
    });

    mockLogManager = {
      addInfo: jest.fn(),
      addWarning: jest.fn(),
      addError: jest.fn()
    };

    noteTitleService = new NoteTitleService(
      mockMetaFlowSettings,
      mockScriptContextService
    );
  });

  describe('formatNoteTitle', () => {
    it('should format title using template mode', () => {
      const metadata = {title: 'My Great Book'};
      const result = noteTitleService.formatNoteTitle(mockFile, 'default', metadata, mockLogManager);
      expect(result).toBe('My Great Book');
    });

    it('should format title using script mode', () => {
      const metadata = {title: 'Test Book', author: 'Test Author'};
      const result = noteTitleService.formatNoteTitle(mockFile, 'book', metadata, mockLogManager);
      expect(result).toBe('Test Book by Test Author');
    });

    it('should return "Untitled" when no mapping found', () => {
      const metadata = {title: 'Test'};
      const result = noteTitleService.formatNoteTitle(mockFile, 'unknown', metadata, mockLogManager);
      expect(result).toBe('Untitled');
    });

    it('should return "Untitled" when required metadata is missing for template', () => {
      const metadata = {author: 'Test Author'}; // missing title
      const result = noteTitleService.formatNoteTitle(mockFile, 'default', metadata, mockLogManager);
      expect(result).toBe('Untitled');
    });

    it('should return "Untitled" when script is disabled', () => {
      mockMetaFlowSettings.folderFileClassMappings[1].noteTitleScript.enabled = false;
      const metadata = {title: 'Test Book', author: 'Test Author'};
      const result = noteTitleService.formatNoteTitle(mockFile, 'book', metadata, mockLogManager);
      expect(result).toBe('Untitled');
    });

    it('should sanitize filename with invalid characters', () => {
      const metadata = {title: 'Test/Book:With*Invalid?Characters'};
      const result = noteTitleService.formatNoteTitle(mockFile, 'default', metadata, mockLogManager);
      expect(result).toBe('TestBookWithInvalidCharacters');
    });

    it('should handle array values in templates', () => {
      mockMetaFlowSettings.folderFileClassMappings[0].noteTitleTemplates[0].template = '{{tags}}';
      const metadata = {tags: ['fiction', 'adventure']};
      const result = noteTitleService.formatNoteTitle(mockFile, 'default', metadata, mockLogManager);
      expect(result).toBe('fiction, adventure');
    });

    it('should handle script execution errors gracefully', () => {
      mockMetaFlowSettings.folderFileClassMappings[1].noteTitleScript.script = 'throw new Error("Script error");';
      const metadata = {title: 'Test Book', author: 'Test Author'};

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      const result = noteTitleService.formatNoteTitle(mockFile, 'book', metadata, mockLogManager);
      expect(result).toBe('Untitled');

      consoleSpy.mockRestore();
    });

    it('should handle non-string script results', () => {
      mockMetaFlowSettings.folderFileClassMappings[1].noteTitleScript.script = 'return 123;';
      const metadata = {title: 'Test Book', author: 'Test Author'};
      const result = noteTitleService.formatNoteTitle(mockFile, 'book', metadata, mockLogManager);
      expect(result).toBe('Untitled');
    });

    it('should handle empty script results', () => {
      mockMetaFlowSettings.folderFileClassMappings[1].noteTitleScript.script = 'return "";';
      const metadata = {title: 'Test Book', author: 'Test Author'};
      const result = noteTitleService.formatNoteTitle(mockFile, 'book', metadata, mockLogManager);
      expect(result).toBe('Untitled');
    });

    it('should try multiple templates until one works', () => {
      mockMetaFlowSettings.folderFileClassMappings[0].noteTitleTemplates = [
        {enabled: true, template: '{{missing}}'},  // This will fail
        {enabled: true, template: '{{title}}'}     // This will work
      ];
      const metadata = {title: 'My Great Book'};
      const result = noteTitleService.formatNoteTitle(mockFile, 'default', metadata, mockLogManager);
      expect(result).toBe('My Great Book');
    });

    it('should skip disabled templates', () => {
      mockMetaFlowSettings.folderFileClassMappings[0].noteTitleTemplates = [
        {enabled: false, template: '{{title}}'},   // This is disabled
        {enabled: true, template: '{{author}}'}    // This will work
      ];
      const metadata = {title: 'My Great Book', author: 'Test Author'};
      const result = noteTitleService.formatNoteTitle(mockFile, 'default', metadata, mockLogManager);
      expect(result).toBe('Test Author');
    });

    it('should limit filename length', () => {
      const longTitle = 'a'.repeat(300);
      const metadata = {title: longTitle};
      const result = noteTitleService.formatNoteTitle(mockFile, 'default', metadata, mockLogManager);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });
});
