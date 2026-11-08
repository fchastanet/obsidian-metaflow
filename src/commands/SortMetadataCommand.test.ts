import {SortMetadataCommand} from './SortMetadataCommand';
import {MetaFlowException} from '@metaflow/MetaFlowException';
import {LogNoticeManagerInterface} from '@metaflow/managers/types';

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

// Mock dependencies - simplified for testing
const mockProcessSortContent = jest.fn();
const mockMetaFlowService = {
  processSortContent: mockProcessSortContent,
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

const mockLogNoticeManager: LogNoticeManagerInterface = {
  addDebug: jest.fn(),
  addInfo: jest.fn(),
  addWarning: jest.fn(),
  addError: jest.fn(),
  addMessage: jest.fn(),
};

describe('SortMetadataCommand', () => {
  let command: SortMetadataCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new SortMetadataCommand(mockMetaFlowService as any, mockLogNoticeManager);
  });

  it('should sort metadata successfully', async () => {
    const content = '---\nz: value\na: value\n---\n# Test';

    mockEditor.getValue.mockReturnValue(content);
    mockProcessSortContent.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView);

    expect(mockProcessSortContent).toHaveBeenCalledWith(content, mockView.file);
  });

  it('should handle missing file', async () => {
    const viewWithoutFile = {file: null} as any;

    await command.execute(mockEditor, viewWithoutFile);

    expect(mockLogNoticeManager.addWarning).toHaveBeenCalledWith('No active file');
    expect(mockProcessSortContent).not.toHaveBeenCalled();
  });

  it('should handle MetaFlowException', async () => {
    const error = new MetaFlowException('Sort error', 'error');
    mockEditor.getValue.mockReturnValue('content');
    mockProcessSortContent.mockRejectedValue(error);

    await command.execute(mockEditor, mockView);

    expect(mockLogNoticeManager.addMessage).toHaveBeenCalledWith('Error: Sort error', 'error');
  });

  it('should handle generic error', async () => {
    const error = new Error('Generic sort error');
    mockEditor.getValue.mockReturnValue('content');
    mockProcessSortContent.mockRejectedValue(error);

    await command.execute(mockEditor, mockView);

    expect(mockLogNoticeManager.addError).toHaveBeenCalledWith('Error sorting metadata properties');
  });
});
