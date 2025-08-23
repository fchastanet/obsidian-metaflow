// Mock Obsidian classes first
jest.mock('obsidian', () => ({
  Modal: class MockModal { },
  ProgressBarComponent: class MockProgressBarComponent { },
  Notice: jest.fn(),
  Editor: class MockEditor { },
  MarkdownView: class MockMarkdownView { },
  TFile: class MockTFile { },
  TFolder: class MockTFolder { },
  TAbstractFile: class MockTAbstractFile { },
  Vault: class MockVault { },
  App: class MockApp { },
}));

// Mock external dependencies
jest.mock('../managers/LogNoticeManager');
jest.mock('../externalApi/ObsidianAdapter');

import {CommandFactory} from './CommandFactory';
import {CommandDependencies} from './types';

// Mock dependencies
const mockDependencies: CommandDependencies = {
  app: {} as any,
  settings: {} as any,
  metaFlowService: {} as any,
  fileClassStateManager: {} as any,
  obsidianAdapter: {} as any,
  saveSettings: jest.fn(),
};

describe('CommandFactory', () => {
  let factory: CommandFactory;

  beforeEach(() => {
    factory = new CommandFactory(mockDependencies);
  });

  it('should create command instances', () => {
    expect(factory.createUpdateMetadataCommand()).toBeDefined();
    expect(factory.createSortMetadataCommand()).toBeDefined();
    expect(factory.createMoveNoteToRightFolderCommand()).toBeDefined();
    expect(factory.createRenameFileBasedOnRulesCommand()).toBeDefined();
    expect(factory.createTogglePropertiesPanelCommand()).toBeDefined();
    expect(factory.createMassUpdateMetadataCommand()).toBeDefined();
  });
});
