import {App, PluginSettingTab} from "obsidian";
import type {SettingDefinition, SettingDefinitionItem, SettingDefinitionPage} from "obsidian";
import MetaFlowPlugin from "@metaflow/main";
import {MetadataMenuAdapter} from "@metaflow/externalApi/MetadataMenuAdapter";
import {TemplaterAdapter} from "@metaflow/externalApi/TemplaterAdapter";
import {ObsidianAdapter} from "@metaflow/externalApi/ObsidianAdapter";
import {SettingsUtils} from "./SettingsUtils";
import {SectionRenderer, SectionSettingPage} from "./SectionSettingPage";
import {SettingsSectionContext} from "./sections/SettingsSectionContext";
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

interface PageOptions {
  name: string;
  desc: string;
  displayValue?: () => string;
  status?: () => 'warning' | null;
  visible?: () => boolean;
  renderer: SectionRenderer;
}

const pluralize = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Settings tab for MetaFlow plugin, based on the declarative settings API (Obsidian >= 1.13).
 * Simple settings are declared as controls; complex sections are rendered in sub-pages.
 */
export class MetaFlowSettingTab extends PluginSettingTab {
  plugin: MetaFlowPlugin;
  metaflowService: MetaFlowService;
  metadataMenuAdapter: MetadataMenuAdapter;
  templaterAdapter: TemplaterAdapter;
  obsidianAdapter: ObsidianAdapter;
  logNoticeManager: LogNoticeManager;

  private readonly sectionContext: SettingsSectionContext;
  private readonly metadataInsertionSection: MetadataInsertionSection;
  private readonly excludeFoldersSection: ExcludeFoldersSection;
  private readonly exportImportSection: ExportImportSection;
  private readonly pluginsStatusSection: PluginsStatusSection;

  constructor(app: App, plugin: MetaFlowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.icon = 'workflow';

    // Get services from the plugin's DI container
    this.metadataMenuAdapter = plugin.container.get<MetadataMenuAdapter>(TYPES.MetadataMenuAdapter);
    this.obsidianAdapter = plugin.container.get<ObsidianAdapter>(TYPES.ObsidianAdapter);
    this.logNoticeManager = new LogNoticeManager(this.obsidianAdapter);
    this.metaflowService = plugin.container.get<MetaFlowService>(TYPES.MetaFlowService);
    this.templaterAdapter = plugin.container.get<TemplaterAdapter>(TYPES.TemplaterAdapter);

    this.sectionContext = {
      app,
      get settings() {return plugin.settings;},
      save: () => plugin.saveSettings(),
      refresh: () => this.update(),
    };
    this.metadataInsertionSection = new MetadataInsertionSection(plugin.settings);
    this.excludeFoldersSection = new ExcludeFoldersSection(this.sectionContext);
    this.exportImportSection = new ExportImportSection(this.sectionContext, this.metaflowService);
    this.pluginsStatusSection = new PluginsStatusSection(this.metadataMenuAdapter, this.templaterAdapter);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const settings = this.plugin.settings;
    return [
      this.introDefinition(),
      {
        type: 'group',
        items: [
          SettingsUtils.toggleDefinition('hidePropertiesInEditor',
            'Hide properties section in editor',
            'Hide the properties section from the file editor view for a cleaner writing experience'),
          SettingsUtils.toggleDefinition('debugMode', 'Debug mode', 'Enable debug mode for verbose logging'),
        ],
      },
      this.metadataInsertionSection.getDefinition(),
      {
        type: 'group',
        heading: 'Mappings',
        items: [
          this.pageDefinition({
            name: 'Folder/fileClass mappings',
            desc: 'Map folder patterns to MetadataMenu fileClasses. Uses the same pattern matching as Templater plugin. Patterns are evaluated in order, with the first match being used.',
            displayValue: () => pluralize(settings.folderFileClassMappings.length, 'mapping'),
            status: () => this.metadataMenuAdapter.isMetadataMenuAvailable() ? null : 'warning',
            renderer: containerEl => new FolderFileClassMappingsSection(
              this.app,
              containerEl,
              settings.folderFileClassMappings,
              this.obsidianAdapter,
              this.metadataMenuAdapter,
              this.templaterAdapter,
              this.logNoticeManager,
              () => this.plugin.saveSettings()
            ).render(),
          }),
          this.pageDefinition({
            name: 'Property default value scripts',
            desc: 'Define JavaScript scripts to generate default values for metadata properties.',
            displayValue: () => pluralize(settings.propertyDefaultValueScripts.length, 'script'),
            status: () => this.metadataMenuAdapter.isMetadataMenuAvailable() ? null : 'warning',
            renderer: containerEl => new PropertyDefaultValueScriptsSection(
              this.app,
              containerEl,
              this.plugin,
              this.metadataMenuAdapter,
              () => this.plugin.saveSettings()
            ).render(),
          }),
          this.pageDefinition({
            name: '🧪 Simulation and testing',
            desc: 'Test your configuration on a frontmatter sample (requires MetadataMenu and Templater).',
            visible: () => this.metadataMenuAdapter.isMetadataMenuAvailable() && this.templaterAdapter.isTemplaterAvailable(),
            renderer: containerEl => new SimulationSection(
              this.app,
              containerEl,
              settings,
              this.metadataMenuAdapter,
              this.templaterAdapter,
              this.metaflowService
            ).render(),
          }),
        ],
      },
      this.excludeFoldersSection.getDefinition(),
      this.exportImportSection.getDefinition(),
      ...this.pluginsStatusSection.getDefinitions(),
    ];
  }

  getControlValue(key: string): unknown {
    return SettingsUtils.getValueByPath(this.plugin.settings, key);
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    SettingsUtils.setValueByPath(this.plugin.settings, key, value);
    const needsRefresh = this.applySideEffects(key, value);
    await this.plugin.saveSettings();
    if (needsRefresh) {
      this.update();
    }
  }

  /**
   * Apply immediate side effects of a setting change
   * @returns true when other settings were changed and the definitions must be re-rendered
   */
  private applySideEffects(key: string, value: unknown): boolean {
    if (key === 'hidePropertiesInEditor') {
      this.plugin.container.get<UIService>(TYPES.UIService).togglePropertiesVisibility(Boolean(value));
      return false;
    }
    return this.metadataInsertionSection.applyChange(key, value);
  }

  private introDefinition(): SettingDefinition {
    return {
      name: 'MetaFlow',
      desc: 'Configure automated metadata workflow management including folder mappings, property scripts, and plugin integrations.',
      searchable: false,
      render: setting => {
        setting.settingEl.addClass('metaflow-settings-intro');
        setting.settingEl.prepend(createDiv({cls: 'metaflow-settings-icon'}));
      },
    };
  }

  private pageDefinition(options: PageOptions): SettingDefinitionPage {
    return {
      type: 'page',
      name: options.name,
      desc: options.desc,
      displayValue: options.displayValue,
      status: options.status,
      visible: options.visible,
      // refresh pages summaries (displayValue/status) once the page is closed
      page: () => new SectionSettingPage(options.name, options.renderer, options.desc, () => this.update()),
    };
  }
}
