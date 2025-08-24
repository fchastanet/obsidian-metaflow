import {UpdateMetadataCommand} from './UpdateMetadataCommand';
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

// Mock dependencies - simplified for testing
const mockProcessContent = jest.fn();
const mockMetaFlowService = {
  processContent: mockProcessContent,
};

// Create command directly with mock service for testing
class TestUpdateMetadataCommand extends UpdateMetadataCommand {
  constructor() {
    super(mockMetaFlowService as any);
  }
}

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

describe('UpdateMetadataCommand', () => {
  let command: UpdateMetadataCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new TestUpdateMetadataCommand();
  });

  it('should update metadata when content is changed', () => {
    const originalContent = '# Test\n\nContent';
    const processedContent = '---\ntitle: Test\n---\n# Test\n\nContent';

    mockEditor.getValue.mockReturnValue(originalContent);
    mockProcessContent.mockReturnValue(processedContent);

    command.execute(mockEditor, mockView, mockLogManager);

    expect(mockProcessContent).toHaveBeenCalledWith(
      originalContent,
      mockView.file,
      mockLogManager
    );
    expect(mockEditor.setValue).toHaveBeenCalledWith(processedContent);
    expect(mockLogManager.addInfo).toHaveBeenCalledWith('Successfully updated metadata fields for "test.md"');
  });

  it('should not update when content is unchanged', () => {
    const content = '---\ntitle: Test\n---\n# Test\n\nContent';

    mockEditor.getValue.mockReturnValue(content);
    mockProcessContent.mockReturnValue(content);

    command.execute(mockEditor, mockView, mockLogManager);

    expect(mockProcessContent).toHaveBeenCalledWith(
      content,
      mockView.file,
      mockLogManager
    );
    expect(mockEditor.setValue).not.toHaveBeenCalled();
    expect(mockLogManager.addInfo).toHaveBeenCalledWith('No changes needed');
  });

  it('should handle missing file', () => {
    const viewWithoutFile = {file: null} as any;

    command.execute(mockEditor, viewWithoutFile, mockLogManager);

    expect(mockLogManager.addWarning).toHaveBeenCalledWith('No active file');
    expect(mockProcessContent).not.toHaveBeenCalled();
  });

  it('should handle MetaFlowException', () => {
    const error = new MetaFlowException('Test error', 'warning');
    mockEditor.getValue.mockReturnValue('content');
    mockProcessContent.mockImplementation(() => {
      throw error;
    });

    command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addMessage).toHaveBeenCalledWith('Error: Test error', 'warning');
  });

  it('should handle generic error', () => {
    const error = new Error('Generic error');
    mockEditor.getValue.mockReturnValue('content');
    mockProcessContent.mockImplementation(() => {
      throw error;
    });

    command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('Error updating metadata properties');
  });
});
