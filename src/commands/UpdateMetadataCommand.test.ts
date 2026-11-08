import {UpdateMetadataCommand} from './UpdateMetadataCommand';
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
const mockProcessContent = jest.fn();
const mockMetaFlowService = {
  processContent: mockProcessContent,
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

describe('UpdateMetadataCommand', () => {
  let command: UpdateMetadataCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new UpdateMetadataCommand(mockMetaFlowService as any, mockLogNoticeManager);
  });

  it('should update metadata when content is changed', () => {
    const originalContent = '# Test\n\nContent';
    const processedContent = '---\ntitle: Test\n---\n# Test\n\nContent';

    mockEditor.getValue.mockReturnValue(originalContent);
    mockProcessContent.mockReturnValue(processedContent);

    command.execute(mockEditor, mockView);

    expect(mockProcessContent).toHaveBeenCalledWith(
      originalContent,
      mockView.file
    );
    expect(mockEditor.setValue).toHaveBeenCalledWith(processedContent);
    expect(mockLogNoticeManager.addInfo).toHaveBeenCalledWith('Successfully updated metadata fields for "test.md"');
  });

  it('should not update when content is unchanged', () => {
    const content = '---\ntitle: Test\n---\n# Test\n\nContent';

    mockEditor.getValue.mockReturnValue(content);
    mockProcessContent.mockReturnValue(content);

    command.execute(mockEditor, mockView);

    expect(mockProcessContent).toHaveBeenCalledWith(
      content,
      mockView.file
    );
    expect(mockEditor.setValue).not.toHaveBeenCalled();
    expect(mockLogNoticeManager.addInfo).toHaveBeenCalledWith('No changes needed');
  });

  it('should handle missing file', () => {
    const viewWithoutFile = {file: null} as any;

    command.execute(mockEditor, viewWithoutFile);

    expect(mockLogNoticeManager.addWarning).toHaveBeenCalledWith('No active file');
    expect(mockProcessContent).not.toHaveBeenCalled();
  });

  it('should handle MetaFlowException', () => {
    const error = new MetaFlowException('Test error', 'warning');
    mockEditor.getValue.mockReturnValue('content');
    mockProcessContent.mockImplementation(() => {
      throw error;
    });

    command.execute(mockEditor, mockView);

    expect(mockLogNoticeManager.addMessage).toHaveBeenCalledWith('Error: Test error', 'warning');
  });

  it('should handle generic error', () => {
    const error = new Error('Generic error');
    mockEditor.getValue.mockReturnValue('content');
    mockProcessContent.mockImplementation(() => {
      throw error;
    });

    command.execute(mockEditor, mockView);

    expect(mockLogNoticeManager.addError).toHaveBeenCalledWith('Error updating metadata properties');
  });
});
