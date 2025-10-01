import {FileProcessor} from './FileProcessor';
import {FileClassDeductionService} from '@metaflow/services/FileClassDeductionService';
import {ObsidianAdapter} from '@metaflow/externalApi/ObsidianAdapter';
import {MetaFlowSettings} from '@metaflow/settings/types';
import {TFile, CachedMetadata} from 'obsidian';
import {MetaFlowService} from '@metaflow/services/MetaFlowService';
import {LogNoticeManagerInterface} from '@metaflow/managers/types';
import {SkipException} from '@metaflow/SkipException';

// Mock TFile
jest.mock('obsidian', () => ({
  TFile: jest.fn().mockImplementation(function (this: any) {
    this.path = '';
    this.basename = '';
    this.stat = {mtime: 0};
  }),
  Modal: class MockModal { },
}));

describe('FileProcessor', () => {
  let processor: FileProcessor;
  let mockFileClassDeductionService: jest.Mocked<FileClassDeductionService>;
  let mockObsidianAdapter: jest.Mocked<ObsidianAdapter>;
  let mockSettings: MetaFlowSettings;
  let metaFlowService: jest.Mocked<MetaFlowService>;
  let logNoticeManager: jest.Mocked<LogNoticeManagerInterface>;
  let mockFile: TFile;
  let spyInfo: jest.SpyInstance;
  let spyWarn: jest.SpyInstance;
  let spyError: jest.SpyInstance;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    spyInfo = jest.spyOn(console, 'info').mockImplementation(() => { });
    spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
    spyError = jest.spyOn(console, 'error').mockImplementation(() => { });

    mockFileClassDeductionService = {
      getFileClassFromMetadata: jest.fn()
    } as any;

    mockObsidianAdapter = {
      getCachedFile: jest.fn()
    } as any;

    mockSettings = {} as MetaFlowSettings;

    metaFlowService = {
      handleFileClassChanged: jest.fn()
    } as any;

    logNoticeManager = {
      addInfo: jest.fn(),
      addWarning: jest.fn(),
      addError: jest.fn()
    } as any;

    processor = new FileProcessor(mockFileClassDeductionService, mockObsidianAdapter, mockSettings, metaFlowService, logNoticeManager);

    // Create mock file
    mockFile = Object.create(TFile.prototype);
    mockFile.basename = 'test-file';
    mockFile.stat = {mtime: 1000, ctime: 1000, size: 100};
  });

  afterEach(() => {
    spyInfo.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  it('should return existing state if file not found', async () => {
    mockObsidianAdapter.getAbstractFileByPath = jest.fn().mockReturnValue(null);
    const state = {checksum: 'abc', fileClass: 'note', fileMtime: 500};

    await expect(processor.processFile('nonexistent.md', state)).
      rejects.toThrow(new SkipException('File not found for path nonexistent.md'));
    expect(mockObsidianAdapter.getAbstractFileByPath).toHaveBeenCalledWith('nonexistent.md');
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalledWith("FileProcessor: File not found for path nonexistent.md");
    expect(spyError).not.toHaveBeenCalled();
  });

  it('should return existing state if path is not a file', async () => {
    mockObsidianAdapter.getAbstractFileByPath = jest.fn().mockReturnValue({});
    const state = {checksum: 'abc', fileClass: 'note', fileMtime: 500};
    await expect(processor.processFile('not-a-file.md', state)).
      rejects.toThrow(new SkipException('Path is not a file not-a-file.md'));
    expect(mockObsidianAdapter.getAbstractFileByPath).toHaveBeenCalledWith('not-a-file.md');
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalledWith("FileProcessor: Path is not a file not-a-file.md");
    expect(spyError).not.toHaveBeenCalled();
  });

  it('should return existing state if state is obsolete', async () => {
    mockObsidianAdapter.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
    const state = {checksum: 'abc', fileClass: 'note', fileMtime: 900};
    mockFileClassDeductionService.getFileClassFromMetadata = jest.fn().mockReturnValue('newClass');
    await expect(processor.processFile('test-file.md', state)).
      rejects.toThrow(new SkipException('State is obsolete for file test-file.md'));
    expect(mockObsidianAdapter.getAbstractFileByPath).toHaveBeenCalledWith('test-file.md');
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });

  it('should return existing state if checksum is unchanged', async () => {
    mockObsidianAdapter.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
    mockObsidianAdapter.getCachedFile = jest.fn().mockReturnValue({frontmatter: {key: 'value'}} as CachedMetadata);
    const state = {checksum: '2edad70e1d5d25e59c9e9c9f282bc9e5d8782b3b0e3c030bcc9150ef7e7c2275', fileClass: 'note', fileMtime: 1500};
    await expect(processor.processFile('test-file.md', state)).
      rejects.toThrow(new SkipException('No changes detected for file: test-file.md'));
    expect(mockObsidianAdapter.getAbstractFileByPath).toHaveBeenCalledWith('test-file.md');
    expect(mockObsidianAdapter.getCachedFile).toHaveBeenCalledWith(mockFile);
    expect(spyInfo).toHaveBeenCalledWith("No changes detected for file: test-file.md");
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });

  it('should compute new state if file changed', async () => {
    mockObsidianAdapter.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
    mockObsidianAdapter.getCachedFile = jest.fn().mockReturnValue({frontmatter: {key: 'value'}} as CachedMetadata);
    mockFileClassDeductionService.getFileClassFromMetadata = jest.fn().mockReturnValue('updated-class');
    metaFlowService.handleFileClassChanged = jest.fn().mockResolvedValue(mockFile);
    const state = {checksum: 'old-checksum', fileClass: 'note', fileMtime: 1500};
    const {file: newFile, state: newState} = await processor.processFile('test-file.md', state);
    expect(newState).not.toBe(state);
    expect(newState.checksum).toBe('2edad70e1d5d25e59c9e9c9f282bc9e5d8782b3b0e3c030bcc9150ef7e7c2275');
    expect(newState.fileClass).toBe('updated-class');
    expect(newState.fileMtime).toBe(1000);
    expect(newFile).toBe(mockFile);
    expect(mockObsidianAdapter.getAbstractFileByPath).toHaveBeenCalledWith('test-file.md');
    expect(mockObsidianAdapter.getCachedFile).toHaveBeenCalledWith(mockFile);
    expect(mockFileClassDeductionService.getFileClassFromMetadata).toHaveBeenCalledWith({key: 'value'});
    expect(spyInfo).toHaveBeenCalledWith('Processing file: test-file.md with fileClass: updated-class');
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });
});
