import {SortMetadataCommand} from './SortMetadataCommand';
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
const mockProcessSortContent = jest.fn();
const mockDependencies: CommandDependencies = {
  app: {} as any,
  settings: {} as any,
  metaFlowService: {
    processSortContent: mockProcessSortContent,
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

describe('SortMetadataCommand', () => {
  let command: SortMetadataCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new SortMetadataCommand(mockDependencies);
  });

  it('should sort metadata successfully', async () => {
    const content = '---\nz: value\na: value\n---\n# Test';

    mockEditor.getValue.mockReturnValue(content);
    mockProcessSortContent.mockResolvedValue(undefined);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockProcessSortContent).toHaveBeenCalledWith(content, mockView.file);
  });

  it('should handle missing file', async () => {
    const viewWithoutFile = {file: null} as any;

    await command.execute(mockEditor, viewWithoutFile, mockLogManager);

    expect(mockLogManager.addWarning).toHaveBeenCalledWith('No active file');
    expect(mockProcessSortContent).not.toHaveBeenCalled();
  });

  it('should handle MetaFlowException', async () => {
    const error = new MetaFlowException('Sort error', 'error');
    mockEditor.getValue.mockReturnValue('content');
    mockProcessSortContent.mockRejectedValue(error);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addMessage).toHaveBeenCalledWith('Error: Sort error', 'error');
  });

  it('should handle generic error', async () => {
    const error = new Error('Generic sort error');
    mockEditor.getValue.mockReturnValue('content');
    mockProcessSortContent.mockRejectedValue(error);

    await command.execute(mockEditor, mockView, mockLogManager);

    expect(mockLogManager.addError).toHaveBeenCalledWith('Error sorting metadata properties');
  });
});
