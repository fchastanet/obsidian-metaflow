import 'reflect-metadata';
import {Container} from 'inversify';
import {Plugin, Editor, MarkdownView, TFolder, TFile, TAbstractFile, Vault} from 'obsidian';
import {MetaFlowSettings} from '@metaflow/settings/types';
import {DEFAULT_SETTINGS} from '@metaflow/settings/defaultSettings';
import {MetaFlowSettingTab} from '@metaflow/settings/MetaFlowSettingTab';
import {LogNoticeManager} from '@metaflow/managers/LogNoticeManager';
import {LogNoticeManagerInterface} from '@metaflow/managers/types';
import {UIService} from '@metaflow/services/UIService';
import {createContainer, TYPES} from '@metaflow/di';

// Import command types for direct DI access
import type {UpdateMetadataCommand} from '@metaflow/commands/UpdateMetadataCommand';
import type {SortMetadataCommand} from '@metaflow/commands/SortMetadataCommand';
import type {MassUpdateMetadataCommand} from '@metaflow/commands/MassUpdateMetadataCommand';
import type {MoveNoteToRightFolderCommand} from '@metaflow/commands/MoveNoteToRightFolderCommand';
import type {RenameFileBasedOnRulesCommand} from '@metaflow/commands/RenameFileBasedOnRulesCommand';
import type {TogglePropertiesPanelCommand} from '@metaflow/commands/TogglePropertiesPanelCommand';
import EventManager from '@metaflow/eventManager/EventManager';
import EventCron from './eventManager/EventCron';

/**
 * MetaFlow Plugin - Automated metadata workflow management for Obsidian
 *
 * Provides intelligent frontmatter management through:
 * - Automatic field insertion from MetadataMenu definitions
 * - Custom JavaScript scripts for default value generation
 * - Smart property sorting and organization
 * - Seamless Templater integration
 */
export default class MetaFlowPlugin extends Plugin {
  settings: MetaFlowSettings;
  container: Container;
  eventManager: EventManager;
  logNoticeManager: LogNoticeManagerInterface;
  eventCron: EventCron;
  uiService: UIService;

  async onload() {
    this.settings = await this.loadSettings();

    // Create dependency injection container
    this.container = createContainer(this.app, this.settings, this.saveSettings.bind(this));

    // Get services from container
    this.uiService = this.container.get<UIService>(TYPES.UIService);
    this.logNoticeManager = this.container.get<LogNoticeManager>(TYPES.LogNoticeManagerInterface);
    this.eventManager = this.container.get<EventManager>(TYPES.EventManagerInterface);
    this.eventCron = this.container.get<EventCron>(TYPES.EventCron);

    // Apply properties visibility setting on load
    this.uiService.togglePropertiesVisibility(this.settings.hidePropertiesInEditor);

    this.registerCommands();
    this.registerEvents();
    this.registerContextMenus();

    // Add settings tab
    this.addSettingTab(new MetaFlowSettingTab(this.app, this));
  }

  private registerContextMenus() {
    // Add context menu for folder-based mass updates
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, directory) => {
        if (directory instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle('Metaflow - Update metadata in folder')
              .setIcon('folder-edit')
              .onClick(async () => {
                const files: TFile[] = [];
                Vault.recurseChildren(directory, (f: TAbstractFile) => {
                  if (f instanceof TFile) {
                    files.push(f);
                  }
                });
                const command = this.container.get<MassUpdateMetadataCommand>(TYPES.MassUpdateMetadataCommand);
                await command.massUpdateMetadataProperties(directory.path, files);
              });
          });
        }
      })
    );
  }

  private registerEvents() {
    this.app.workspace.onLayoutReady(async () => {
      await this.eventManager.init();
      this.eventCron.start();
      // leafChange event allow to initialize fileClass when the file is loading
      this.registerEvent(this.app.workspace.on(
        "active-leaf-change",
        this.eventManager.handleActiveLeafChange.bind(this.eventManager),
      ));
      this.registerEvent(this.app.metadataCache.on(
        'changed',
        this.eventManager.handleMetadataChanged.bind(this.eventManager),
      ));
      this.registerEvent(this.app.vault.on(
        'create',
        this.eventManager.handleCreateFileEvent.bind(this.eventManager)
      ));
      this.registerEvent(this.app.vault.on(
        'modify',
        this.eventManager.handleModifyFileEvent.bind(this.eventManager),
      ));
      this.registerEvent(this.app.vault.on(
        'delete',
        this.eventManager.handleDeleteFileEvent.bind(this.eventManager)
      ));
      this.registerEvent(this.app.vault.on(
        'rename',
        this.eventManager.handleRenameFileEvent.bind(this.eventManager)
      ));
    });
  }

  private registerCommands() {
    // Register the main command for single file processing
    this.addCommand({
      id: 'update-metadata',
      name: 'Update metadata properties',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        const command = this.container.get<UpdateMetadataCommand>(TYPES.UpdateMetadataCommand);
        command.execute(editor, view);
      }
    });

    // Register the command for single file processing to sort metadata
    this.addCommand({
      id: 'sort-metadata',
      name: 'Sort metadata properties',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const command = this.container.get<SortMetadataCommand>(TYPES.SortMetadataCommand);
        await command.execute(editor, view);
      }
    });

    // Register the command to move the note to the right folder
    this.addCommand({
      id: 'move-note-to-right-folder',
      name: 'Move the note to the right folder',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const command = this.container.get<MoveNoteToRightFolderCommand>(TYPES.MoveNoteToRightFolderCommand);
        await command.execute(editor, view);
      }
    });

    // Register the command to rename the file based on rules
    this.addCommand({
      id: 'rename-file-based-on-rules',
      name: 'Rename the file based on rules',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const command = this.container.get<RenameFileBasedOnRulesCommand>(TYPES.RenameFileBasedOnRulesCommand);
        await command.execute(editor, view);
      }
    });

    // Register the mass update command for vault-wide processing
    this.addCommand({
      id: 'mass-update-metadata',
      name: 'Mass-update metadata properties',
      callback: async () => {
        const command = this.container.get<MassUpdateMetadataCommand>(TYPES.MassUpdateMetadataCommand);
        await command.execute();
      }
    });

    // Register toggle properties panel command
    this.addCommand({
      id: 'toggle-properties-panel',
      name: 'Toggle properties panel visibility',
      callback: () => {
        const command = this.container.get<TogglePropertiesPanelCommand>(TYPES.TogglePropertiesPanelCommand);
        command.execute();
      }
    });
  }

  onunload() {
    this.eventCron.stop();
    // Remove CSS when plugin is disabled
    this.uiService.togglePropertiesVisibility(false);
  }

  async loadSettings(): Promise<MetaFlowSettings> {
    const settings: MetaFlowSettings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Ensure order property exists for existing scripts
    if (settings.propertyDefaultValueScripts) {
      settings.propertyDefaultValueScripts.forEach((script, index) => {
        if (script.order === undefined) {
          script.order = index;
        }
      });
    }
    return settings
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
