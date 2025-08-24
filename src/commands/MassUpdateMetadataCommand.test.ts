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
import {MetaFlowException} from '../MetaFlowException';
import {Container} from 'inversify';
import {TYPES} from '../di/types';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import type {MetaFlowService} from '../services/MetaFlowService';
import type {ObsidianAdapter} from '../externalApi/ObsidianAdapter';
import type {LogManagerInterface} from '../managers/types';

// Mock Obsidian classes
jest.mock('obsidian', () => ({
  Modal: class MockModal { },
  ProgressBarComponent: class MockProgressBarComponent { },
  Notice: jest.fn(),
  App: class MockApp { }
}));
import {TFile} from 'obsidian';

describe('MassUpdateMetadataCommand', () => {
  let command: MassUpdateMetadataCommand;
  let container: Container;
  let mockApp: any;
  let mockMetaFlowService: jest.Mocked<MetaFlowService>;
  let mockObsidianAdapter: jest.Mocked<ObsidianAdapter>;
  let mockLogManager: jest.Mocked<LogManagerInterface>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock services
    mockApp = {
      vault: {
        getMarkdownFiles: jest.fn(() => [])
      }
    };

    mockMetaFlowService = {
      processFile: jest.fn()
    } as any;

    mockObsidianAdapter = {
      createProgressModal: jest.fn()
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
    container.bind(TYPES.MetaFlowService).toConstantValue(mockMetaFlowService);
    container.bind(TYPES.ObsidianAdapter).toConstantValue(mockObsidianAdapter);
    container.bind(TYPES.MassUpdateMetadataCommand).to(MassUpdateMetadataCommand);

    // Create command instance
    command = container.get<MassUpdateMetadataCommand>(TYPES.MassUpdateMetadataCommand);
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
    expect(mockApp.vault.getMarkdownFiles).toHaveBeenCalled();
  });
});
