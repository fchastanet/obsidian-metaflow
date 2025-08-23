import {App, PluginSettingTab, Setting} from "obsidian";
import MetaFlowPlugin from "../main";
import {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import {TemplaterAdapter} from "../externalApi/TemplaterAdapter";
declare type AceModule = typeof import("ace-builds");
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import {SettingsUtils} from "./SettingsUtils";
import {MetadataInsertionSection} from "./sections/MetadataInsertionSection";
import {ExcludeFoldersSection} from "./sections/ExcludeFoldersSection";
import {FolderFileClassMappingsSection} from "./sections/FolderFileClassMappingsSection";
import {PropertyDefaultValueScriptsSection} from "./sections/PropertyDefaultValueScriptsSection";
import {SimulationSection} from "./sections/SimulationSection";
import {ExportImportSection} from "./sections/ExportImportSection";
import {PluginsStatusSection} from "./sections/PluginsStatusSection";
import {LogNoticeManager} from "../managers/LogNoticeManager";
import {MetaFlowService} from "../services/MetaFlowService";
import type {UIService} from "../services/UIService";
import {TYPES} from "../di/types";
declare const ace: AceModule;

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
  logManager: LogNoticeManager;
  simulationDetails: HTMLElement;
  simulationContainer: HTMLElement;
  metadataMenuStatus: HTMLElement;
  templaterStatus: HTMLElement;
  metadataMenuImportButton: HTMLButtonElement;

  constructor(app: App, plugin: MetaFlowPlugin) {
    super(app, plugin);
    this.plugin = plugin;

    // Get services from the plugin's DI container
    this.metadataMenuAdapter = plugin.container.get<MetadataMenuAdapter>(TYPES.MetadataMenuAdapter);
    this.obsidianAdapter = plugin.container.get<ObsidianAdapter>(TYPES.ObsidianAdapter);
    this.logManager = new LogNoticeManager(this.obsidianAdapter);
    this.metaflowService = plugin.container.get<MetaFlowService>(TYPES.MetaFlowService);
    this.templaterAdapter = plugin.container.get<TemplaterAdapter>(TYPES.TemplaterAdapter);
  }


  display(): void {
    const {containerEl} = this;

    containerEl.empty();
    containerEl.setAttribute('id', 'metaflow-settings');

    containerEl.createDiv({cls: 'metaflow-settings-icon'});
    containerEl.createEl('p', {text: 'MetaFlow Settings', cls: 'metaflow-settings-title'});
    containerEl.createEl('p', {
      text: 'Configure automated metadata workflow management including folder mappings, property scripts, and plugin integrations.',
      cls: 'metaflow-settings-description'
    });

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
    const metadataInsertionDetails = SettingsUtils.createSection(containerEl, 'Metadata insertion behavior');
    new MetadataInsertionSection(
      metadataInsertionDetails,
      this.plugin.settings,
      async () => {await this.plugin.saveSettings();}
    ).render();

    // Exclude folders section
    const excludeFoldersDetails = SettingsUtils.createSection(containerEl, 'Exclude folders');
    new ExcludeFoldersSection(
      this.app,
      excludeFoldersDetails,
      this.plugin.settings.excludeFolders || [],
      async () => {await this.plugin.saveSettings();}
    ).render();

    // Folder/fileClass mappings section
    const mappingsDetails = SettingsUtils.createSection(containerEl, 'Folder/fileClass mappings');
    mappingsDetails.createEl('p', {text: 'Map folder patterns to MetadataMenu fileClasses. Uses the same pattern matching as Templater plugin. Patterns are evaluated in order, with the first match being used.'});

    // Create container for mappings
    const mappingsContainer = mappingsDetails.createEl('div');
    const mappingsSection = new FolderFileClassMappingsSection(
      this.app,
      mappingsContainer,
      this.plugin.settings.folderFileClassMappings,
      this.obsidianAdapter,
      this.metadataMenuAdapter,
      this.templaterAdapter,
      this.logManager,
      async () => {await this.plugin.saveSettings();}
    );
    mappingsSection.render();

    // Property default value scripts section
    const scriptsDetails = SettingsUtils.createSection(containerEl, 'Property default value scripts');
    scriptsDetails.createEl('p', {text: 'Define JavaScript scripts to generate default values for metadata properties.'});

    // Create container for scripts
    const scriptsContainer = scriptsDetails.createEl('div');
    const scriptsSection = new PropertyDefaultValueScriptsSection(
      this.app,
      scriptsContainer,
      this.plugin.settings,
      this.metadataMenuAdapter,
      async () => {await this.plugin.saveSettings();}
    );
    scriptsSection.render();

    // Simulation Testing Section
    this.simulationDetails = SettingsUtils.createSection(containerEl, '🧪 Simulation & Testing');
    new SimulationSection(
      this.app,
      this.simulationDetails,
      this.plugin.settings,
      this.metadataMenuAdapter,
      this.obsidianAdapter,
      this.templaterAdapter,
      this.metaflowService
    ).render();

    // Export/Import Settings Section
    const exportImportDetails = SettingsUtils.createSection(containerEl, 'Export/Import');
    new ExportImportSection(
      this.app,
      this.metaflowService,
      exportImportDetails,
      this.plugin.settings,
      async () => {await this.plugin.saveSettings(); this.display();}
    ).render();

    // Plugins status section
    new PluginsStatusSection(
      this.app,
      containerEl,
      this.metadataMenuAdapter,
      this.templaterAdapter
    ).render();
  }
}
