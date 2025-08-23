import {MoveNoteToRightFolderCommand} from './MoveNoteToRightFolderCommand';
import {CommandDependencies} from './types';
import {MetaFlowException} from '../MetaFlowException';
import {LogManagerInterface} from '../managers/types';

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

// Mock dependencies
const mockCheckIfValidFile = jest.fn();
const mockGetFileClassFromMetadata = jest.fn();
const mockRenameNote = jest.fn();
const mockMoveNoteToTheRightFolder = jest.fn();
const mockGetFileCache = jest.fn();

const mockDependencies: CommandDependencies = {
  app: {
    metadataCache: {
      getFileCache: mockGetFileCache
    }
  } as any,
  settings: {
    autoRenameNote: true,
  } as any,
  serviceContainer: {
    fileValidationService: {
      checkIfValidFile: mockCheckIfValidFile,
    },
    fileClassDeductionService: {
      getFileClassFromMetadata: mockGetFileClassFromMetadata,
    },
    fileOperationsService: {
      renameNote: mockRenameNote,
      moveNoteToTheRightFolder: mockMoveNoteToTheRightFolder,
    },
  } as any,
  metaFlowService: {} as any, // Keep for backward compatibility
  fileClassStateManager: {} as any,
  obsidianAdapter: {} as any,
  saveSettings: jest.fn(),
};

const mockEditor = {
  getValue: jest.fn(),
  setValue: jest.fn(),
} as any;

const mockFile = {
  name: 'test.md',
  path: 'test.md',
};

const mockView = {
  file: mockFile,
} as any;

const mockLogManager: LogManagerInterface = {
  addDebug: jest.fn(),
  addInfo: jest.fn(),
  addWarning: jest.fn(),
  addError: jest.fn(),
  addMessage: jest.fn(),
};

describe('MoveNoteToRightFolderCommand', () => {
  let command: MoveNoteToRightFolderCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new MoveNoteToRightFolderCommand(mockDependencies);
  });

  it('should move note and rename when autoRenameNote is enabled', async () => {
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';
    const renamedFile = {name: 'renamed.md', path: 'renamed.md'};

    // Mock the metadataCache to return the expected metadata
    mockGetFileCache.mockReturnValue({
      frontmatter: metadata
    });

    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFileClassFromMetadata.mockReturnValue(fileClass);
    mockRenameNote.mockResolvedValue(renamedFile);
    mockMoveNoteToTheRightFolder.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockCheckIfValidFile).toHaveBeenCalledWith(mockFile);
    expect(mockGetFileClassFromMetadata).toHaveBeenCalledWith(metadata);
    expect(mockRenameNote).toHaveBeenCalledWith(mockFile, fileClass, metadata, mockLogManager);
    expect(mockMoveNoteToTheRightFolder).toHaveBeenCalledWith(renamedFile, fileClass);
  });

  it('should move note without renaming when autoRenameNote is disabled', async () => {
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';

    mockDependencies.settings.autoRenameNote = false;
    mockGetFileCache.mockReturnValue({
      frontmatter: metadata
    });
    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFileClassFromMetadata.mockReturnValue(fileClass);
    mockMoveNoteToTheRightFolder.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockRenameNote).not.toHaveBeenCalled();
    expect(mockMoveNoteToTheRightFolder).toHaveBeenCalledWith(mockFile, fileClass);
  });

  it('should move note when rename returns null', async () => {
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';

    mockGetFileCache.mockReturnValue({
      frontmatter: metadata
    });
    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFileClassFromMetadata.mockReturnValue(fileClass);
    mockRenameNote.mockResolvedValue(null);
    mockMoveNoteToTheRightFolder.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockMoveNoteToTheRightFolder).toHaveBeenCalledWith(mockFile, fileClass);
  });

  it('should warn when no file class is found', async () => {
    const metadata = {title: 'Test'};

    mockGetFileCache.mockReturnValue({
      frontmatter: metadata
    });
    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFileClassFromMetadata.mockReturnValue(null);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addWarning).toHaveBeenCalledWith('No file class found for test.md');
    expect(mockMoveNoteToTheRightFolder).not.toHaveBeenCalled();
  });

  it('should handle missing file', async () => {
    const viewWithoutFile = {file: null} as any;

    await command.execute(mockEditor, viewWithoutFile, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('No active file found');
    expect(mockCheckIfValidFile).not.toHaveBeenCalled();
  });

  it('should handle MetaFlowException', async () => {
    const error = new MetaFlowException('Move error', 'error');
    mockCheckIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('Error moving note: Move error');
  });

  it('should handle generic error', async () => {
    const error = new Error('Generic move error');
    mockCheckIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('Error moving note: Generic move error');
  });
});
