import {TogglePropertiesPanelCommand} from './TogglePropertiesPanelCommand';
import {CommandDependencies} from './types';
import {LogManagerInterface} from '../managers/types';

// Mock dependencies
const mockSaveSettings = jest.fn();
const mockTogglePropertiesVisibility = jest.fn();

const mockSettings = {
  hidePropertiesInEditor: false,
} as any;

const mockDependencies: CommandDependencies = {
  app: {} as any,
  settings: mockSettings,
  metaFlowService: {} as any,
  serviceContainer: {
    uiService: {
      togglePropertiesVisibility: mockTogglePropertiesVisibility,
    },
  } as any,
  fileClassStateManager: {} as any,
  obsidianAdapter: {} as any,
  saveSettings: mockSaveSettings,
};

const mockLogManager: LogManagerInterface = {
  addDebug: jest.fn(),
  addInfo: jest.fn(),
  addWarning: jest.fn(),
  addError: jest.fn(),
  addMessage: jest.fn(),
};

describe('TogglePropertiesPanelCommand', () => {
  let command: TogglePropertiesPanelCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings.hidePropertiesInEditor = false;
    command = new TogglePropertiesPanelCommand(mockDependencies);
  });

  it('should toggle properties panel from visible to hidden', () => {
    command.execute(mockLogManager);

    expect(mockSettings.hidePropertiesInEditor).toBe(true);
    expect(mockSaveSettings).toHaveBeenCalled();
    expect(mockTogglePropertiesVisibility).toHaveBeenCalledWith(true);
    expect(mockLogManager.addInfo).toHaveBeenCalledWith('Properties panel hidden');
  });

  it('should toggle properties panel from hidden to visible', () => {
    mockSettings.hidePropertiesInEditor = true;

    command.execute(mockLogManager);

    expect(mockSettings.hidePropertiesInEditor).toBe(false);
    expect(mockSaveSettings).toHaveBeenCalled();
    expect(mockTogglePropertiesVisibility).toHaveBeenCalledWith(false);
    expect(mockLogManager.addInfo).toHaveBeenCalledWith('Properties panel shown');
  });
});
