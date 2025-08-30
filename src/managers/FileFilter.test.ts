import {FileFilter} from './FileFilter';
import {FileValidationService} from '../services/FileValidationService';
import {ObsidianAdapter} from '../externalApi/ObsidianAdapter';
import {TFile, TAbstractFile, CachedMetadata} from 'obsidian';

// Mock TFile
jest.mock('obsidian', () => ({
  TFile: jest.fn().mockImplementation(function (this: any) {
    this.path = '';
    this.basename = '';
    this.extension = '';
    this.saving = false;
  })
}));

describe('FileFilter', () => {
  let filter: FileFilter;
  let mockFileValidationService: jest.Mocked<FileValidationService>;
  let mockObsidianAdapter: jest.Mocked<ObsidianAdapter>;
  let mockFile: TFile;

  beforeEach(() => {
    mockFileValidationService = {
      ifFileExcluded: jest.fn()
    } as any;

    mockObsidianAdapter = {
      getCachedFile: jest.fn()
    } as any;

    filter = new FileFilter(mockFileValidationService, mockObsidianAdapter);

    // Create mock file
    mockFile = Object.create(require('obsidian').TFile.prototype);
    mockFile.path = 'test/file.md';
    mockFile.basename = 'file';
    mockFile.extension = 'md';
    mockFile.saving = false;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isApplicable', () => {
    it('should return true for valid markdown files with frontmatter', () => {
      const mockCache: CachedMetadata = {
        frontmatter: {title: 'Test'}
      } as CachedMetadata;

      mockFileValidationService.ifFileExcluded.mockReturnValue(false);
      mockObsidianAdapter.getCachedFile.mockReturnValue(mockCache);

      const result = filter.isApplicable(mockFile);

      expect(result).toBe(true);
      expect(mockFileValidationService.ifFileExcluded).toHaveBeenCalledWith(mockFile);
      expect(mockObsidianAdapter.getCachedFile).toHaveBeenCalledWith(mockFile);
    });

    it('should return false for null/undefined files', () => {
      expect(filter.isApplicable(null)).toBe(false);
      expect(filter.isApplicable(undefined)).toBe(false);
    });

    it('should return false for non-TFile instances', () => {
      const notATFile = {path: 'test.md'} as TAbstractFile;
      expect(filter.isApplicable(notATFile)).toBe(false);
    });

    it('should return false for files without basename', () => {
      mockFile.basename = '';
      expect(filter.isApplicable(mockFile)).toBe(false);

      mockFile.basename = 'file';
      mockFile.path = '';
      expect(filter.isApplicable(mockFile)).toBe(false);
    });

    it('should return false for files that are currently saving', () => {
      mockFile.saving = true;
      expect(filter.isApplicable(mockFile)).toBe(false);
    });

    it('should return false for non-markdown files', () => {
      mockFile.extension = 'txt';
      expect(filter.isApplicable(mockFile)).toBe(false);

      mockFile.extension = 'pdf';
      expect(filter.isApplicable(mockFile)).toBe(false);

      mockFile.extension = '';
      expect(filter.isApplicable(mockFile)).toBe(false);
    });

    it('should return false for excluded files', () => {
      const mockCache: CachedMetadata = {
        frontmatter: {title: 'Test'}
      } as CachedMetadata;

      mockFileValidationService.ifFileExcluded.mockReturnValue(true);
      mockObsidianAdapter.getCachedFile.mockReturnValue(mockCache);

      const result = filter.isApplicable(mockFile);

      expect(result).toBe(false);
      expect(mockFileValidationService.ifFileExcluded).toHaveBeenCalledWith(mockFile);
    });

    it('should return false for files without cache', () => {
      mockFileValidationService.ifFileExcluded.mockReturnValue(false);
      mockObsidianAdapter.getCachedFile.mockReturnValue(null);

      const result = filter.isApplicable(mockFile);

      expect(result).toBe(false);
    });

    it('should return false for files without frontmatter', () => {
      const mockCache: CachedMetadata = {} as CachedMetadata;

      mockFileValidationService.ifFileExcluded.mockReturnValue(false);
      mockObsidianAdapter.getCachedFile.mockReturnValue(mockCache);

      const result = filter.isApplicable(mockFile);

      expect(result).toBe(false);
    });

    it('should handle edge cases with undefined cache properties', () => {
      const mockCache: CachedMetadata = {
        frontmatter: undefined
      } as any;

      mockFileValidationService.ifFileExcluded.mockReturnValue(false);
      mockObsidianAdapter.getCachedFile.mockReturnValue(mockCache);

      const result = filter.isApplicable(mockFile);

      expect(result).toBe(false);
    });

    it('should pass type guard correctly', () => {
      const mockCache: CachedMetadata = {
        frontmatter: {title: 'Test'}
      } as CachedMetadata;

      mockFileValidationService.ifFileExcluded.mockReturnValue(false);
      mockObsidianAdapter.getCachedFile.mockReturnValue(mockCache);

      const file: TAbstractFile = mockFile;

      if (filter.isApplicable(file)) {
        // TypeScript should now know that file is TFile
        expect(file.basename).toBe('file');
        expect(file.extension).toBe('md');
      }
    });
  });
});
