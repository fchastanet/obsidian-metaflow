// Mock ProgressModal
jest.mock('../ui/ProgressModal', () => ({
  ProgressModal: jest.fn().mockImplementation((app, totalFiles, title, description, onCancel, onExecute) => ({
    open: jest.fn(() => onExecute()),
    setCurrentItem: jest.fn(),
    addInfo: jest.fn(),
    addError: jest.fn(),
    finish: jest.fn(),
  }))
}));

// Mock Utils
jest.mock('../utils/Utils', () => ({
  Utils: {
    sleep: jest.fn().mockResolvedValue(undefined),
  }
}));

import {MassUpdateMetadataCommand} from './MassUpdateMetadataCommand';
import {CommandDependencies} from './types';
import {LogManagerInterface} from '../managers/types';
import {TFile} from 'obsidian';

// Simple mock dependencies
const mockDependencies: CommandDependencies = {
  app: {
    vault: {
      getMarkdownFiles: jest.fn().mockReturnValue([]),
      read: jest.fn(),
      modify: jest.fn(),
    },
  } as any,
  settings: {
    excludeFolders: [],
    autoRenameNote: false,
    autoMoveNoteToRightFolder: false,
    frontmatterUpdateDelayMs: 100,
  } as any,
  metaFlowService: {
    processContent: jest.fn(),
    getFrontmatterFromContent: jest.fn(),
    getFileClassFromMetadata: jest.fn(),
    renameNote: jest.fn(),
    moveNoteToTheRightFolder: jest.fn(),
  } as any,
  fileClassStateManager: {
    setEnabled: jest.fn(),
  } as any,
  obsidianAdapter: {
    folderPrefix: jest.fn(),
  } as any,
  saveSettings: jest.fn(),
};

const mockLogManager: LogManagerInterface = {
  addDebug: jest.fn(),
  addInfo: jest.fn(),
  addWarning: jest.fn(),
  addError: jest.fn(),
  addMessage: jest.fn(),
};

describe('MassUpdateMetadataCommand', () => {
  let command: MassUpdateMetadataCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new MassUpdateMetadataCommand(mockDependencies);
  });

  it('should create command instance', () => {
    expect(command).toBeDefined();
  });

  it('should warn when no files to update', async () => {
    await command.execute(mockLogManager);
    expect(mockLogManager.addWarning).toHaveBeenCalledWith('No files to update - all files are excluded or no markdown files found.');
  });

  it('should call getMarkdownFiles when executed', async () => {
    await command.execute(mockLogManager);
    expect(mockDependencies.app.vault.getMarkdownFiles).toHaveBeenCalled();
  });
});
