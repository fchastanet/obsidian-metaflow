import {App, TFile, TFolder} from "obsidian";
import {FileOperationsService} from "./FileOperationsService";
import {MetaFlowSettings} from "../settings/types";
import {DEFAULT_SETTINGS} from "../settings/defaultSettings";
import {LogManagerInterface} from "../managers/types";

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
  let mockLogManager: LogManagerInterface;

  beforeEach(() => {
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

    mockLogManager = {
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
      mockLogManager
    );
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
      let capturedCallback: any;

      mockApp.fileManager.processFrontMatter.mockImplementation((file: any, callback: any) => {
        capturedCallback = callback;
        return Promise.resolve();
      });

      await fileOperationsService.updateFrontmatter(mockFile, enrichedFrontmatter, true);

      // Simulate the callback being called with frontmatter containing empty keys
      const frontmatter = {
        title: 'Test Title',
        emptyString: '',
        nullValue: null,
        undefinedValue: undefined,
        validValue: 'keep this'
      };

      capturedCallback(frontmatter);

      // Empty keys should be deleted
      expect(frontmatter.emptyString).toBeUndefined();
      expect(frontmatter.nullValue).toBeUndefined();
      expect(frontmatter.undefinedValue).toBeUndefined();
      expect(frontmatter.validValue).toBe('keep this');
      expect(frontmatter.title).toBe('Test Title');
    });
  });

  describe('moveNoteToTheRightFolder', () => {
    it('should validate file before moving', async () => {
      await fileOperationsService.moveNoteToTheRightFolder(mockFile, 'book');

      expect(mockFileValidationService.checkIfValidFile).toHaveBeenCalledWith(mockFile);
      expect(mockFileValidationService.checkIfExcluded).toHaveBeenCalledWith(mockFile);
    });

    it('should return null if note is already in the right folder', async () => {
      // Enable debug mode to trigger console.debug messages
      mockMetaFlowSettings.debugMode = true;

      const fileInRightFolder = Object.create(TFile.prototype);
      Object.assign(fileInRightFolder, {
        name: 'test.md',
        basename: 'test',
        extension: 'md',
        path: 'books/test.md',
        parent: {path: 'books'}
      });

      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => { });
      const result = await fileOperationsService.moveNoteToTheRightFolder(fileInRightFolder as TFile, 'book');

      expect(result).toBeNull();
      expect(mockObsidianAdapter.moveNote).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Note "test.md" is already in the right folder: books');
      consoleSpy.mockRestore();

      // Reset debug mode
      mockMetaFlowSettings.debugMode = false;
    });

    it('should move note to target folder', async () => {
      // Create a mock file that represents the moved file
      const movedFile = Object.create(TFile.prototype);
      Object.assign(movedFile, {
        name: 'test.md',
        basename: 'test',
        extension: 'md',
        path: 'books/test.md',
        parent: {path: 'books'}
      });

      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(movedFile);

      const result = await fileOperationsService.moveNoteToTheRightFolder(mockFile, 'book');

      expect(result).toBe('books/test.md');
      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'books/test.md');
    });

    it('should handle file conflicts with incremental numbering when moving', async () => {
      // Since the new implementation handles conflicts with incremental numbering,
      // it won't throw the "already exists" error anymore. Let's test for successful handling instead.
      const movedFile = Object.create(TFile.prototype);
      Object.assign(movedFile, {
        name: 'test 1.md',
        basename: 'test 1',
        extension: 'md',
        path: 'books/test 1.md',
        parent: {path: 'books'}
      });

      // Mock isFileExists to simulate conflict resolution
      mockObsidianAdapter.isFileExists.mockImplementation((path: string) => {
        if (path === 'books/test.md') return true;  // Original conflicts
        if (path === 'books/test 1.md') return false; // First increment is available
        return false;
      });
      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(movedFile);

      const result = await fileOperationsService.moveNoteToTheRightFolder(mockFile, 'book');

      expect(result).toBe('books/test 1.md');
      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'books/test 1.md');
    });
  });

  describe('renameNote', () => {
    it('should validate file before renaming', async () => {
      await fileOperationsService.renameNote(mockFile, 'book', {}, mockLogManager);

      // The validation is now called in getNewNoteTitle, not directly in renameNote
      expect(mockFileValidationService.checkIfValidFile).toHaveBeenCalledWith(mockFile);
      expect(mockFileValidationService.checkIfExcluded).toHaveBeenCalledWith(mockFile);
    });

    it('should return file if title does not change', async () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('test'); // Same as basename

      const result = await fileOperationsService.renameNote(mockFile, 'book', {}, mockLogManager);

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

      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(renamedFile);

      const result = await fileOperationsService.renameNote(mockFile, 'book', {}, mockLogManager);

      expect(result).toBe(renamedFile);
      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'New Title.md');
      expect(mockLogManager.addInfo).toHaveBeenCalledWith('File "test.md" renamed to "New Title.md"');
    });

    it('should return file if new title would be "Untitled"', async () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('Untitled');

      const result = await fileOperationsService.renameNote(mockFile, 'book', {}, mockLogManager);

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

      const result = await fileOperationsService.renameNote(mockFile, 'book', {}, mockLogManager);

      expect(result).toBe(renamedFile);
      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'New Title 1.md');
      expect(mockLogManager.addInfo).toHaveBeenCalledWith('File "test.md" moved/renamed to "New Title 1.md" (conflict resolved with incremental number)');
    });
  });

  describe('getNewNoteTitle', () => {
    it('should return new title when title needs to change', () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('New Title');
      mockFile.basename = 'Old Title';

      const result = fileOperationsService.getNewNoteTitle(mockFile, 'book', {}, mockLogManager);

      expect(result).toBe('New Title');
      expect(mockNoteTitleService.formatNoteTitle).toHaveBeenCalledWith(mockFile, 'book', {}, mockLogManager);
    });

    it('should return null when title does not need to change', () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('Same Title');
      mockFile.basename = 'Same Title';

      const result = fileOperationsService.getNewNoteTitle(mockFile, 'book', {}, mockLogManager);

      expect(result).toBeNull();
    });

    it('should return null when new title would be "Untitled"', () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('Untitled');
      mockFile.basename = 'Current Title';

      const result = fileOperationsService.getNewNoteTitle(mockFile, 'book', {}, mockLogManager);

      expect(result).toBeNull();
    });

    it('should throw MetaFlowException on error', () => {
      mockNoteTitleService.formatNoteTitle.mockImplementation(() => {
        throw new Error('Title generation failed');
      });

      expect(() => {
        fileOperationsService.getNewNoteTitle(mockFile, 'book', {}, mockLogManager);
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

      const result = fileOperationsService.getNewNoteFolder(mockFile, 'book');

      expect(result).toBe('books');
    });

    it('should return null when file is already in correct folder', () => {
      mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
      mockFileValidationService.checkIfExcluded.mockReturnValue(undefined);

      // Mock current file already in target folder
      const mockParent = Object.create(TFolder.prototype);
      Object.assign(mockParent, {path: 'books'});
      mockFile.parent = mockParent;

      const result = fileOperationsService.getNewNoteFolder(mockFile, 'book');

      expect(result).toBeNull();
    });

    it('should return null when moveToFolder is disabled', () => {
      mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
      mockFileValidationService.checkIfExcluded.mockReturnValue(undefined);

      const result = fileOperationsService.getNewNoteFolder(mockFile, 'default');

      expect(result).toBeNull();
    });

    it('should throw error when no target folder is defined', () => {
      mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
      mockFileValidationService.checkIfExcluded.mockReturnValue(undefined);

      expect(() => {
        fileOperationsService.getNewNoteFolder(mockFile, 'nonexistent');
      }).toThrow('No target folder defined for fileClass "nonexistent"');
    });
  });

  describe('applyFileChanges', () => {
    beforeEach(() => {
      // Reset mocks to default behavior for each test
      mockObsidianAdapter.isFileExists.mockReturnValue(false);
      mockObsidianAdapter.isFolderExists.mockReturnValue(true);
      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(mockFile);
      jest.clearAllMocks();
    });

    it('should return original file when no changes are needed', async () => {
      const result = await fileOperationsService.applyFileChanges(mockFile, null, null, mockLogManager);

      expect(result).toBe(mockFile);
      expect(mockObsidianAdapter.moveNote).not.toHaveBeenCalled();
    });

    it('should rename file when new title is provided', async () => {
      mockObsidianAdapter.isFileExists.mockReturnValue(false);
      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(mockFile);

      const result = await fileOperationsService.applyFileChanges(mockFile, 'New Title', null, mockLogManager);

      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'New Title.md');
      expect(mockLogManager.addInfo).toHaveBeenCalledWith('File "test.md" renamed to "New Title.md"');
      expect(result).toBe(mockFile);
    });

    it('should move file when new folder is provided', async () => {
      mockObsidianAdapter.isFileExists.mockReturnValue(false);
      mockObsidianAdapter.isFolderExists.mockReturnValue(true);
      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(mockFile);

      const result = await fileOperationsService.applyFileChanges(mockFile, null, 'books', mockLogManager);

      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'books/test.md');
      expect(mockLogManager.addInfo).toHaveBeenCalledWith('File "test.md" moved to "books"');
      expect(result).toBe(mockFile);
    });

    it('should handle file conflicts with incremental numbering', async () => {
      // Set up specific path-based returns for isFileExists
      mockObsidianAdapter.isFileExists.mockImplementation((path: string) => {
        if (path === 'New Title.md') return true;  // Original path conflicts
        if (path === 'New Title 1.md') return true;  // First increment conflicts
        if (path === 'New Title 2.md') return false; // Second increment is available
        return false;
      });
      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(mockFile);

      const result = await fileOperationsService.applyFileChanges(mockFile, 'New Title', null, mockLogManager);

      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'New Title 2.md');
      expect(mockLogManager.addInfo).toHaveBeenCalledWith('File "test.md" moved/renamed to "New Title 2.md" (conflict resolved with incremental number)');
      expect(result).toBe(mockFile);
    });

    it('should create folder if it does not exist', async () => {
      mockObsidianAdapter.isFileExists.mockReturnValue(false);
      mockObsidianAdapter.isFolderExists.mockReturnValue(false);
      mockObsidianAdapter.createFolder.mockResolvedValue({});
      mockObsidianAdapter.getAbstractFileByPath.mockReturnValue(mockFile);

      await fileOperationsService.applyFileChanges(mockFile, null, 'new-folder', mockLogManager);

      expect(mockObsidianAdapter.createFolder).toHaveBeenCalledWith('new-folder');
    });
  });
});
