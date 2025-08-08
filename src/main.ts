import {Plugin, Editor, MarkdownView, TFolder, Notice, TFile, TAbstractFile, Vault, ProgressBarComponent, Modal, MarkdownFileInfo, CachedMetadata, WorkspaceLeaf} from 'obsidian';
import {MetaFlowSettings} from './settings/types';
import {DEFAULT_SETTINGS} from './settings/defaultSettings';
import {MetaFlowSettingTab} from './settings/MetaFlowSettingTab';
import {MetaFlowService} from './services/MetaFlowService';
import {MetaFlowException} from './MetaFlowException';
import {ProgressModal} from './ui/ProgressModal';
import {FrontMatterService} from './services/FrontMatterService';
import {FileClassStateManager} from './managers/FileClassStateManager';
import {LogNoticeManager} from './managers/LogNoticeManager';
import {ObsidianAdapter} from './externalApi/ObsidianAdapter';
import {LogManagerInterface} from './managers/types';

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
  timer: {[key: string]: number} = {}

  async onload() {
    this.settings = await this.loadSettings();
    this.metaFlowService = new MetaFlowService(this.app, this.settings);
    this.frontMatterService = new FrontMatterService();
    this.obsidianAdapter = new ObsidianAdapter(this.app, this.settings);
    const logManager = new LogNoticeManager(this.obsidianAdapter);
    this.fileClassStateManager = new FileClassStateManager(
      this.app, this.settings, logManager,
      async (file: TFile, cache: CachedMetadata | null, oldFileClass: string, newFileClass: string) => {
        if (this.settings.autoMetadataInsertion) {
          this.metaFlowService.handleFileClassChanged(file, cache, oldFileClass, newFileClass, logManager);
        }
      }
    );

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
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle('Metaflow - Update metadata in folder')
              .setIcon('folder-edit')
              .onClick(async () => {
                const files: TFile[] = [];
                Vault.recurseChildren(file, (f: TAbstractFile) => {
                  if (f instanceof TFile) {
                    files.push(f);
                  }
                });
                const logManager = new LogNoticeManager(new ObsidianAdapter(this.app, this.settings));
                await this.massUpdateMetadataProperties(files, logManager);
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

    // Watch for typing events
    this.registerDomEvent(document, 'keydown', this.fileClassStateManager.handleTypingEvent.bind(this.fileClassStateManager));
    // Watch for clipboard paste
    this.registerDomEvent(document, 'paste', this.fileClassStateManager.handleTypingEvent.bind(this.fileClassStateManager));

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
        const logManager = new LogNoticeManager(new ObsidianAdapter(this.app, this.settings));
        this.updateMetadataPropertiesInEditor(editor, view, logManager);
      }
    });

    // Register the command for single file processing to sort metadata
    this.addCommand({
      id: 'metaflow-sort-metadata',
      name: 'Sort metadata properties',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        const logManager = new LogNoticeManager(new ObsidianAdapter(this.app, this.settings));
        this.sortMetadataPropertiesInEditor(editor, view, logManager);
      }
    });

    // Register the command to move the note to the right folder
    this.addCommand({
      id: 'metaflow-move-note-to-right-folder',
      name: 'Move the note to the right folder',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        const logManager = new LogNoticeManager(new ObsidianAdapter(this.app, this.settings));
        this.moveNoteToTheRightFolder(editor, view, logManager);
      }
    });

    // Register the mass update command for vault-wide processing
    this.addCommand({
      id: 'metaflow-mass-update-metadata',
      name: 'Mass-update metadata properties',
      callback: async () => {
        const files = this.app.vault.getMarkdownFiles();
        const logManager = new LogNoticeManager(new ObsidianAdapter(this.app, this.settings));
        await this.massUpdateMetadataProperties(files, logManager);
      }
    });

    // Register toggle properties panel command
    this.addCommand({
      id: 'metaflow-toggle-properties-panel',
      name: 'Toggle properties panel visibility',
      callback: () => {
        const logManager = new LogNoticeManager(new ObsidianAdapter(this.app, this.settings));
        this.togglePropertiesPanelVisibility(logManager);
      }
    });
  }

  private updateMetadataPropertiesInEditor(editor: Editor, view: MarkdownView, logManager: LogManagerInterface) {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      logManager.addWarning('No active file');
      return;
    }

    try {
      const processedContent = this.metaFlowService.processContent(content, file, logManager);

      if (processedContent !== content) {
        editor.setValue(processedContent);
        logManager.addInfo(`Successfully updated metadata fields for "${file.name}"`);
      } else {
        logManager.addInfo('No changes needed');
      }
    } catch (error) {
      console.error('Error updating metadata properties:', error);
      if (error instanceof MetaFlowException) {
        logManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        logManager.addError('Error updating metadata properties');
      }
    }
  }

  private async moveNoteToTheRightFolder(editor: Editor, view: MarkdownView, logManager: LogManagerInterface) {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      logManager.addWarning('No active file');
      return;
    }

    try {
      this.metaFlowService.checkIfValidFile(file);

      const fileClass = this.metaFlowService.getFileClassFromContent(content);
      if (fileClass) {
        await this.metaFlowService.moveNoteToTheRightFolder(file, fileClass);
      } else {
        logManager.addWarning('No file class found');
      }
    } catch (error) {
      console.error('Error updating metadata properties:', error);
      if (error instanceof MetaFlowException) {
        logManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        logManager.addError('Error updating metadata properties');
      }
    }
  }

  private sortMetadataPropertiesInEditor(editor: Editor, view: MarkdownView, logManager: LogManagerInterface) {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      logManager.addWarning('No active file');
      return;
    }

    try {
      this.metaFlowService.processSortContent(content, file);
    } catch (error) {
      console.error('Error updating metadata properties:', error);
      if (error instanceof MetaFlowException) {
        logManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        logManager.addError('Error updating metadata properties');
      }
    }
  }

  private async massUpdateMetadataProperties(files: TFile[], noticeManager: LogManagerInterface) {
    let updatedCount = 0;
    let processedCount = 0;
    // Filter out files in excluded folders
    const excludeFolders = (this.settings.excludeFolders || []);
    const filteredFiles = files.filter(file => {
      return !excludeFolders.some(folder => file.path.startsWith(this.obsidianAdapter.folderPrefix(folder)));
    });
    let totalFiles = filteredFiles.length;
    if (totalFiles === 0) {
      noticeManager.addWarning('No files to update - all files are excluded or no markdown files found.');
      return;
    }
    let abort = false;
    const modal = new ProgressModal(
      this.app,
      totalFiles,
      `Mass Updating ${totalFiles} files`,
      () => {
        abort = true;
      }
    );
    modal.open();
    noticeManager.addInfo(`Starting mass update of ${totalFiles} files...`);
    const startTime = new Date();
    for (const file of filteredFiles) {
      try {
        if (abort) {
          break;
        }
        const content = await this.app.vault.process(file, (function (content: string) {
          try {
            processedCount++;
            modal.setCurrentItem(file.path);
            const processedContent = this.metaFlowService.processContent(content, file);
            if (processedContent !== content) {
              updatedCount++;
            }
            return processedContent;
          } catch (error) {
            modal.addError(`Error updating metadata in file ${file.path}: ${error.message}`);
            console.error(`Error processing content for file ${file.path}:`, error);
            return content;
          } finally {
            if (processedCount == totalFiles) {
              const endTime = new Date();
              const duration = (endTime.getTime() - startTime.getTime()) / 1000;
              const msg = `Mass update completed: ${updatedCount} files updated out of ${totalFiles} total files in ${duration} seconds`;
              modal.addInfo(msg);
              modal.finish();
              noticeManager.addInfo(msg);
            }
          }
        }).bind(this));
        const fileClass = this.metaFlowService.getFileClassFromContent(content);
        if (fileClass) {
          try {
            if (this.settings.autoMoveNoteToRightFolder) {
              await this.metaFlowService.moveNoteToTheRightFolder(file, fileClass);
            }
          } catch (error) {
            modal.addError(`Error updating metadata in file ${file.path}: ${error.message}`);
            console.error(`Error moving note to the right folder for file ${file.path}:`, error);
          }
        }
      } catch (error) {
        modal.addError(`Error updating metadata in file ${file.path}: ${error.message}`);
        console.error(`Error updating metadata in file ${file.path}:`, error);
      }
    }
  }

  onunload() {
    // Remove CSS when plugin is disabled
    this.metaFlowService.togglePropertiesVisibility(false);
  }

  private togglePropertiesPanelVisibility(logManager: LogManagerInterface) {
    this.settings.hidePropertiesInEditor = !this.settings.hidePropertiesInEditor;
    this.saveSettings();
    this.metaFlowService.togglePropertiesVisibility(this.settings.hidePropertiesInEditor);

    const status = this.settings.hidePropertiesInEditor ? 'hidden' : 'visible';
    logManager.addInfo(`Properties panel is now ${status}`);
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
