import {TFile, TFolder} from "obsidian";
import {FileOperationsService} from "./FileOperationsService";
import {MetaFlowSettings} from "@metaflow/settings/types";
import {DEFAULT_SETTINGS} from "@metaflow/settings/defaultSettings";
import {LogNoticeManagerInterface} from "@metaflow/managers/types";
import {SkipException} from "@metaflow/SkipException";

// Mock Obsidian modules
jest.mock('obsidian', () => ({
  TFile: jest.fn(),
  TFolder: jest.fn(),
}));

describe('FileOperationsService', () => {
  let fileOperationsService: FileOperationsService;
  let mockApp: any;
  let mockMetaFlowSettings: MetaFlowSettings;
  let mockObsidianAdapter: any;
  let mockFileValidationService: any;
  let mockNoteTitleService: any;
  let mockFile: TFile;
  let mockLogNoticeManager: LogNoticeManagerInterface;
  let mockFileStateCache: any;
  let mockFileClassDeductionService: any;
  let mockPropertyManagementService: any;
  let mockMetadataMenuAdapter: any;
  let spyInfo: jest.SpyInstance;
  let spyWarn: jest.SpyInstance;
  let spyError: jest.SpyInstance;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    spyInfo = jest.spyOn(console, 'info').mockImplementation(() => { });
    spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
    spyError = jest.spyOn(console, 'error').mockImplementation(() => { });

    mockMetaFlowSettings = {
      ...DEFAULT_SETTINGS,
      folderFileClassMappings: [
        {
          folder: '/',
          fileClass: 'default',
          templateMode: 'template',
          moveToFolder: false,
          noteTitleScript: {enabled: false, script: ''},
          noteTitleTemplates: []
        },
        {
          folder: 'books',
          fileClass: 'book',
          templateMode: 'template',
          moveToFolder: true,
          noteTitleScript: {enabled: false, script: ''},
          noteTitleTemplates: []
        }
      ]
    };

    mockApp = {
      vault: {
        getFolderByPath: jest.fn().mockReturnValue({} as TFolder)
      },
      fileManager: {
        processFrontMatter: jest.fn().mockImplementation((file, callback) => {
          const frontmatter = {};
          callback(frontmatter);
          return Promise.resolve();
        })
      }
    };

    mockObsidianAdapter = {
      normalizePath: jest.fn().mockImplementation((path: string) => path),
      moveNote: jest.fn(),
      renameNote: jest.fn().mockResolvedValue({} as TFile),
      isFileExists: jest.fn().mockReturnValue(false),
      isFolderExists: jest.fn().mockReturnValue(true),
      createFolder: jest.fn().mockResolvedValue({} as TFolder),
      getAbstractFileByPath: jest.fn().mockImplementation((path: string) => {
        // Return mockFile for any path that looks like a file
        if (path.includes('.md')) {
          return mockFile;
        }
        return null;
      })
    };

    mockFileValidationService = {
      checkIfValidFile: jest.fn(),
      checkIfExcluded: jest.fn()
    };

    mockNoteTitleService = {
      formatNoteTitle: jest.fn().mockReturnValue('New Title')
    };

    mockFileStateCache = {
      setState: jest.fn(),
    };

    mockFileClassDeductionService = {
      getFileClassFromMetadata: jest.fn(),
      deduceFileClassFromPath: jest.fn(),
      validateFileClassAgainstMapping: jest.fn(),
    };

    mockPropertyManagementService = {
      addDefaultValuesToProperties: jest.fn().mockReturnValue({}),
    };

    mockMetadataMenuAdapter = {
      getFileClassByName: jest.fn(),
      setFileClassInMetadata: jest.fn(),
      syncFields: jest.fn().mockReturnValue({frontmatter: {}}),
    };

    mockLogNoticeManager = {
      addDebug: jest.fn(),
      addInfo: jest.fn(),
      addWarning: jest.fn(),
      addError: jest.fn(),
      addMessage: jest.fn()
    };

    // Create a proper mock TFile instance
    mockFile = Object.create(TFile.prototype);
    Object.assign(mockFile, {
      name: 'test.md',
      basename: 'test',
      extension: 'md',
      path: 'test.md',
      parent: {path: ''}
    });

    fileOperationsService = new FileOperationsService(
      mockApp,
      mockMetaFlowSettings,
      mockObsidianAdapter,
      mockFileValidationService,
      mockNoteTitleService,
      mockLogNoticeManager,
      mockFileStateCache,
      mockFileClassDeductionService,
      mockPropertyManagementService,
      mockMetadataMenuAdapter
    );
  });

  afterEach(() => {
    spyInfo.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  describe('updateFrontmatter', () => {
    it('should call app.fileManager.processFrontMatter', async () => {
      const enrichedFrontmatter = {title: 'Test Title', author: 'Test Author'};

      await fileOperationsService.updateFrontmatter(mockFile, enrichedFrontmatter, false);

      expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalledWith(
        mockFile,
        expect.any(Function)
      );
    });

    it('should delete empty keys when deleteEmptyKeys is true', async () => {
      const enrichedFrontmatter = {title: 'Test Title'};
      const frontmatter = {
        title: 'Test Title',
        emptyString: '',
        nullValue: null,
        undefinedValue: undefined,
        validValue: 'keep this'
      };

      // @ts-expect-error: testing private method
      await FileOperationsService.innerUpdateFrontmatter(mockFile, frontmatter, enrichedFrontmatter, true);

      // Empty keys should be deleted
      expect(frontmatter.emptyString).toBeUndefined();
      expect(frontmatter.nullValue).toBeUndefined();
      expect(frontmatter.undefinedValue).toBeUndefined();
      expect(frontmatter.validValue).toBe('keep this');
      expect(frontmatter.title).toBe('Test Title');
    });
  });

  describe('moveFile', () => {
    it('should return the file if target path is unchanged', async () => {
      mockObsidianAdapter.normalizePath.mockReturnValue(mockFile.path);
      const result = await (fileOperationsService as any).moveFile(
        mockFile,
        'book',
        mockFile.basename,
        mockFile.parent!.path
      );
      expect(result).toBe(mockFile);
      expect(mockObsidianAdapter.moveNote).not.toHaveBeenCalled();
    });

    it('should create folder if moving to a new folder', async () => {
      mockObsidianAdapter.normalizePath.mockReturnValue('books/test.md');
      mockObsidianAdapter.isFileExists.mockReturnValue(false);
      mockObsidianAdapter.getFileFrontmatter = jest.fn().mockResolvedValue({key: 'value'});
      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(mockFile);
      // @ts-expect-error : testing private method
      const result = await fileOperationsService.moveFile(
        mockFile,
        'book',
        mockFile.basename,
        'books'
      );
      expect(mockObsidianAdapter.isFolderExists).toHaveBeenCalledWith('books');
      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'books/test.md');
      expect(result).toBe(mockFile);
    });

    it('should resolve file conflicts with incremental numbering', async () => {
      mockObsidianAdapter.normalizePath.mockImplementation((path: string) => path);
      let callCount = 0;
      mockObsidianAdapter.isFileExists.mockImplementation((path: string) => {
        callCount++;
        return callCount === 1; // First call returns true (conflict), second returns false
      });
      mockObsidianAdapter.getFileFrontmatter = jest.fn().mockResolvedValue({key: 'value'});
      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(mockFile);
      const result = await (fileOperationsService as any).moveFile(
        mockFile,
        'book',
        mockFile.basename,
        'books'
      );
      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'books/test 1.md');
      expect(result).toBe(mockFile);
    });

    it('should throw if updated file reference is not a TFile', async () => {
      mockObsidianAdapter.normalizePath.mockReturnValue('books/test.md');
      mockObsidianAdapter.isFileExists.mockReturnValue(false);
      mockObsidianAdapter.getFileFrontmatter = jest.fn().mockResolvedValue({key: 'value'});
      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue({}); // Not a TFile
      await expect((fileOperationsService as any).moveFile(
        mockFile,
        'book',
        mockFile.basename,
        'books'
      )).rejects.toThrow('Failed to get updated file reference at books/test.md');
    });

    it('should throw MetaFlowException if frontmatter is null', async () => {
      mockObsidianAdapter.normalizePath.mockReturnValue('books/test.md');
      mockObsidianAdapter.isFileExists.mockReturnValue(false);
      mockObsidianAdapter.getFileFrontmatter = jest.fn().mockResolvedValue(null);
      await expect((fileOperationsService as any).moveFile(
        mockFile,
        'book',
        mockFile.basename,
        'books'
      )).rejects.toThrow('Unable to read frontmatter for file test.md');
    });
  });

  describe('renameNote', () => {
    it('should return file if title does not change', async () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('test'); // Same as basename

      const result = await fileOperationsService.renameNote(mockFile, 'book', {});

      expect(result).toBe(mockFile);
      expect(mockObsidianAdapter.moveNote).not.toHaveBeenCalled();
    });

    it('should rename note with new title', async () => {
      // Create a mock file that represents the renamed file
      const renamedFile = Object.create(TFile.prototype);
      Object.assign(renamedFile, {
        name: 'New Title.md',
        basename: 'New Title',
        extension: 'md',
        path: 'New Title.md',
        parent: {path: ''}
      });

      mockObsidianAdapter.getFileFrontmatter = jest.fn().mockResolvedValue({key: 'value'});
      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(renamedFile);

      const result = await fileOperationsService.renameNote(mockFile, 'book', {});

      expect(result).toBe(renamedFile);
      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'New Title.md');
      expect(mockLogNoticeManager.addInfo).toHaveBeenCalledWith('File "test.md" renamed to "New Title.md"');
    });

    it('should return file if new title would be "Untitled"', async () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('Untitled');

      const result = await fileOperationsService.renameNote(mockFile, 'book', {});

      expect(result).toBe(mockFile);
      expect(mockObsidianAdapter.renameNote).not.toHaveBeenCalled();
    });

    it('should throw error if target file already exists', async () => {
      // Make isFileExists return true to simulate conflict, but the new implementation
      // should handle conflicts by incrementing, so this might not throw the same error
      mockObsidianAdapter.isFileExists.mockReturnValue(true);

      // Since the new implementation handles conflicts with incremental numbering,
      // it won't throw the "already exists" error anymore. Let's test for successful handling instead.
      const renamedFile = Object.create(TFile.prototype);
      Object.assign(renamedFile, {
        name: 'New Title 1.md',
        basename: 'New Title 1',
        extension: 'md',
        path: 'New Title 1.md',
        parent: {path: ''}
      });

      // Mock isFileExists to simulate conflict resolution
      mockObsidianAdapter.isFileExists.mockImplementation((path: string) => {
        if (path === 'New Title.md') return true;  // Original conflicts
        if (path === 'New Title 1.md') return false; // First increment is available
        return false;
      });
      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(renamedFile);
      mockObsidianAdapter.getFileFrontmatter = jest.fn().mockResolvedValue({key: 'value'});

      const result = await fileOperationsService.renameNote(mockFile, 'book', {});

      expect(result).toBe(renamedFile);
      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'New Title 1.md');
      expect(mockLogNoticeManager.addInfo).toHaveBeenCalledWith('File "test.md" renamed to "New Title 1.md" (conflict resolved with incremental number)');
    });
  });

  describe('getNewNoteTitle', () => {
    it('should return new title when title needs to change', () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('New Title');
      mockFile.basename = 'Old Title';

      // @ts-expect-error : testing private method
      const result = fileOperationsService.getNewNoteTitle(mockFile, 'book', {});

      expect(result).toBe('New Title');
      expect(mockNoteTitleService.formatNoteTitle).toHaveBeenCalledWith(mockFile, 'book', {});
    });

    it('should return original file title when title does not need to change', () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('Same Title');
      mockFile.basename = 'Same Title';

      // @ts-expect-error : testing private method
      const result = fileOperationsService.getNewNoteTitle(mockFile, 'book', {});

      expect(result).toBe(mockFile.basename);
    });

    it('should return original file title when new title would be "Untitled"', () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('Untitled');
      mockFile.basename = 'Current Title';

      // @ts-expect-error : testing private method
      const result = fileOperationsService.getNewNoteTitle(mockFile, 'book', {});

      expect(result).toBe(mockFile.basename);
    });

    it('should throw MetaFlowException on error', () => {
      mockNoteTitleService.formatNoteTitle.mockImplementation(() => {
        throw new Error('Title generation failed');
      });

      expect(() => {
        // @ts-expect-error : testing private method
        fileOperationsService.getNewNoteTitle(mockFile, 'book', {});
      }).toThrow('Error getting new title for note "test.md": Title generation failed');
    });
  });

  describe('getNewNoteFolder', () => {
    it('should return target folder when move is needed', () => {
      mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
      mockFileValidationService.checkIfExcluded.mockReturnValue(undefined);

      // Mock current file in different folder
      const mockParent = Object.create(TFolder.prototype);
      Object.assign(mockParent, {path: 'articles'});
      mockFile.parent = mockParent;

      // @ts-expect-error : testing private method
      const result = fileOperationsService.getNewNoteFolder(mockFile, 'book');

      expect(result).toBe('books');
    });

    it('should return old folder when file is already in correct folder', () => {
      mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
      mockFileValidationService.checkIfExcluded.mockReturnValue(undefined);

      // Mock current file already in target folder
      const mockParent = Object.create(TFolder.prototype);
      Object.assign(mockParent, {path: 'books'});
      mockFile.parent = mockParent;

      // @ts-expect-error : testing private method
      const result = fileOperationsService.getNewNoteFolder(mockFile, 'book');

      expect(result).toBe('books');
    });

    it('should return old folder when moveToFolder is disabled', () => {
      mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
      mockFileValidationService.checkIfExcluded.mockReturnValue(undefined);

      // @ts-expect-error : testing private method
      const result = fileOperationsService.getNewNoteFolder(mockFile, 'default');

      expect(result).toBe('');
    });

    it('should throw error when no target folder is defined', () => {
      mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
      mockFileValidationService.checkIfExcluded.mockReturnValue(undefined);

      expect(() => {
        // @ts-expect-error : testing private method
        fileOperationsService.getNewNoteFolder(mockFile, 'nonexistent');
      }).toThrow('No target folder defined for fileClass "nonexistent"');
    });
  });
});

describe('FileOperationsService - processFile', () => {
  let fileOperationsService: FileOperationsService;
  let mockApp: any;
  let mockMetaFlowSettings: MetaFlowSettings;
  let mockObsidianAdapter: any;
  let mockFileValidationService: any;
  let mockNoteTitleService: any;
  let mockFile: TFile;
  let mockLogNoticeManager: LogNoticeManagerInterface;
  let mockFileStateCache: any;
  let mockFileClassDeductionService: any;
  let mockPropertyManagementService: any;
  let mockMetadataMenuAdapter: any;
  let spyInfo: jest.SpyInstance;
  let spyWarn: jest.SpyInstance;
  let spyError: jest.SpyInstance;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    spyInfo = jest.spyOn(console, 'info').mockImplementation(() => { });
    spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
    spyError = jest.spyOn(console, 'error').mockImplementation(() => { });

    mockMetaFlowSettings = {
      ...DEFAULT_SETTINGS,
      autoSort: false,
      autoMetadataInsertion: true,
      autoRenameNote: false,
      autoMoveNoteToRightFolder: false,
    } as MetaFlowSettings;

    mockApp = {
      fileManager: {
        processFrontMatter: jest.fn().mockImplementation((file, callback) => {
          const frontmatter = {};
          callback(frontmatter);
          return Promise.resolve();
        }),
      },
    };

    mockObsidianAdapter = {
      getAbstractFileByPath: jest.fn(),
      getFileFrontmatter: jest.fn().mockResolvedValue({key: 'value'}),
      normalizePath: jest.fn().mockImplementation((path: string) => path),
      isFileExists: jest.fn().mockReturnValue(false),
      moveNote: jest.fn(),
    };

    mockFileValidationService = {
      checkIfAutomaticMetadataInsertionEnabled: jest.fn(),
      checkIfMetadataInsertionApplicable: jest.fn(),
    };

    mockNoteTitleService = {};

    mockFileStateCache = {
      setState: jest.fn(),
    };

    mockFileClassDeductionService = {
      getFileClassFromMetadata: jest.fn().mockReturnValue('note'),
    };

    mockPropertyManagementService = {
      addDefaultValuesToProperties: jest.fn().mockReturnValue({key: 'value'}),
    };

    mockMetadataMenuAdapter = {
      getFileClassByName: jest.fn(),
      setFileClassInMetadata: jest.fn(),
      syncFields: jest.fn().mockReturnValue({frontmatter: {}}),
    };

    mockLogNoticeManager = {
      addDebug: jest.fn(),
      addInfo: jest.fn(),
      addWarning: jest.fn(),
      addError: jest.fn(),
      addMessage: jest.fn(),
    };

    // Create mock file
    mockFile = Object.create(TFile.prototype);
    mockFile.basename = 'test-file';
    mockFile.path = 'test-file.md';
    mockFile.stat = {mtime: 1000, ctime: 1000, size: 100};
    const mockParent = Object.create(TFolder.prototype);
    mockParent.path = '';
    mockFile.parent = mockParent;

    fileOperationsService = new FileOperationsService(
      mockApp,
      mockMetaFlowSettings,
      mockObsidianAdapter,
      mockFileValidationService,
      mockNoteTitleService,
      mockLogNoticeManager,
      mockFileStateCache,
      mockFileClassDeductionService,
      mockPropertyManagementService,
      mockMetadataMenuAdapter
    );
  });

  afterEach(() => {
    spyInfo.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  it('should return existing state if file not found', async () => {
    mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(null);
    const state = {checksum: 'abc', fileClass: 'note', fileMtime: 500};

    await expect(fileOperationsService.processFile('nonexistent.md', state)).
      rejects.toThrow(new SkipException('File not found for path nonexistent.md'));
    expect(mockObsidianAdapter.getAbstractFileByPath).toHaveBeenCalledWith('nonexistent.md');
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalledWith("FileOperationsService: File not found for path nonexistent.md");
    expect(spyError).not.toHaveBeenCalled();
  });

  it('should return existing state if path is not a file', async () => {
    mockObsidianAdapter.getAbstractFileByPath.mockReturnValue({});
    const state = {checksum: 'abc', fileClass: 'note', fileMtime: 500};
    await expect(fileOperationsService.processFile('not-a-file.md', state)).
      rejects.toThrow(new SkipException('Path is not a file not-a-file.md'));
    expect(mockObsidianAdapter.getAbstractFileByPath).toHaveBeenCalledWith('not-a-file.md');
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalledWith("FileOperationsService: Path is not a file not-a-file.md");
    expect(spyError).not.toHaveBeenCalled();
  });

  it('should return existing state if state is obsolete', async () => {
    mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(mockFile);
    const state = {checksum: 'abc', fileClass: 'note', fileMtime: 900};
    await expect(fileOperationsService.processFile('test-file.md', state)).
      rejects.toThrow(new SkipException('State is obsolete for file test-file.md'));
    expect(mockObsidianAdapter.getAbstractFileByPath).toHaveBeenCalledWith('test-file.md');
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });

  it('should return existing state if checksum is unchanged', async () => {
    mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(mockFile);
    mockObsidianAdapter.getFileFrontmatter.mockResolvedValue({key: 'value'});
    // Use the same checksum that would be computed
    const expectedChecksum = 'e49bc02f932386839eec6a85f2e89c1797d484451ae9c56d49a68dd32974210a';
    const state = {checksum: expectedChecksum, fileClass: 'note', fileMtime: 1500};
    await expect(fileOperationsService.processFile('test-file.md', state)).
      rejects.toThrow(new SkipException('No changes detected for file: test-file.md'));
    expect(mockObsidianAdapter.getAbstractFileByPath).toHaveBeenCalledWith('test-file.md');
    expect(mockObsidianAdapter.getFileFrontmatter).toHaveBeenCalledWith(mockFile);
    expect(spyInfo).toHaveBeenCalledWith("No changes detected for file: test-file.md");
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });

  it('should compute new state if file changed', async () => {
    mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(mockFile);
    mockObsidianAdapter.getFileFrontmatter.mockResolvedValue({key: 'value'});
    mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue('updated-class');
    const state = {checksum: 'old-checksum', fileClass: 'note', fileMtime: 1500};
    const {file: newFile, state: newState} = await fileOperationsService.processFile('test-file.md', state);
    expect(newState).not.toBe(state);
    expect(newState.checksum).toBe('e49bc02f932386839eec6a85f2e89c1797d484451ae9c56d49a68dd32974210a');
    expect(newState.fileClass).toBe('updated-class');
    expect(newState.fileMtime).toBe(2000);
    expect(newFile).toBe(mockFile);
    expect(mockObsidianAdapter.getAbstractFileByPath).toHaveBeenCalledWith('test-file.md');
    expect(mockObsidianAdapter.getFileFrontmatter).toHaveBeenCalledWith(mockFile);
    expect(mockFileClassDeductionService.getFileClassFromMetadata).toHaveBeenCalledWith({key: 'value'});
    expect(spyInfo).toHaveBeenCalledWith('Processing file: test-file.md with fileClass: updated-class');
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });
});
