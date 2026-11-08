import type {SettingDefinitionControl, SettingDefinitionGroup, SettingDefinitionItem, SettingDefinitionList, SettingDefinitionPage} from "obsidian";
import {Notice} from "obsidian";
import {MetaFlowSettingTab} from "./MetaFlowSettingTab";
import {SectionSettingPage} from "./SectionSettingPage";
import {DEFAULT_SETTINGS} from "./defaultSettings";
import {MetaFlowSettings} from "./types";
import {TYPES} from "@metaflow/di/types";

jest.mock('./modals/CompletionsHelpModal.ts', () => ({
  CompletionsHelpModal: jest.fn().mockImplementation(() => ({open: jest.fn()}))
}));

jest.mock('./modals/FileClassAvailableFieldsHelpModal.ts', () => ({
  FileClassAvailableFieldsHelpModal: jest.fn().mockImplementation(() => ({open: jest.fn()}))
}));

jest.mock('./modals/ConfirmModal.ts', () => ({
  ConfirmModal: jest.fn().mockImplementation(() => ({open: jest.fn()}))
}));

type Group = SettingDefinitionGroup & {heading?: string};

const isGroup = (item: SettingDefinitionItem): item is Group =>
  'type' in item && (item.type === 'group' || item.type === 'list');

describe('MetaFlowSettingTab', () => {
  let settings: MetaFlowSettings;
  let mockPlugin: any;
  let metadataMenuAdapter: {isMetadataMenuAvailable: jest.Mock};
  let templaterAdapter: {isTemplaterAvailable: jest.Mock};
  let metaflowService: {importSettings: jest.Mock};
  let uiService: {togglePropertiesVisibility: jest.Mock};
  let tab: MetaFlowSettingTab;
  let updateSpy: jest.SpyInstance;

  const definitions = () => tab.getSettingDefinitions();
  const groupByHeading = (heading: string): Group => {
    const group = definitions().filter(isGroup).find(item => item.heading === heading);
    if (!group) throw new Error(`group ${heading} not found`);
    return group;
  };
  const pageByName = (name: string): SettingDefinitionPage => {
    const page = (groupByHeading('Mappings').items ?? [])
      .find(item => 'type' in item && item.type === 'page' && item.name === name);
    if (!page) throw new Error(`page ${name} not found`);
    return page as SettingDefinitionPage;
  };
  const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).createFragment = jest.fn(() => document.createDocumentFragment());

    settings = {
      ...structuredClone(DEFAULT_SETTINGS),
      excludeFolders: ['Archive', 'Templates'],
    };
    metadataMenuAdapter = {isMetadataMenuAvailable: jest.fn().mockReturnValue(true)};
    templaterAdapter = {isTemplaterAvailable: jest.fn().mockReturnValue(true)};
    metaflowService = {importSettings: jest.fn()};
    uiService = {togglePropertiesVisibility: jest.fn()};

    const services = new Map<symbol, unknown>([
      [TYPES.MetadataMenuAdapter, metadataMenuAdapter],
      [TYPES.TemplaterAdapter, templaterAdapter],
      [TYPES.ObsidianAdapter, {}],
      [TYPES.MetaFlowService, metaflowService],
      [TYPES.UIService, uiService],
    ]);
    mockPlugin = {
      settings,
      saveSettings: jest.fn().mockResolvedValue(undefined),
      container: {get: jest.fn((type: symbol) => services.get(type))},
    };

    tab = new MetaFlowSettingTab({} as any, mockPlugin);
    updateSpy = jest.spyOn(tab, 'update');
  });

  test('should set the settings tab icon', () => {
    expect(tab.icon).toBe('workflow');
  });

  test('should declare all settings groups', () => {
    const headings = definitions().filter(isGroup).map(group => group.heading);
    expect(headings).toEqual([
      undefined,
      'Metadata insertion behavior',
      'Mappings',
      'Exclude folders',
      'Export and import',
      'Plugin integrations',
      'Usage',
      'Enjoying MetaFlow?',
    ]);
  });

  describe('control values', () => {
    test('should read nested values using dot-notation keys', () => {
      expect(tab.getControlValue('debugMode')).toBe(false);
      expect(tab.getControlValue('excludeFolders.1')).toBe('Templates');
    });

    test('should write nested values and persist settings', async () => {
      await tab.setControlValue('excludeFolders.0', 'Inbox');
      expect(settings.excludeFolders).toEqual(['Inbox', 'Templates']);
      expect(mockPlugin.saveSettings).toHaveBeenCalledTimes(1);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should apply properties visibility immediately', async () => {
      await tab.setControlValue('hidePropertiesInEditor', true);
      expect(settings.hidePropertiesInEditor).toBe(true);
      expect(uiService.togglePropertiesVisibility).toHaveBeenCalledWith(true);
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    test('should reset dependent settings and refresh when auto-insert is disabled', async () => {
      settings.autoSort = true;
      settings.autoMoveNoteToRightFolder = true;
      settings.autoRenameNote = true;

      await tab.setControlValue('autoMetadataInsertion', false);

      expect(settings.autoMetadataInsertion).toBe(false);
      expect(settings.autoSort).toBe(false);
      expect(settings.autoMoveNoteToRightFolder).toBe(false);
      expect(settings.autoRenameNote).toBe(false);
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    test('should not reset dependent settings when auto-insert is enabled', async () => {
      settings.autoSort = true;
      await tab.setControlValue('autoMetadataInsertion', true);
      expect(settings.autoSort).toBe(true);
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('metadata insertion group', () => {
    test('should disable dependent toggles when auto-insert is off', () => {
      const items = groupByHeading('Metadata insertion behavior').items as SettingDefinitionControl[];
      const autoSort = items.find(item => item.control.key === 'autoSort');
      const sortUnknown = items.find(item => item.control.key === 'sortUnknownPropertiesLast');
      const disabled = autoSort?.control.disabled as () => boolean;

      settings.autoMetadataInsertion = true;
      expect(disabled()).toBe(false);
      settings.autoMetadataInsertion = false;
      expect(disabled()).toBe(true);
      expect(sortUnknown?.control.disabled).toBeUndefined();
    });
  });

  describe('exclude folders list', () => {
    const list = () => groupByHeading('Exclude folders') as SettingDefinitionList;

    test('should declare one folder control per excluded folder', () => {
      const items = list().items as SettingDefinitionControl[];
      expect(items.map(item => item.control)).toEqual([
        {type: 'folder', key: 'excludeFolders.0', placeholder: 'Folder path'},
        {type: 'folder', key: 'excludeFolders.1', placeholder: 'Folder path'},
      ]);
      expect(items.map(item => item.name)).toEqual(['Archive', 'Templates']);
    });

    test('should initialize missing excludeFolders setting', () => {
      delete settings.excludeFolders;
      expect(list().items).toEqual([]);
      expect(settings.excludeFolders).toEqual([]);
    });

    test('should add a new empty folder', async () => {
      list().addItem?.action({} as HTMLElement);
      await flushPromises();
      expect(settings.excludeFolders).toEqual(['Archive', 'Templates', '']);
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
    });

    test('should delete a folder', async () => {
      list().onDelete?.(0);
      await flushPromises();
      expect(settings.excludeFolders).toEqual(['Templates']);
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
    });

    test('should reorder folders', async () => {
      list().onReorder?.(0, 1);
      await flushPromises();
      expect(settings.excludeFolders).toEqual(['Templates', 'Archive']);
      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('mapping pages', () => {
    test('should summarize mappings and scripts count', () => {
      settings.propertyDefaultValueScripts = [];
      const mappingsValue = pageByName('Folder/fileClass mappings').displayValue as () => string;
      const scriptsValue = pageByName('Property default value scripts').displayValue as () => string;
      expect(mappingsValue()).toBe('1 mapping');
      expect(scriptsValue()).toBe('0 scripts');
    });

    test('should flag pages with a warning when MetadataMenu is unavailable', () => {
      const status = pageByName('Folder/fileClass mappings').status as () => string | null;
      expect(status()).toBeNull();
      metadataMenuAdapter.isMetadataMenuAvailable.mockReturnValue(false);
      expect(status()).toBe('warning');
    });

    test('should show simulation page only when both plugins are available', () => {
      const visible = pageByName('🧪 Simulation and testing').visible as () => boolean;
      expect(visible()).toBe(true);
      templaterAdapter.isTemplaterAvailable.mockReturnValue(false);
      expect(visible()).toBe(false);
    });

    test('should create a section page refreshing the tab when hidden', () => {
      const page = pageByName('Folder/fileClass mappings').page?.();
      expect(page).toBeInstanceOf(SectionSettingPage);
      expect(page?.title).toBe('Folder/fileClass mappings');
      page?.hide();
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('export and import', () => {
    const importSection = () => (tab as any).exportImportSection;

    test('should import settings, persist and refresh', async () => {
      await importSection().importSettings('{"debugMode": true}');
      expect(metaflowService.importSettings).toHaveBeenCalledWith('{"debugMode": true}');
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(Notice).toHaveBeenCalledWith('Settings imported successfully!');
    });

    test('should notify and not persist on invalid JSON', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      metaflowService.importSettings.mockImplementation(() => {throw new SyntaxError('bad json');});
      await importSection().importSettings('{bad');
      expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
      expect(Notice).toHaveBeenCalledWith('Failed to import settings: Invalid JSON', 5000);
      consoleSpy.mockRestore();
    });

    test('should export settings as a JSON file', () => {
      const click = jest.fn();
      const originalCreateElement = document.createElement.bind(document);
      jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') el.click = click;
        return el;
      });
      URL.createObjectURL = jest.fn(() => 'blob:url');
      URL.revokeObjectURL = jest.fn();

      importSection().exportSettings();

      expect(click).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
    });
  });

  describe('plugins status', () => {
    test('should declare MetadataMenu and Templater status rows', () => {
      const names = (groupByHeading('Plugin integrations').items ?? []).map(item => item.name);
      expect(names).toEqual(['MetadataMenu', 'Templater']);
    });
  });
});
