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
      createFolder: jest.fn().mockResolvedValue({} as TFolder)
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
      mockNoteTitleService
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
      const fileInRightFolder = {...mockFile, parent: {path: 'books'}};
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => { });
      const result = await fileOperationsService.moveNoteToTheRightFolder(fileInRightFolder as TFile, 'book');

      expect(result).toBeNull();
      expect(mockObsidianAdapter.moveNote).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Note "test.md" is already in the right folder: books');
      consoleSpy.mockRestore();
    });

    it('should move note to target folder', async () => {
      const result = await fileOperationsService.moveNoteToTheRightFolder(mockFile, 'book');

      expect(result).toBe('books/test.md');
      expect(mockObsidianAdapter.moveNote).toHaveBeenCalledWith(mockFile, 'books/test.md');
    });

    it('should throw error if target file already exists', async () => {
      mockObsidianAdapter.isFileExists.mockReturnValue(true);

      await expect(fileOperationsService.moveNoteToTheRightFolder(mockFile, 'book'))
        .rejects.toThrow('already exists');
    });
  });

  describe('renameNote', () => {
    it('should validate file before renaming', async () => {
      await fileOperationsService.renameNote(mockFile, 'book', {}, mockLogManager);

      expect(mockFileValidationService.checkIfValidFile).toHaveBeenCalledWith(mockFile);
      expect(mockFileValidationService.checkIfExcluded).toHaveBeenCalledWith(mockFile);
    });

    it('should return null if title does not change', async () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('test'); // Same as basename

      const result = await fileOperationsService.renameNote(mockFile, 'book', {}, mockLogManager);

      expect(result).toBeNull();
      expect(mockObsidianAdapter.renameNote).not.toHaveBeenCalled();
    });

    it('should rename note with new title', async () => {
      const newFile = {} as TFile;
      mockObsidianAdapter.renameNote.mockResolvedValue(newFile);

      const result = await fileOperationsService.renameNote(mockFile, 'book', {}, mockLogManager);

      expect(result).toBe(newFile);
      expect(mockObsidianAdapter.renameNote).toHaveBeenCalledWith(mockFile, 'New Title.md');
      expect(mockLogManager.addInfo).toHaveBeenCalledWith('Renamed note "test.md" to "New Title.md"');
    });

    it('should return file if new title would be "Untitled"', async () => {
      mockNoteTitleService.formatNoteTitle.mockReturnValue('Untitled');

      const result = await fileOperationsService.renameNote(mockFile, 'book', {}, mockLogManager);

      expect(result).toBe(mockFile);
      expect(mockObsidianAdapter.renameNote).not.toHaveBeenCalled();
    });

    it('should throw error if target file already exists', async () => {
      mockObsidianAdapter.isFileExists.mockReturnValue(true);

      await expect(fileOperationsService.renameNote(mockFile, 'book', {}, mockLogManager))
        .rejects.toThrow('already exists');
    });
  });
});
