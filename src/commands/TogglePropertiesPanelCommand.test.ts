import {TogglePropertiesPanelCommand} from './TogglePropertiesPanelCommand';
import {Container} from 'inversify';
import {TYPES} from '../di/types';
import {DEFAULT_SETTINGS} from '../settings/defaultSettings';
import type {UIService} from '../services/UIService';
import type {LogManagerInterface} from '../managers/types';

describe('TogglePropertiesPanelCommand', () => {
  let command: TogglePropertiesPanelCommand;
  let container: Container;
  let mockSettings: any;
  let mockUIService: jest.Mocked<UIService>;
  let mockSaveSettings: jest.Mock;
  let mockLogManager: jest.Mocked<LogManagerInterface>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock settings (mutable copy)
    mockSettings = {...DEFAULT_SETTINGS, hidePropertiesInEditor: false};

    // Create mock services
    mockUIService = {
      togglePropertiesVisibility: jest.fn()
    } as any;

    mockSaveSettings = jest.fn();

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
    container.bind(TYPES.MetaFlowSettings).toConstantValue(mockSettings);
    container.bind(TYPES.UIService).toConstantValue(mockUIService);
    container.bind(TYPES.SaveSettings).toConstantValue(mockSaveSettings);
    container.bind(TYPES.TogglePropertiesPanelCommand).to(TogglePropertiesPanelCommand);

    // Create command instance
    command = container.get<TogglePropertiesPanelCommand>(TYPES.TogglePropertiesPanelCommand);
  });

  it('should toggle properties panel from visible to hidden', () => {
    command.execute(mockLogManager);

    expect(mockSettings.hidePropertiesInEditor).toBe(true);
    expect(mockSaveSettings).toHaveBeenCalled();
    expect(mockUIService.togglePropertiesVisibility).toHaveBeenCalledWith(true);
    expect(mockLogManager.addInfo).toHaveBeenCalledWith('Properties panel hidden');
  });

  it('should toggle properties panel from hidden to visible', () => {
    mockSettings.hidePropertiesInEditor = true;

    command.execute(mockLogManager);

    expect(mockSettings.hidePropertiesInEditor).toBe(false);
    expect(mockSaveSettings).toHaveBeenCalled();
    expect(mockUIService.togglePropertiesVisibility).toHaveBeenCalledWith(false);
    expect(mockLogManager.addInfo).toHaveBeenCalledWith('Properties panel shown');
  });
});
