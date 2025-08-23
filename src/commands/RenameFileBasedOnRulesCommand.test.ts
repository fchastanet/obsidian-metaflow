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
const mockGetFrontmatterFromContent = jest.fn();
const mockGetFileClassFromMetadata = jest.fn();
const mockRenameNote = jest.fn();

const mockDependencies: CommandDependencies = {
  app: {} as any,
  settings: {
    autoRenameNote: true,
  } as any,
  metaFlowService: {
    checkIfValidFile: mockCheckIfValidFile,
    getFrontmatterFromContent: mockGetFrontmatterFromContent,
    getFileClassFromMetadata: mockGetFileClassFromMetadata,
    renameNote: mockRenameNote,
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
    const content = '---\nfileClass: Note\ntitle: Test\n---\n# Test';
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';

    mockEditor.getValue.mockReturnValue(content);
    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFrontmatterFromContent.mockReturnValue(metadata);
    mockGetFileClassFromMetadata.mockReturnValue(fileClass);
    mockRenameNote.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockCheckIfValidFile).toHaveBeenCalledWith(mockView.file);
    expect(mockGetFrontmatterFromContent).toHaveBeenCalledWith(content);
    expect(mockGetFileClassFromMetadata).toHaveBeenCalledWith(metadata);
    expect(mockRenameNote).toHaveBeenCalledWith(mockView.file, fileClass, metadata, mockLogManager);
  });

  it('should not rename file when autoRenameNote is disabled', async () => {
    const content = '---\nfileClass: Note\ntitle: Test\n---\n# Test';
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';

    mockDependencies.settings.autoRenameNote = false;
    mockEditor.getValue.mockReturnValue(content);
    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFrontmatterFromContent.mockReturnValue(metadata);
    mockGetFileClassFromMetadata.mockReturnValue(fileClass);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockRenameNote).not.toHaveBeenCalled();
  });

  it('should warn when no file class is found', async () => {
    const content = '---\ntitle: Test\n---\n# Test';
    const metadata = {title: 'Test'};

    mockEditor.getValue.mockReturnValue(content);
    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFrontmatterFromContent.mockReturnValue(metadata);
    mockGetFileClassFromMetadata.mockReturnValue(null);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addWarning).toHaveBeenCalledWith('No file class found');
    expect(mockRenameNote).not.toHaveBeenCalled();
  });

  it('should handle missing file', async () => {
    const viewWithoutFile = {file: null} as any;

    await command.execute(mockEditor, viewWithoutFile, mockLogManager);

    expect(mockLogManager.addWarning).toHaveBeenCalledWith('No active file');
    expect(mockCheckIfValidFile).not.toHaveBeenCalled();
  });

  it('should handle MetaFlowException', async () => {
    const error = new MetaFlowException('Rename error', 'error');
    mockEditor.getValue.mockReturnValue('content');
    mockCheckIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addMessage).toHaveBeenCalledWith('Error: Rename error', 'error');
  });

  it('should handle generic error', async () => {
    const error = new Error('Generic rename error');
    mockEditor.getValue.mockReturnValue('content');
    mockCheckIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('Error renaming file based on rules');
  });
});
