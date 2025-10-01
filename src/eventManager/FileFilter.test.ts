import {FileFilter} from './FileFilter';
import {TFile} from 'obsidian';

describe('FileFilter', () => {
  let fileValidationService: any;
  let obsidianAdapter: any;
  let filter: FileFilter;

  beforeEach(() => {
    fileValidationService = {
      ifFileExcluded: jest.fn().mockReturnValue(false),
    };
    obsidianAdapter = {
      getCachedFile: jest.fn().mockReturnValue({frontmatter: {key: 'value'}}),
    };
    filter = new FileFilter(fileValidationService, obsidianAdapter);
  });

  it('should return false if file is null or undefined', () => {
    expect(filter.isApplicable(null)).toBe(false);
    expect(filter.isApplicable(undefined)).toBe(false);
  });

  it('should return false if file is not a TFile', () => {
    expect(filter.isApplicable({} as any)).toBe(false);
  });

  it('should return false if file has no basename or path', () => {
    const file = Object.create(TFile.prototype);
    file.basename = '';
    file.path = '';
    expect(filter.isApplicable(file)).toBe(false);
  });

  it('should return false if file is deleted', () => {
    const file = Object.create(TFile.prototype);
    file.basename = 'test';
    file.path = 'test.md';
    file.extension = 'md';
    file.deleted = true;
    expect(filter.isApplicable(file)).toBe(false);
  });

  it('should return false if file extension is not md', () => {
    const file = Object.create(TFile.prototype);
    file.basename = 'test';
    file.path = 'test.txt';
    file.extension = 'txt';
    expect(filter.isApplicable(file)).toBe(false);
  });

  it('should return false if file is excluded by validation service', () => {
    fileValidationService.ifFileExcluded.mockReturnValue(true);
    const file = Object.create(TFile.prototype);
    file.basename = 'test';
    file.path = 'test.md';
    file.extension = 'md';
    expect(filter.isApplicable(file)).toBe(false);
  });

  it('should return false if file has no frontmatter', () => {
    obsidianAdapter.getCachedFile.mockReturnValue({});
    const file = Object.create(TFile.prototype);
    file.basename = 'test';
    file.path = 'test.md';
    file.extension = 'md';
    expect(filter.isApplicable(file)).toBe(false);
  });

  it('should return true for valid markdown file with frontmatter', () => {
    const file = Object.create(TFile.prototype);
    file.basename = 'test';
    file.path = 'test.md';
    file.extension = 'md';
    expect(filter.isApplicable(file)).toBe(true);
  });
});
