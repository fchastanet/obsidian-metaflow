import {MoveNoteToRightFolderCommand} from './MoveNoteToRightFolderCommand';
import {MetaFlowException} from '../MetaFlowException';
import {Container} from 'inversify';
import {TYPES} from '../di/types';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import type {FileOperationsService} from '../services/FileOperationsService';
import type {FileValidationService} from '../services/FileValidationService';
import type {FileClassDeductionService} from '../services/FileClassDeductionService';
import type {LogManagerInterface} from '../managers/types';

// Mock Obsidian classes
jest.mock('obsidian', () => ({
  Editor: class MockEditor { },
  MarkdownView: class MockMarkdownView { },
  TFile: class MockTFile { },
  App: class MockApp { }
}));

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('MoveNoteToRightFolderCommand', () => {
  let command: MoveNoteToRightFolderCommand;
  let container: Container;
  let mockApp: any;
  let mockFileOperationsService: jest.Mocked<FileOperationsService>;
  let mockFileValidationService: jest.Mocked<FileValidationService>;
  let mockFileClassDeductionService: jest.Mocked<FileClassDeductionService>;
  let mockLogManager: jest.Mocked<LogManagerInterface>;
  let mockEditor: any;
  let mockView: any;
  let mockFile: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock file
    mockFile = {
      name: 'test.md',
      path: 'test.md',
    };

    // Create mock editor and view
    mockEditor = {
      getValue: jest.fn(),
      setValue: jest.fn(),
    };

    mockView = {
      file: mockFile,
    };

    // Create mock services
    mockApp = {
      metadataCache: {
        getFileCache: jest.fn()
      }
    };

    mockFileOperationsService = {
      renameNote: jest.fn(),
      moveNote: jest.fn()
    } as any;

    mockFileValidationService = {
      checkIfValidFile: jest.fn()
    } as any;

    mockFileClassDeductionService = {
      getFileClassFromMetadata: jest.fn()
    } as any;

    mockLogManager = {
      addError: jest.fn(),
      addWarning: jest.fn(),
      addInfo: jest.fn(),
      addDebug: jest.fn(),
      addMessage: jest.fn(),
      showLogs: jest.fn()
    } as any;

    // Create DI container
    container = new Container();
    container.bind(TYPES.App).toConstantValue(mockApp);
    container.bind(TYPES.MetaFlowSettings).toConstantValue(DEFAULT_SETTINGS);
    container.bind(TYPES.FileOperationsService).toConstantValue(mockFileOperationsService);
    container.bind(TYPES.FileValidationService).toConstantValue(mockFileValidationService);
    container.bind(TYPES.FileClassDeductionService).toConstantValue(mockFileClassDeductionService);
    container.bind(TYPES.MoveNoteToRightFolderCommand).to(MoveNoteToRightFolderCommand);

    // Create command instance
    command = container.get<MoveNoteToRightFolderCommand>(TYPES.MoveNoteToRightFolderCommand);
  });

  it('should move note and rename when autoRenameNote is enabled', async () => {
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';
    const renamedFile = mockFile; // renameNote returns TFile | null

    // Mock the metadataCache to return the expected metadata
    mockApp.metadataCache.getFileCache.mockReturnValue({
      frontmatter: metadata
    });

    mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
    mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue(fileClass);
    mockFileOperationsService.renameNote.mockResolvedValue(renamedFile);
    mockFileOperationsService.moveNote.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockFileValidationService.checkIfValidFile).toHaveBeenCalledWith(mockFile);
    expect(mockFileClassDeductionService.getFileClassFromMetadata).toHaveBeenCalledWith(metadata);
    expect(mockFileOperationsService.renameNote).toHaveBeenCalledWith(mockFile, fileClass, metadata, mockLogManager);
    expect(mockFileOperationsService.moveNote).toHaveBeenCalledWith(renamedFile, fileClass, metadata, mockLogManager);
  });

  it('should move note without renaming when autoRenameNote is disabled', async () => {
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';

    // Update settings to disable auto rename
    const settingsWithoutAutoRename = {...DEFAULT_SETTINGS, autoRenameNote: false};
    container.unbind(TYPES.MetaFlowSettings);
    container.bind(TYPES.MetaFlowSettings).toConstantValue(settingsWithoutAutoRename);
    command = container.get<MoveNoteToRightFolderCommand>(TYPES.MoveNoteToRightFolderCommand);

    mockApp.metadataCache.getFileCache.mockReturnValue({
      frontmatter: metadata
    });
    mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
    mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue(fileClass);
    mockFileOperationsService.moveNote.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockFileOperationsService.renameNote).not.toHaveBeenCalled();
    expect(mockFileOperationsService.moveNote).toHaveBeenCalledWith(mockFile, fileClass, metadata, mockLogManager);
  });

  it('should move note when rename returns null', async () => {
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';

    mockApp.metadataCache.getFileCache.mockReturnValue({
      frontmatter: metadata
    });
    mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
    mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue(fileClass);
    mockFileOperationsService.renameNote.mockResolvedValue(null);
    mockFileOperationsService.moveNote.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockFileOperationsService.moveNote).toHaveBeenCalledWith(mockFile, fileClass, metadata, mockLogManager);
  });

  it('should warn when no file class is found', async () => {
    const metadata = {title: 'Test'};

    mockApp.metadataCache.getFileCache.mockReturnValue({
      frontmatter: metadata
    });
    mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
    mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue(null);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addWarning).toHaveBeenCalledWith('No fileClass found in metadata');
    expect(mockFileOperationsService.moveNote).not.toHaveBeenCalled();
  });

  it('should handle missing file', async () => {
    const viewWithoutFile = {file: null};

    await command.execute(mockEditor, viewWithoutFile as any, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('No active file found');
    expect(mockFileValidationService.checkIfValidFile).not.toHaveBeenCalled();
  });

  it('should handle MetaFlowException', async () => {
    const error = new MetaFlowException('Move error', 'error');
    mockFileValidationService.checkIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addMessage).toHaveBeenCalledWith('Error: Move error', 'error');
  });

  it('should handle generic error', async () => {
    const error = new Error('Generic move error');
    mockFileValidationService.checkIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('Error moving note to the right folder');
  });
});
