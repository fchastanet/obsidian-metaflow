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
const mockGetFrontmatterFromContent = jest.fn();
const mockGetFileClassFromMetadata = jest.fn();
const mockRenameNote = jest.fn();
const mockMoveNoteToTheRightFolder = jest.fn();

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
    moveNoteToTheRightFolder: mockMoveNoteToTheRightFolder,
  } as any,
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
    const content = '---\nfileClass: Note\ntitle: Test\n---\n# Test';
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';
    const renamedFile = {name: 'renamed.md', path: 'renamed.md'};

    mockEditor.getValue.mockReturnValue(content);
    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFrontmatterFromContent.mockReturnValue(metadata);
    mockGetFileClassFromMetadata.mockReturnValue(fileClass);
    mockRenameNote.mockResolvedValue(renamedFile);
    mockMoveNoteToTheRightFolder.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockCheckIfValidFile).toHaveBeenCalledWith(mockFile);
    expect(mockGetFrontmatterFromContent).toHaveBeenCalledWith(content);
    expect(mockGetFileClassFromMetadata).toHaveBeenCalledWith(metadata);
    expect(mockRenameNote).toHaveBeenCalledWith(mockFile, fileClass, metadata, mockLogManager);
    expect(mockMoveNoteToTheRightFolder).toHaveBeenCalledWith(renamedFile, fileClass);
  });

  it('should move note without renaming when autoRenameNote is disabled', async () => {
    const content = '---\nfileClass: Note\ntitle: Test\n---\n# Test';
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';

    mockDependencies.settings.autoRenameNote = false;
    mockEditor.getValue.mockReturnValue(content);
    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFrontmatterFromContent.mockReturnValue(metadata);
    mockGetFileClassFromMetadata.mockReturnValue(fileClass);
    mockMoveNoteToTheRightFolder.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockRenameNote).not.toHaveBeenCalled();
    expect(mockMoveNoteToTheRightFolder).toHaveBeenCalledWith(mockFile, fileClass);
  });

  it('should move note when rename returns null', async () => {
    const content = '---\nfileClass: Note\ntitle: Test\n---\n# Test';
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';

    mockEditor.getValue.mockReturnValue(content);
    mockCheckIfValidFile.mockReturnValue(undefined);
    mockGetFrontmatterFromContent.mockReturnValue(metadata);
    mockGetFileClassFromMetadata.mockReturnValue(fileClass);
    mockRenameNote.mockResolvedValue(null);
    mockMoveNoteToTheRightFolder.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockMoveNoteToTheRightFolder).toHaveBeenCalledWith(mockFile, fileClass);
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
    expect(mockMoveNoteToTheRightFolder).not.toHaveBeenCalled();
  });

  it('should handle missing file', async () => {
    const viewWithoutFile = {file: null} as any;

    await command.execute(mockEditor, viewWithoutFile, mockLogManager);

    expect(mockLogManager.addWarning).toHaveBeenCalledWith('No active file');
    expect(mockCheckIfValidFile).not.toHaveBeenCalled();
  });

  it('should handle MetaFlowException', async () => {
    const error = new MetaFlowException('Move error', 'error');
    mockEditor.getValue.mockReturnValue('content');
    mockCheckIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addMessage).toHaveBeenCalledWith('Error: Move error', 'error');
  });

  it('should handle generic error', async () => {
    const error = new Error('Generic move error');
    mockEditor.getValue.mockReturnValue('content');
    mockCheckIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('Error moving note to the right folder');
  });
});
