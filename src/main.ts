import {EditorView} from '@codemirror/view';
import {Plugin, Editor, MarkdownView, TFolder, TFile, TAbstractFile, Vault, ProgressBarComponent, Modal, MarkdownFileInfo, CachedMetadata, WorkspaceLeaf} from 'obsidian';
import {MetaFlowSettings} from './settings/types';
import {DEFAULT_SETTINGS} from './settings/defaultSettings';
import {MetaFlowSettingTab} from './settings/MetaFlowSettingTab';
import {MetaFlowService} from './services/MetaFlowService';
import {FrontMatterService} from './services/FrontMatterService';
import {FileClassStateManager} from './managers/FileClassStateManager';
import {LogNoticeManager} from './managers/LogNoticeManager';
import {ObsidianAdapter} from './externalApi/ObsidianAdapter';
import {CommandFactory} from './commands';

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
  metaFlowService: MetaFlowService;
  frontMatterService: FrontMatterService;
  fileClassStateManager: FileClassStateManager;
  obsidianAdapter: ObsidianAdapter;
  commandFactory: CommandFactory;
  logManager: LogNoticeManager;
  timer: {[key: string]: number} = {};

  async onload() {
    this.settings = await this.loadSettings();
    this.metaFlowService = new MetaFlowService(this.app, this.settings);
    this.frontMatterService = new FrontMatterService();
    this.obsidianAdapter = new ObsidianAdapter(this.app, this.settings);
    this.logManager = new LogNoticeManager(this.obsidianAdapter);
    this.fileClassStateManager = new FileClassStateManager(
      this.app, this.settings, this.logManager,
      async (file: TFile, cache: CachedMetadata | null, oldFileClass: string, newFileClass: string) => {
        if (this.settings.autoMetadataInsertion) {
          await this.metaFlowService.handleFileClassChanged(file, cache, oldFileClass, newFileClass, this.logManager);
        }
      }
    );

    // Initialize command factory with dependencies
    this.commandFactory = new CommandFactory({
      app: this.app,
      settings: this.settings,
      metaFlowService: this.metaFlowService,
      fileClassStateManager: this.fileClassStateManager,
      obsidianAdapter: this.obsidianAdapter,
      saveSettings: this.saveSettings.bind(this)
    });

    // Apply properties visibility setting on load
    this.metaFlowService.togglePropertiesVisibility(this.settings.hidePropertiesInEditor);

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
                const command = this.commandFactory.createMassUpdateMetadataCommand();
                await command.massUpdateMetadataProperties(directory.path, files, this.logManager);
              });
          });
        }
      })
    );
  }

  private registerEvents() {
    // leafChange event allow to initialize fileClass when the file is loading
    this.registerEvent(this.app.workspace.on(
      "active-leaf-change",
      this.fileClassStateManager.handleActiveLeafChange.bind(this.fileClassStateManager)
    ));

    this.registerEvent(this.app.metadataCache.on(
      'changed',
      this.fileClassStateManager.handleMetadataChanged.bind(this.fileClassStateManager)
    ));

    // CodeMirror extension to detect manual edits (typing, paste, cut, drop, undo, redo, autocomplete)
    this.registerEditorExtension(EditorView.updateListener.of(
      this.fileClassStateManager.handleTypingEvent.bind(this.fileClassStateManager)
    ));

    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on('create', this.fileClassStateManager.handleCreateFileEvent.bind(this.fileClassStateManager)));
      this.registerEvent(this.app.vault.on('modify', this.fileClassStateManager.handleModifyFileEvent.bind(this.fileClassStateManager)));
      this.registerEvent(this.app.vault.on('delete', this.fileClassStateManager.handleDeleteFileEvent.bind(this.fileClassStateManager)));
      this.registerEvent(this.app.vault.on('rename', this.fileClassStateManager.handleRenameFileEvent.bind(this.fileClassStateManager)));
    });
  }

  private registerCommands() {
    // Register the main command for single file processing
    this.addCommand({
      id: 'metaflow-update-metadata',
      name: 'Update metadata properties',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        const command = this.commandFactory.createUpdateMetadataCommand();
        command.execute(editor, view, this.logManager);
      }
    });

    // Register the command for single file processing to sort metadata
    this.addCommand({
      id: 'metaflow-sort-metadata',
      name: 'Sort metadata properties',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const command = this.commandFactory.createSortMetadataCommand();
        await command.execute(editor, view, this.logManager);
      }
    });

    // Register the command to move the note to the right folder
    this.addCommand({
      id: 'metaflow-move-note-to-right-folder',
      name: 'Move the note to the right folder',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const command = this.commandFactory.createMoveNoteToRightFolderCommand();
        await command.execute(editor, view, this.logManager);
      }
    });

    // Register the command to rename the file based on rules
    this.addCommand({
      id: 'metaflow-rename-file-based-on-rules',
      name: 'Rename the file based on rules',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const command = this.commandFactory.createRenameFileBasedOnRulesCommand();
        await command.execute(editor, view, this.logManager);
      }
    });

    // Register the mass update command for vault-wide processing
    this.addCommand({
      id: 'metaflow-mass-update-metadata',
      name: 'Mass-update metadata properties',
      callback: async () => {
        const command = this.commandFactory.createMassUpdateMetadataCommand();
        await command.execute(this.logManager);
      }
    });

    // Register toggle properties panel command
    this.addCommand({
      id: 'metaflow-toggle-properties-panel',
      name: 'Toggle properties panel visibility',
      callback: () => {
        const command = this.commandFactory.createTogglePropertiesPanelCommand();
        command.execute(this.logManager);
      }
    });
  }

  onunload() {
    // Remove CSS when plugin is disabled
    this.metaFlowService.togglePropertiesVisibility(false);
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
