import {FileClassDeductionService} from "./FileClassDeductionService";
import {MetaFlowSettings} from "../settings/types";
import {DEFAULT_SETTINGS} from "../settings/defaultSettings";

describe('FileClassDeductionService', () => {
  let fileClassDeductionService: FileClassDeductionService;
  let mockMetaFlowSettings: MetaFlowSettings;
  let mockObsidianAdapter: any;
  let mockMetadataMenuAdapter: any;
  let mockFrontMatterService: any;

  beforeEach(() => {
    mockMetaFlowSettings = {
      ...DEFAULT_SETTINGS,
      folderFileClassMappings: [
        {folder: '/', fileClass: 'default', templateMode: 'template', moveToFolder: false, noteTitleScript: {enabled: false, script: ''}, noteTitleTemplates: []},
        {folder: 'books', fileClass: 'book', templateMode: 'template', moveToFolder: false, noteTitleScript: {enabled: false, script: ''}, noteTitleTemplates: []},
        {folder: 'articles', fileClass: 'article', templateMode: 'template', moveToFolder: false, noteTitleScript: {enabled: false, script: ''}, noteTitleTemplates: []}
      ]
    };

    mockObsidianAdapter = {
      normalizePath: jest.fn().mockImplementation((path: string) => path),
      folderPrefix: jest.fn().mockImplementation((folder: string) => folder === '/' ? '/' : `${folder}/`)
    };

    mockMetadataMenuAdapter = {
      getFileClassAlias: jest.fn().mockReturnValue('fileClass')
    };

    mockFrontMatterService = {
      parseFileClassFromContent: jest.fn()
    };

    fileClassDeductionService = new FileClassDeductionService(
      mockMetaFlowSettings,
      mockObsidianAdapter,
      mockMetadataMenuAdapter,
      mockFrontMatterService
    );
  });

  describe('deduceFileClassFromPath', () => {
    it('should return correct fileClass for exact folder match', () => {
      const result = fileClassDeductionService.deduceFileClassFromPath('books/my-book.md');
      expect(result).toBe('book');
    });

    it('should return correct fileClass for subfolder', () => {
      // The folderPrefix should only be called when needed, not mocked globally
      const result = fileClassDeductionService.deduceFileClassFromPath('books/subdir/my-book.md');
      expect(result).toBe('book');
    });

    it('should return root fileClass for file at root', () => {
      const result = fileClassDeductionService.deduceFileClassFromPath('note.md');
      expect(result).toBe('default');
    });

    it('should return null for non-matching path', () => {
      mockMetaFlowSettings.folderFileClassMappings = [
        {folder: 'books', fileClass: 'book', templateMode: 'template', moveToFolder: false, noteTitleScript: {enabled: false, script: ''}, noteTitleTemplates: []}
      ];
      const result = fileClassDeductionService.deduceFileClassFromPath('videos/my-video.md');
      expect(result).toBeNull();
    });
  });

  describe('validateFileClassAgainstMapping', () => {
    it('should return true when fileClass matches deduced fileClass', () => {
      const result = fileClassDeductionService.validateFileClassAgainstMapping('books/my-book.md', 'book');
      expect(result).toBe(true);
    });

    it('should return false when fileClass does not match deduced fileClass', () => {
      const result = fileClassDeductionService.validateFileClassAgainstMapping('books/my-book.md', 'article');
      expect(result).toBe(false);
    });
  });

  describe('getFileClassFromContent', () => {
    it('should delegate to frontMatterService', () => {
      const content = '---\nfileClass: book\n---\nContent';
      mockFrontMatterService.parseFileClassFromContent.mockReturnValue('book');

      const result = fileClassDeductionService.getFileClassFromContent(content);

      expect(mockFrontMatterService.parseFileClassFromContent).toHaveBeenCalledWith(content, 'fileClass');
      expect(result).toBe('book');
    });
  });

  describe('getFileClassFromMetadata', () => {
    it('should return fileClass from metadata using alias', () => {
      const metadata = {fileClass: 'book', title: 'My Book'};
      const result = fileClassDeductionService.getFileClassFromMetadata(metadata);
      expect(result).toBe('book');
    });

    it('should return null for invalid metadata', () => {
      expect(fileClassDeductionService.getFileClassFromMetadata(undefined)).toBeNull();
      expect(fileClassDeductionService.getFileClassFromMetadata()).toBeNull();
      expect(fileClassDeductionService.getFileClassFromMetadata({} as any)).toBeNull();
    });

    it('should return null when fileClass property is missing', () => {
      const metadata = {title: 'My Book'};
      const result = fileClassDeductionService.getFileClassFromMetadata(metadata);
      expect(result).toBeNull();
    });
  });
});
