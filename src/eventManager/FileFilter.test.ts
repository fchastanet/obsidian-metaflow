import {FileFilter} from './FileFilter';
import {TFile} from 'obsidian';

describe('FileFilter', () => {
  let fileValidationService: any;
  let obsidianAdapter: any;
  let settings: any;
  let filter: FileFilter;
  let spyDebug: jest.SpyInstance;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    spyDebug = jest.spyOn(console, 'debug').mockImplementation(() => { });
    fileValidationService = {
      ifFileExcluded: jest.fn().mockReturnValue(false),
    };
    obsidianAdapter = {
      getCachedFile: jest.fn().mockReturnValue({frontmatter: {key: 'value'}}),
    };
    settings = {
      debugMode: true,
    };
    filter = new FileFilter(fileValidationService, obsidianAdapter, settings, 1000);
  });

  afterEach(() => {
    spyDebug.mockRestore();
  });

  it('should return false if file is null or undefined', () => {
    expect(filter.isApplicable(null)).toBe(false);
    expect(spyDebug).toHaveBeenCalledWith("FileClassStateManager: isApplicable - file is null or undefined");
    expect(filter.isApplicable(undefined)).toBe(false);
    expect(spyDebug).toHaveBeenCalledWith("FileClassStateManager: isApplicable - file is null or undefined");
  });

  it('should return false if file is not a TFile', () => {
    expect(filter.isApplicable({} as any)).toBe(false);
    expect(spyDebug).toHaveBeenCalledWith("FileClassStateManager: isApplicable - file is not a TFile", {});
  });

  it('should return false if file has no basename or path', () => {
    const file = Object.create(TFile.prototype);
    file.basename = '';
    file.path = '';
    file.stat = {mtime: 2000};
    expect(filter.isApplicable(file)).toBe(false);
    expect(spyDebug).toHaveBeenCalledWith("FileClassStateManager: isApplicable - file is missing basename or path", file);
  });

  it('should return false if file is deleted', () => {
    const file = Object.create(TFile.prototype);
    file.basename = 'test';
    file.path = 'test.md';
    file.extension = 'md';
    file.deleted = true;
    file.stat = {mtime: 2000};
    expect(filter.isApplicable(file)).toBe(false);
    expect(spyDebug).toHaveBeenCalledWith("FileClassStateManager: isApplicable - file is deleted", file);
  });

  it('should return false if file extension is not md', () => {
    const file = Object.create(TFile.prototype);
    file.basename = 'test';
    file.path = 'test.txt';
    file.extension = 'txt';
    file.stat = {mtime: 2000};
    expect(filter.isApplicable(file)).toBe(false);
    expect(spyDebug).toHaveBeenCalledWith("FileClassStateManager: isApplicable - file is not a Markdown file", file);
  });

  it('should return false if file is excluded by validation service', () => {
    fileValidationService.ifFileExcluded.mockReturnValue(true);
    const file = Object.create(TFile.prototype);
    file.basename = 'test';
    file.path = 'test.md';
    file.extension = 'md';
    file.stat = {mtime: 2000};
    expect(filter.isApplicable(file)).toBe(false);
    expect(spyDebug).toHaveBeenCalledWith("FileClassStateManager: isApplicable - file is excluded", file);
  });

  it('should return false if file has no frontmatter', () => {
    obsidianAdapter.getCachedFile.mockReturnValue({});
    const file = Object.create(TFile.prototype);
    file.basename = 'test';
    file.path = 'test.md';
    file.extension = 'md';
    file.stat = {mtime: 2000};
    expect(filter.isApplicable(file)).toBe(false);
    expect(spyDebug).toHaveBeenCalledWith("FileClassStateManager: isApplicable - file is missing frontmatter", file);
  });

  it('should return false if file is outdated', () => {
    const file = Object.create(TFile.prototype);
    file.basename = 'test';
    file.path = 'test.md';
    file.extension = 'md';
    file.stat = {mtime: 500};
    expect(filter.isApplicable(file)).toBe(false);
    expect(spyDebug).toHaveBeenCalledWith("FileClassStateManager: isApplicable - file is outdated", file);
  });

  it('should return true for valid markdown file with frontmatter', () => {
    const file = Object.create(TFile.prototype);
    file.basename = 'test';
    file.path = 'test.md';
    file.extension = 'md';
    file.stat = {mtime: 2000};
    expect(filter.isApplicable(file)).toBe(true);
    expect(spyDebug).not.toHaveBeenCalled();
  });
});
