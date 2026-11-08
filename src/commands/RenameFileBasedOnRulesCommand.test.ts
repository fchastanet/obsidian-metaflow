import {RenameFileBasedOnRulesCommand} from './RenameFileBasedOnRulesCommand';
import {MetaFlowException} from '@metaflow/MetaFlowException';
import {Container} from 'inversify';
import {TYPES} from '@metaflow/di/types';

// Mock Obsidian classes
jest.mock('obsidian', () => ({
  Editor: class MockEditor { },
  MarkdownView: class MockMarkdownView { },
  TFile: class MockTFile { },
  App: class MockApp { }
}));

describe('RenameFileBasedOnRulesCommand', () => {
  let container: Container;
  let command: RenameFileBasedOnRulesCommand;
  let mockApp: any;
  let mockFileOperationsService: any;
  let mockFileValidationService: any;
  let mockFileClassDeductionService: any;
  let mockEditor: any;
  let mockView: any;
  let mockLogNoticeManager: any;

  beforeEach(() => {
    container = new Container();

    // Setup mock services
    mockApp = {
      metadataCache: {
        getFileCache: jest.fn()
      }
    };

    mockFileOperationsService = {
      renameNote: jest.fn().mockResolvedValue(undefined)
    };

    mockFileValidationService = {
      checkIfValidFile: jest.fn()
    };

    mockFileClassDeductionService = {
      getFileClassFromMetadata: jest.fn()
    };

    // Setup mock objects for tests
    mockEditor = {};

    mockView = {
      file: {
        name: 'test.md',
        path: 'test.md'
      }
    };

    mockLogNoticeManager = {
      addError: jest.fn(),
      addWarning: jest.fn(),
      addInfo: jest.fn(),
      addDebug: jest.fn(),
      addMessage: jest.fn(),
      showLogs: jest.fn()
    };

    // Bind to container
    container.bind(TYPES.App).toConstantValue(mockApp);
    container.bind(TYPES.FileOperationsService).toConstantValue(mockFileOperationsService);
    container.bind(TYPES.FileValidationService).toConstantValue(mockFileValidationService);
    container.bind(TYPES.FileClassDeductionService).toConstantValue(mockFileClassDeductionService);
    container.bind(TYPES.RenameFileBasedOnRulesCommand).to(RenameFileBasedOnRulesCommand);
    container.bind(TYPES.LogNoticeManagerInterface).toConstantValue(mockLogNoticeManager);

    // Get the command instance
    command = container.get<RenameFileBasedOnRulesCommand>(TYPES.RenameFileBasedOnRulesCommand);
  });

  test('can be instantiated with DI container', () => {
    expect(command).toBeInstanceOf(RenameFileBasedOnRulesCommand);
  });

  test('handles missing file gracefully', async () => {
    const viewWithoutFile = {file: null} as any;

    await command.execute(mockEditor, viewWithoutFile);

    expect(mockLogNoticeManager.addError).toHaveBeenCalledWith('No active file found');
  });

  test('should rename file when file class exists', async () => {
    const metadata = {fileClass: 'Note', title: 'Test'};
    const fileClass = 'Note';

    mockApp.metadataCache.getFileCache.mockReturnValue({
      frontmatter: metadata
    });
    mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
    mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue(fileClass);
    mockFileOperationsService.renameNote.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView);

    expect(mockFileValidationService.checkIfValidFile).toHaveBeenCalledWith(mockView.file);
    expect(mockFileClassDeductionService.getFileClassFromMetadata).toHaveBeenCalledWith(metadata);
    expect(mockFileOperationsService.renameNote).toHaveBeenCalledWith(mockView.file, fileClass, metadata);
  });

  test('should warn when no file class is found', async () => {
    const metadata = {title: 'Test'};

    mockApp.metadataCache.getFileCache.mockReturnValue({
      frontmatter: metadata
    });
    mockFileValidationService.checkIfValidFile.mockReturnValue(undefined);
    mockFileClassDeductionService.getFileClassFromMetadata.mockReturnValue(null);

    await command.execute(mockEditor, mockView);

    expect(mockLogNoticeManager.addWarning).toHaveBeenCalledWith('No file class found for test.md');
    expect(mockFileOperationsService.renameNote).not.toHaveBeenCalled();
  });

  test('should handle MetaFlowException', async () => {
    const error = new MetaFlowException('Rename error', 'error');
    mockFileValidationService.checkIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView);

    expect(mockLogNoticeManager.addError).toHaveBeenCalledWith('Error renaming note: Rename error');
  });

  test('should handle generic error', async () => {
    const error = new Error('Generic rename error');
    mockFileValidationService.checkIfValidFile.mockImplementation(() => {
      throw error;
    });

    await command.execute(mockEditor, mockView);

    expect(mockLogNoticeManager.addError).toHaveBeenCalledWith('Error renaming note: Generic rename error');
  });
});
