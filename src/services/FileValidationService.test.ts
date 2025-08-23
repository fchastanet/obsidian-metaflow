import {TFile} from "obsidian";
import {FileValidationService} from "./FileValidationService";
import {MetaFlowSettings} from "../settings/types";
import {MetaFlowException} from "../MetaFlowException";
import {DEFAULT_SETTINGS} from "../settings/defaultSettings";

// Mock Obsidian modules
jest.mock('obsidian', () => ({
  TFile: jest.fn(),
}));

describe('FileValidationService', () => {
  let fileValidationService: FileValidationService;
  let mockMetaFlowSettings: MetaFlowSettings;
  let mockMetadataMenuAdapter: any;
  let mockTemplaterAdapter: any;
  let mockObsidianAdapter: any;
  let mockFile: TFile;

  beforeEach(() => {
    mockMetaFlowSettings = {
      ...DEFAULT_SETTINGS,
      autoMetadataInsertion: true,
      excludeFolders: ['excluded-folder']
    };

    mockMetadataMenuAdapter = {
      isMetadataMenuAvailable: jest.fn().mockReturnValue(true)
    };

    mockTemplaterAdapter = {
      isTemplaterAvailable: jest.fn().mockReturnValue(true)
    };

    mockObsidianAdapter = {
      folderPrefix: jest.fn().mockImplementation((folder: string) => folder === '/' ? '/' : `${folder}/`)
    };

    // Create a proper mock TFile instance
    mockFile = Object.create(TFile.prototype);
    Object.assign(mockFile, {
      name: 'test.md',
      extension: 'md',
      path: 'test.md'
    });

    fileValidationService = new FileValidationService(
      mockMetaFlowSettings,
      mockMetadataMenuAdapter,
      mockTemplaterAdapter,
      mockObsidianAdapter
    );
  });

  describe('checkIfAutomaticMetadataInsertionEnabled', () => {
    it('should not throw when auto metadata insertion is enabled', () => {
      expect(() => fileValidationService.checkIfAutomaticMetadataInsertionEnabled()).not.toThrow();
    });

    it('should throw when auto metadata insertion is disabled', () => {
      mockMetaFlowSettings.autoMetadataInsertion = false;

      expect(() => fileValidationService.checkIfAutomaticMetadataInsertionEnabled())
        .toThrow(MetaFlowException);
      expect(() => fileValidationService.checkIfAutomaticMetadataInsertionEnabled())
        .toThrow('Auto metadata insertion is disabled');
    });
  });

  describe('checkIfValidFile', () => {
    it('should not throw for valid markdown file', () => {
      expect(() => fileValidationService.checkIfValidFile(mockFile)).not.toThrow();
    });

    it('should throw for non-TFile object', () => {
      expect(() => fileValidationService.checkIfValidFile(null as any))
        .toThrow(MetaFlowException);
      expect(() => fileValidationService.checkIfValidFile(null as any))
        .toThrow('Invalid file provided');
    });

    it('should throw for non-markdown file', () => {
      const txtFile = Object.create(TFile.prototype);
      Object.assign(txtFile, {...mockFile, extension: 'txt'});

      expect(() => fileValidationService.checkIfValidFile(txtFile))
        .toThrow(MetaFlowException);
      expect(() => fileValidationService.checkIfValidFile(txtFile))
        .toThrow('is not a markdown file');
    });
  });

  describe('checkIfExcluded', () => {
    it('should not throw for non-excluded file', () => {
      expect(() => fileValidationService.checkIfExcluded(mockFile)).not.toThrow();
    });

    it('should throw for file in excluded folder', () => {
      const excludedFile = Object.create(TFile.prototype);
      Object.assign(excludedFile, {...mockFile, path: 'excluded-folder/test.md'});
      mockObsidianAdapter.folderPrefix.mockReturnValue('excluded-folder/');

      expect(() => fileValidationService.checkIfExcluded(excludedFile))
        .toThrow(MetaFlowException);
      expect(() => fileValidationService.checkIfExcluded(excludedFile))
        .toThrow('is in an excluded folder');
    });
  });

  describe('checkIfMetadataInsertionApplicable', () => {
    it('should not throw when all conditions are met', () => {
      expect(() => fileValidationService.checkIfMetadataInsertionApplicable(mockFile)).not.toThrow();
    });

    it('should throw when MetadataMenu plugin is not available', () => {
      mockMetadataMenuAdapter.isMetadataMenuAvailable.mockReturnValue(false);

      expect(() => fileValidationService.checkIfMetadataInsertionApplicable(mockFile))
        .toThrow(MetaFlowException);
      expect(() => fileValidationService.checkIfMetadataInsertionApplicable(mockFile))
        .toThrow('MetadataMenu plugin not available');
    });

    it('should throw when Templater plugin is not available', () => {
      mockTemplaterAdapter.isTemplaterAvailable.mockReturnValue(false);

      expect(() => fileValidationService.checkIfMetadataInsertionApplicable(mockFile))
        .toThrow(MetaFlowException);
      expect(() => fileValidationService.checkIfMetadataInsertionApplicable(mockFile))
        .toThrow('Templater plugin not available');
    });
  });
});
