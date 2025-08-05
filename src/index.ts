import {Plugin, Editor, MarkdownView, TFolder, Notice, TFile, TAbstractFile, Vault, ProgressBarComponent, Modal, MarkdownFileInfo, CachedMetadata, WorkspaceLeaf} from 'obsidian';
import {MetaFlowSettings} from './settings/types';
import {DEFAULT_SETTINGS} from './settings/defaultSettings';
import {MetaFlowSettingTab} from './settings/MetaFlowSettingTab';
import {MetaFlowService} from './services/MetaFlowService';
import {MetaFlowException} from './MetaFlowException';
import {ProgressModal} from './ui/ProgressModal';
import {FrontMatterService} from './services/FrontMatterService';
import {FileClassStateManager} from './managers/FileClassStateManager';

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
  timer: {[key: string]: number} = {}

  async onload() {
    this.settings = await this.loadSettings();
    this.metaFlowService = new MetaFlowService(this.app, this.settings);
    this.frontMatterService = new FrontMatterService();
    this.fileClassStateManager = new FileClassStateManager(
      this.app, this.settings, this.handleFileClassChanged.bind(this)
    );

    // Apply properties visibility setting on load
    this.metaFlowService.togglePropertiesVisibility(this.settings.hidePropertiesInEditor);

    this.registerCommands();
    this.registerEvents();
    this.registerContextMenus();

    // Add settings tab
    this.addSettingTab(new MetaFlowSettingTab(this.app, this));
  }

  private async handleFileClassChanged(
    file: TFile, cache: CachedMetadata | null, oldFileClass: string, newFileClass: string,
  ): Promise<void> {
    try {
      this.metaFlowService.handleFileClassChanged(file, cache, oldFileClass, newFileClass);
    } catch (error) {
      if (error instanceof MetaFlowException) {
        new Notice(error.message);
      } else {
        console.error(`Error handling file class change for file ${file.path}:`, error);
      }
    }
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
              .onClick(() => {
                const files: TFile[] = [];
                Vault.recurseChildren(file, (f: TAbstractFile) => {
                  if (f instanceof TFile) {
                    files.push(f);
                  }
                });

                this.massUpdateMetadataProperties(files);
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
        try {
          this.updateMetadataPropertiesInEditor(editor, view);
        } catch (error) {
          if (error instanceof MetaFlowException) {
            new Notice(error.message);
          } else {
            console.error(`Error moving note to the right folder for file ${view.file?.path}:`, error);
          }
        }
      }
    });

    // Register the command for single file processing to sort metadata
    this.addCommand({
      id: 'metaflow-sort-metadata',
      name: 'Sort metadata properties',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        try {
          this.sortMetadataPropertiesInEditor(editor, view);
        } catch (error) {
          if (error instanceof MetaFlowException) {
            new Notice(error.message);
          } else {
            console.error(`Error moving note to the right folder for file ${view.file?.path}:`, error);
          }
        }
      }
    });

    // Register the command to move the note to the right folder
    this.addCommand({
      id: 'metaflow-move-note-to-right-folder',
      name: 'Move the note to the right folder',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        try {
          this.moveNoteToTheRightFolder(editor, view);
        } catch (error) {
          if (error instanceof MetaFlowException) {
            new Notice(error.message);
          } else {
            console.error(`Error moving note to the right folder for file ${view.file?.path}:`, error);
          }
        }
      }
    });

    // Register the mass update command for vault-wide processing
    this.addCommand({
      id: 'metaflow-mass-update-metadata',
      name: 'Mass-update metadata properties',
      callback: () => {
        const files = this.app.vault.getMarkdownFiles();
        this.massUpdateMetadataProperties(files);
      }
    });

    // Register toggle properties panel command
    this.addCommand({
      id: 'metaflow-toggle-properties-panel',
      name: 'Toggle properties panel visibility',
      callback: () => {
        this.togglePropertiesPanelVisibility();
      }
    });
  }

  private updateMetadataPropertiesInEditor(editor: Editor, view: MarkdownView) {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      new Notice('No active file');
      return;
    }

    try {
      const processedContent = this.metaFlowService.processContent(content, file);

      if (processedContent !== content) {
        editor.setValue(processedContent);
        new Notice(`Successfully updated metadata fields for "${file.name}"`);
      } else {
        new Notice('No changes needed');
      }
    } catch (error) {
      console.error('Error updating metadata properties:', error);
      if (error instanceof MetaFlowException) {
        new Notice(`Error: ${error.message}`);
      } else {
        new Notice('Error updating metadata properties');
      }
    }
  }

  private moveNoteToTheRightFolder(editor: Editor, view: MarkdownView) {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      new Notice('No active file');
      return;
    }

    try {
      this.metaFlowService.checkIfValidFile(file);
      this.metaFlowService.checkIfAutoMoveNoteToRightFolderEnabled();

      const fileClass = this.metaFlowService.getFileClassFromContent(content);
      if (fileClass) {
        this.metaFlowService.moveNoteToTheRightFolder(file, fileClass);
      } else {
        new Notice('No file class found');
      }
    } catch (error) {
      console.error('Error updating metadata properties:', error);
      if (error instanceof MetaFlowException) {
        new Notice(`Error: ${error.message}`);
      } else {
        new Notice('Error updating metadata properties');
      }
    }
  }

  private sortMetadataPropertiesInEditor(editor: Editor, view: MarkdownView) {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      new Notice('No active file');
      return;
    }

    try {
      const processedContent = this.metaFlowService.processSortContent(content, file);

      if (processedContent !== content) {
        editor.setValue(processedContent);
        new Notice(`Successfully updated metadata fields for "${file.name}"`);
      } else {
        new Notice('No changes needed');
      }
    } catch (error) {
      console.error('Error updating metadata properties:', error);
      if (error instanceof MetaFlowException) {
        new Notice(`Error: ${error.message}`);
      } else {
        new Notice('Error updating metadata properties');
      }
    }
  }

  private massUpdateMetadataProperties(files: TFile[]) {
    let updatedCount = 0;
    let processedCount = 0;
    // Filter out files in excluded folders
    const excludeFolders = (this.settings.excludeFolders || []);
    const filteredFiles = files.filter(file => {
      return !excludeFolders.some(folder => file.path.startsWith(folder + '/'));
    });
    let totalFiles = filteredFiles.length;
    if (totalFiles === 0) {
      new Notice('No files to update - all files are excluded or no markdown files found.');
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
    new Notice(`Starting mass update of ${totalFiles} files...`);

    try {
      for (const file of filteredFiles) {
        try {
          if (abort) {
            break;
          }
          this.app.vault.process(file, (function (content: string) {
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
                const msg = `Mass update completed: ${updatedCount} files updated out of ${totalFiles} total files`;
                modal.addInfo(msg);
                modal.finish();
                new Notice(msg);
              }
            }
          }).bind(this)).then((content) => {
            const fileClass = this.metaFlowService.getFileClassFromContent(content);
            if (fileClass) {
              try {
                this.metaFlowService.moveNoteToTheRightFolder(file, fileClass);
              } catch (error) {
                if (error instanceof MetaFlowException) {
                  new Notice(error.message);
                } else {
                  console.error(`Error moving note to the right folder for file ${file.path}:`, error);
                }
              }
            }
          });
        } catch (error) {
          modal.addError(`Error updating metadata in file ${file.path}: ${error.message}`);
          console.error(`Error updating metadata in file ${file.path}:`, error);
        }
      }
    } catch (error) {
      console.error('Error during mass update:', error);
      new Notice('Error during mass update');
    }
  }

  onunload() {
    // Remove CSS when plugin is disabled
    this.metaFlowService.togglePropertiesVisibility(false);
  }

  private togglePropertiesPanelVisibility() {
    this.settings.hidePropertiesInEditor = !this.settings.hidePropertiesInEditor;
    this.saveSettings();
    this.metaFlowService.togglePropertiesVisibility(this.settings.hidePropertiesInEditor);

    const status = this.settings.hidePropertiesInEditor ? 'hidden' : 'visible';
    new Notice(`Properties panel is now ${status}`);
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
