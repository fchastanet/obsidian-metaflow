import {RenameFileBasedOnRulesCommand} from './RenameFileBasedOnRulesCommand';
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
const mockGetFileCache = jest.fn();

const mockDependencies: CommandDependencies = {
  app: {
    metadataCache: {
      getFileCache: mockGetFileCache
    }
  } as any,
  settings: {} as any,
  metaFlowService: {} as any,
  serviceContainer: {
    fileValidationService: {
      checkIfValidFile: mockCheckIfValidFile,
    },
    fileClassDeductionService: {
      getFileClassFromMetadata: mockGetFileClassFromMetadata,
    },
    fileOperationsService: {
      renameNote: mockRenameNote,
    },
  } as any,
  fileClassStateManager: {} as any,
  obsidianAdapter: {} as any,
  saveSettings: jest.fn(),
};

const mockEditor = {
  getValue: jest.fn(),
  setValue: jest.fn(),
} as any;

const mockView = {
  file: {
    name: 'test.md',
    path: 'test.md',
  },
} as any;

const mockLogManager: LogManagerInterface = {
  addDebug: jest.fn(),
  addInfo: jest.fn(),
  addWarning: jest.fn(),
  addError: jest.fn(),
  addMessage: jest.fn(),
};

describe('RenameFileBasedOnRulesCommand', () => {
  let command: RenameFileBasedOnRulesCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new RenameFileBasedOnRulesCommand(mockDependencies);
  });

  it('should rename file when autoRenameNote is enabled and file class exists', async () => {
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';

    mockGetFileCache.mockReturnValue({
      frontmatter: metadata
    });
    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFileClassFromMetadata.mockReturnValue(fileClass);
    mockRenameNote.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockCheckIfValidFile).toHaveBeenCalledWith(mockView.file);
    expect(mockGetFileClassFromMetadata).toHaveBeenCalledWith(metadata);
    expect(mockRenameNote).toHaveBeenCalledWith(mockView.file, fileClass, metadata, mockLogManager);
  });

  it('should rename file regardless of autoRenameNote setting', async () => {
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';

    mockDependencies.settings.autoRenameNote = false; // This should not affect manual command
    mockGetFileCache.mockReturnValue({
      frontmatter: metadata
    });
    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFileClassFromMetadata.mockReturnValue(fileClass);
    mockRenameNote.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockRenameNote).toHaveBeenCalledWith(mockView.file, fileClass, metadata, mockLogManager);
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
    expect(mockRenameNote).not.toHaveBeenCalled();
  });

  it('should handle missing file', async () => {
    const viewWithoutFile = {file: null} as any;

    await command.execute(mockEditor, viewWithoutFile, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('No active file found');
    expect(mockCheckIfValidFile).not.toHaveBeenCalled();
  });

  it('should handle MetaFlowException', async () => {
    const error = new MetaFlowException('Rename error', 'error');
    mockCheckIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('Error renaming note: Rename error');
  });

  it('should handle generic error', async () => {
    const error = new Error('Generic rename error');
    mockCheckIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('Error renaming note: Generic rename error');
  });
});
