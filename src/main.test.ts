import MetaFlowPlugin from './main';
import {PluginManifest} from 'obsidian';
import {DEFAULT_SETTINGS} from './settings/defaultSettings';
import EventCron from './eventManager/EventCron';

describe('MetaFlowPlugin', () => {
  let plugin: MetaFlowPlugin;
  let app: any;
  let manifest: PluginManifest;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Obsidian app and manifest
    app = {
      workspace: {
        on: jest.fn(),
        onLayoutReady: jest.fn((cb) => cb()),
      },
      metadataCache: {
        on: jest.fn(),
      },
      vault: {
        on: jest.fn(),
      },
    };
    manifest = {
      name: 'MetaFlow',
      version: '1.0.0',
      id: 'metaflow',
      description: 'A plugin for managing metadata workflows',
    } as PluginManifest;
    plugin = new MetaFlowPlugin(app, manifest);
    plugin.addSettingTab = jest.fn();
    plugin.addCommand = jest.fn();
    plugin.registerEvent = jest.fn();
    plugin.uiService = {togglePropertiesVisibility: jest.fn()};
    plugin.eventCron = {
      start: jest.fn(),
      stop: jest.fn(),
    } as unknown as EventCron;
    plugin.settings = DEFAULT_SETTINGS;
  });

  it('should instantiate plugin', () => {
    expect(plugin).toBeInstanceOf(MetaFlowPlugin);
  });

  it('should call togglePropertiesVisibility on onunload', () => {
    plugin.onunload();
    expect(plugin.eventCron.stop).toHaveBeenCalled();
    expect(plugin.uiService.togglePropertiesVisibility).toHaveBeenCalledWith(false);
  });

  it('should call addSettingTab on onload', async () => {
    plugin.loadSettings = jest.fn().mockResolvedValue(plugin.settings);
    await plugin.onload();
    expect(plugin.addSettingTab).toHaveBeenCalled();
  });

  it('should save and load settings', async () => {
    plugin.saveData = jest.fn();
    plugin.loadData = jest.fn().mockResolvedValue({});
    const settings = await plugin.loadSettings();
    expect(settings).toBeDefined();
    await plugin.saveSettings();
    expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
  });
});
