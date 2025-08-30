import {FileProcessor} from './FileProcessor';
import {FileClassDeductionService} from '../services/FileClassDeductionService';
import {ObsidianAdapter} from '../externalApi/ObsidianAdapter';
import {MetaFlowSettings} from '../settings/types';
import {TFile, CachedMetadata} from 'obsidian';
import {Utils} from '../utils/Utils';

// Mock TFile
jest.mock('obsidian', () => ({
  TFile: jest.fn().mockImplementation(function (this: any) {
    this.path = '';
    this.basename = '';
    this.stat = {mtime: 0};
  })
}));

// Mock Utils
jest.mock('../utils/Utils', () => ({
  Utils: {
    sha256: jest.fn()
  }
}));

describe('FileProcessor', () => {
  let processor: FileProcessor;
  let mockFileClassDeductionService: jest.Mocked<FileClassDeductionService>;
  let mockObsidianAdapter: jest.Mocked<ObsidianAdapter>;
  let mockSettings: MetaFlowSettings;
  let mockFile: TFile;

  beforeEach(() => {
    mockFileClassDeductionService = {
      getFileClassFromMetadata: jest.fn()
    } as any;

    mockObsidianAdapter = {
      getCachedFile: jest.fn()
    } as any;

    mockSettings = {} as MetaFlowSettings;

    processor = new FileProcessor(mockFileClassDeductionService, mockObsidianAdapter, mockSettings);

    // Create mock file
    mockFile = Object.create(require('obsidian').TFile.prototype);
    mockFile.basename = 'test-file';
    mockFile.stat = {mtime: 1000, ctime: 1000, size: 100};
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('computeFileState', () => {
    it('should compute file state with provided cache', () => {
      const mockCache: CachedMetadata = {
        frontmatter: {fileClass: 'test-class', title: 'Test Title'}
      } as CachedMetadata;

      (Utils.sha256 as jest.Mock).mockReturnValue('mock-checksum');
      mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue('test-class');

      const result = processor.computeFileState(mockFile, mockCache);

      expect(result).toEqual({
        checksum: 'mock-checksum',
        fileClass: 'test-class',
        mtime: 1000
      });

      expect(Utils.sha256).toHaveBeenCalledWith('test-file\n{"fileClass":"test-class","title":"Test Title"}');
      expect(mockFileClassDeductionService.getFileClassFromMetadata).toHaveBeenCalledWith(mockCache.frontmatter);
      expect(mockObsidianAdapter.getCachedFile).not.toHaveBeenCalled();
    });

    it('should fetch cache when not provided', () => {
      const mockCache: CachedMetadata = {
        frontmatter: {fileClass: 'fetched-class'}
      } as CachedMetadata;

      mockObsidianAdapter.getCachedFile.mockReturnValue(mockCache);
      (Utils.sha256 as jest.Mock).mockReturnValue('fetched-checksum');
      mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue('fetched-class');

      const result = processor.computeFileState(mockFile);

      expect(result).toEqual({
        checksum: 'fetched-checksum',
        fileClass: 'fetched-class',
        mtime: 1000
      });

      expect(mockObsidianAdapter.getCachedFile).toHaveBeenCalledWith(mockFile);
    });

    it('should handle null cache', () => {
      (Utils.sha256 as jest.Mock).mockReturnValue('null-cache-checksum');
      mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue('');

      const result = processor.computeFileState(mockFile, null);

      expect(result).toEqual({
        checksum: 'null-cache-checksum',
        fileClass: '',
        mtime: 1000
      });

      expect(Utils.sha256).toHaveBeenCalledWith('test-file\n{}');
      expect(mockFileClassDeductionService.getFileClassFromMetadata).toHaveBeenCalledWith(undefined);
    });

    it('should handle undefined frontmatter', () => {
      const mockCache: CachedMetadata = {} as CachedMetadata;

      (Utils.sha256 as jest.Mock).mockReturnValue('no-frontmatter-checksum');
      mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue('default-class');

      const result = processor.computeFileState(mockFile, mockCache);

      expect(result).toEqual({
        checksum: 'no-frontmatter-checksum',
        fileClass: 'default-class',
        mtime: 1000
      });

      expect(Utils.sha256).toHaveBeenCalledWith('test-file\n{}');
      expect(mockFileClassDeductionService.getFileClassFromMetadata).toHaveBeenCalledWith(undefined);
    });

    it('should handle null fileClass from deduction service', () => {
      const mockCache: CachedMetadata = {
        frontmatter: {title: 'Test'}
      } as CachedMetadata;

      (Utils.sha256 as jest.Mock).mockReturnValue('mock-checksum');
      mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue(null);

      const result = processor.computeFileState(mockFile, mockCache);

      expect(result).toEqual({
        checksum: 'mock-checksum',
        fileClass: '',
        mtime: 1000
      });
    });

    it('should handle complex frontmatter', () => {
      const complexFrontmatter = {
        fileClass: 'complex-class',
        tags: ['tag1', 'tag2'],
        nested: {prop: 'value'},
        array: [1, 2, 3]
      };

      const mockCache: CachedMetadata = {
        frontmatter: complexFrontmatter
      } as CachedMetadata;

      (Utils.sha256 as jest.Mock).mockReturnValue('complex-checksum');
      mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue('complex-class');

      const result = processor.computeFileState(mockFile, mockCache);

      expect(result).toEqual({
        checksum: 'complex-checksum',
        fileClass: 'complex-class',
        mtime: 1000
      });

      const expectedInput = `test-file\n${JSON.stringify(complexFrontmatter)}`;
      expect(Utils.sha256).toHaveBeenCalledWith(expectedInput);
    });
  });
});
