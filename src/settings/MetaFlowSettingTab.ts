import {App, PluginSettingTab, setIcon, Setting} from "obsidian";
import MetaFlowPlugin from "@metaflow/main";
import {MetadataMenuAdapter} from "@metaflow/externalApi/MetadataMenuAdapter";
import {TemplaterAdapter} from "@metaflow/externalApi/TemplaterAdapter";
import {ObsidianAdapter} from "@metaflow/externalApi/ObsidianAdapter";
import {SettingsUtils} from "./SettingsUtils";
import {MetadataInsertionSection} from "./sections/MetadataInsertionSection";
import {ExcludeFoldersSection} from "./sections/ExcludeFoldersSection";
import {FolderFileClassMappingsSection} from "./sections/FolderFileClassMappingsSection";
import {PropertyDefaultValueScriptsSection} from "./sections/PropertyDefaultValueScriptsSection";
import {SimulationSection} from "./sections/SimulationSection";
import {ExportImportSection} from "./sections/ExportImportSection";
import {PluginsStatusSection} from "./sections/PluginsStatusSection";
import {LogNoticeManager} from "@metaflow/managers/LogNoticeManager";
import {MetaFlowService} from "@metaflow/services/MetaFlowService";
import type {UIService} from "@metaflow/services/UIService";
import {TYPES} from "@metaflow/di/types";

interface SettingTab {
  id: string;
  name: string;
  icon: string;
}

const SETTING_TABS: SettingTab[] = [
  {
    id: 'general',
    name: 'General',
    icon: 'gear'
  },
  {
    id: 'folder-mappings',
    name: 'Folder Mappings',
    icon: 'folder-cog'
  },
  {
    id: 'property-mappings',
    name: 'Property Mappings',
    icon: 'info'
  },
  {
    id: 'simulation',
    name: 'Simulation',
    icon: 'lucide-command'
  },
  {
    id: 'importexport',
    name: 'Import/Export',
    icon: 'lucide-import'
  },
];

/**
 * Settings tab for MetaFlow plugin
 * Provides configuration UI for folder mappings, property scripts, and integration settings
 */
export class MetaFlowSettingTab extends PluginSettingTab {
  plugin: MetaFlowPlugin;
  metaflowService: MetaFlowService;
  metadataMenuAdapter: MetadataMenuAdapter;
  templaterAdapter: TemplaterAdapter;
  obsidianAdapter: ObsidianAdapter;
  logNoticeManager: LogNoticeManager;
  activeTab: string = SETTING_TABS[0].id; // Default to first tab

  constructor(app: App, plugin: MetaFlowPlugin) {
    super(app, plugin);
    this.plugin = plugin;

    // Get services from the plugin's DI container
    this.metadataMenuAdapter = plugin.container.get<MetadataMenuAdapter>(TYPES.MetadataMenuAdapter);
    this.obsidianAdapter = plugin.container.get<ObsidianAdapter>(TYPES.ObsidianAdapter);
    this.logNoticeManager = new LogNoticeManager(this.obsidianAdapter);
    this.metaflowService = plugin.container.get<MetaFlowService>(TYPES.MetaFlowService);
    this.templaterAdapter = plugin.container.get<TemplaterAdapter>(TYPES.TemplaterAdapter);
  }


  display(): void {
    const {containerEl} = this;
    containerEl.empty();
    containerEl.setAttribute('id', 'metaflow-settings');

    // create tabs
    const visibleTabs = SETTING_TABS;
    const tabContainer = containerEl.createEl('div', {
      cls: 'metaflow-settings-tabs'
    });
    for (const tab of visibleTabs) {
      const tabButton = tabContainer.createEl('div', {
        cls: `metaflow-settings-tab ${this.activeTab === tab.id ? 'active' : ''}`
      });
      setIcon(tabButton, tab.icon);
      tabButton.createEl('span', { text: tab.name });

      tabButton.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.display();
      });
    }
    const contentContainer = containerEl.createEl('div', {
      cls: 'metaflow-settings-content'
    });

    // Render the first tab by default
    if (visibleTabs.length > 0) {
      this.renderActiveTab(contentContainer);
    }
  }

  private renderActiveTab(containerEl: HTMLElement): void {
    containerEl.empty();
    containerEl.setAttribute('id', 'metaflow-settings');
    switch (this.activeTab) {
      case 'general':
        this.renderGeneralSettingsTab(containerEl);
        break;
      case 'folder-mappings':
        this.renderFolderMappingsTab(containerEl);
        break;
      case 'property-mappings':
        this.renderPropertyMappingsTab(containerEl);
        break;
      case 'simulation':
        this.renderSimulationTab(containerEl);
        break;
      case 'importexport':
        this.renderImportExportTab(containerEl);
        break;
      default:
        console.warn(`Unknown settings tab: ${this.activeTab}`);
    }
  }

  private renderGeneralSettingsTab(containerEl: HTMLElement): void {
    containerEl.createDiv({cls: 'metaflow-settings-icon'});
    containerEl.createEl('p', {
      text: 'Configure automated metadata workflow management including folder mappings, property scripts, and plugin integrations.',
      cls: 'metaflow-settings-description'
    });
    containerEl.createDiv({cls: 'metaflow-settings-divider'});

    // Hide properties section setting
    new Setting(containerEl)
      .setName('Hide properties section in editor')
      .setDesc('Hide the properties section from the file editor view for a cleaner writing experience')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.hidePropertiesInEditor || false)
        .onChange(async (value) => {
          this.plugin.settings.hidePropertiesInEditor = value;
          await this.plugin.saveSettings();
          // Apply CSS to hide/show properties section immediately
          this.plugin.container.get<UIService>(TYPES.UIService).togglePropertiesVisibility(value);
        }));

    // debug mode setting
    new Setting(containerEl)
      .setName('Debug mode')
      .setDesc('Enable debug mode for verbose logging')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.debugMode)
        .onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        }));

    // Metadata insertion section
    SettingsUtils.createSection(containerEl, 'Metadata insertion behavior');
    new MetadataInsertionSection(
      containerEl.createDiv(),
      this.plugin.settings,
      async () => {await this.plugin.saveSettings();}
    ).render();

  }

  private renderFolderMappingsTab(containerEl: HTMLElement): void {
    // Exclude folders section
    const excludeFoldersSection = SettingsUtils.createSection(containerEl, 'Exclude folders');
    excludeFoldersSection.setDesc('Folders to exclude from metadata update commands. Add one per row.');
    new ExcludeFoldersSection(
      this.app,
      containerEl.createDiv(),
      this.plugin.settings.excludeFolders || [],
      async () => {await this.plugin.saveSettings();}
    ).render();

    // Folder/fileClass mappings section
    const mappingsDetails = SettingsUtils.createSection(containerEl, 'Folder/fileClass mappings');
    mappingsDetails.setDesc('Map folder patterns to MetadataMenu fileClasses. Uses the same pattern matching as Templater plugin. Patterns are evaluated in order, with the first match being used.');

    // Create container for mappings
    const mappingsSection = new FolderFileClassMappingsSection(
      this.app,
      containerEl.createDiv(),
      this.plugin.settings.folderFileClassMappings,
      this.obsidianAdapter,
      this.metadataMenuAdapter,
      this.templaterAdapter,
      this.logNoticeManager,
      async () => {await this.plugin.saveSettings();}
    );
    mappingsSection.render();
  }

  private renderPropertyMappingsTab(containerEl: HTMLElement): void {
    // Property default value scripts section
    const scriptsDetails = SettingsUtils.createSection(containerEl, 'Property default value scripts');
    scriptsDetails.setDesc('Define JavaScript scripts to generate default values for metadata properties.');

    // Create container for scripts
    const scriptsSection = new PropertyDefaultValueScriptsSection(
      this.app,
      containerEl.createDiv(),
      this.plugin,
      this.metadataMenuAdapter,
      async () => {await this.plugin.saveSettings();}
    );
    scriptsSection.render();
  }

  private renderSimulationTab(containerEl: HTMLElement): void {
    // Simulation Testing Section
    SettingsUtils.createSection(containerEl, '🧪 Simulation and testing');
    new SimulationSection(
      this.app,
      containerEl.createDiv(),
      this.plugin.settings,
      this.metadataMenuAdapter,
      this.templaterAdapter,
      this.metaflowService
    ).render();

  }

  private renderImportExportTab(containerEl: HTMLElement): void {
    // Export/Import Settings Section
    const exportImportSection = SettingsUtils.createSection(containerEl, 'Export and import');
    exportImportSection.setDesc('Export your MetaFlow settings as a JSON file or import settings from a JSON file.');
    new ExportImportSection(
      this.app,
      this.metaflowService,
      containerEl.createDiv(),
      this.plugin.settings,
      async () => {await this.plugin.saveSettings(); this.display();}
    ).render();

    // Plugins status section
    new PluginsStatusSection(
      this.app,
      containerEl.createDiv(),
      this.metadataMenuAdapter,
      this.templaterAdapter
    ).render();
  }
}
