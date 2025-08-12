import {EditorView} from '@codemirror/view';
import {Extension} from '@codemirror/state';
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
import {Utils} from './utils/Utils';

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
  timer: {[key: string]: number} = {};

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
          await this.metaFlowService.handleFileClassChanged(file, cache, oldFileClass, newFileClass, logManager);
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
                const logManager = new LogNoticeManager(new ObsidianAdapter(this.app, this.settings));
                await this.massUpdateMetadataProperties(directory.path, files, logManager);
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
    const manualEditExtension: Extension = EditorView.updateListener.of(this.fileClassStateManager.handleTypingEvent.bind(this.fileClassStateManager));
    this.registerEditorExtension(manualEditExtension);

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
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const logManager = new LogNoticeManager(new ObsidianAdapter(this.app, this.settings));
        await this.sortMetadataPropertiesInEditor(editor, view, logManager);
      }
    });

    // Register the command to move the note to the right folder
    this.addCommand({
      id: 'metaflow-move-note-to-right-folder',
      name: 'Move the note to the right folder',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const logManager = new LogNoticeManager(new ObsidianAdapter(this.app, this.settings));
        await this.moveNoteToTheRightFolder(editor, view, logManager);
      }
    });

    // Register the mass update command for vault-wide processing
    this.addCommand({
      id: 'metaflow-mass-update-metadata',
      name: 'Mass-update metadata properties',
      callback: async () => {
        const files = this.app.vault.getMarkdownFiles();
        const logManager = new LogNoticeManager(new ObsidianAdapter(this.app, this.settings));
        await this.massUpdateMetadataProperties("/", files, logManager);
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

  private async sortMetadataPropertiesInEditor(editor: Editor, view: MarkdownView, logManager: LogManagerInterface) {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      logManager.addWarning('No active file');
      return;
    }

    try {
      await this.metaFlowService.processSortContent(content, file);
    } catch (error) {
      console.error('Error updating metadata properties:', error);
      if (error instanceof MetaFlowException) {
        logManager.addMessage(`Error: ${error.message}`, error.noticeLevel);
      } else {
        logManager.addError('Error updating metadata properties');
      }
    }
  }

  private async massUpdateMetadataProperties(directory: string, files: TFile[], noticeManager: LogManagerInterface) {
    // Filter out files in excluded folders
    const excludeFolders = (this.settings.excludeFolders || []);
    const filteredFiles = files.filter(file => {
      return !excludeFolders.some(folder => file.path.startsWith(this.obsidianAdapter.folderPrefix(folder)));
    }).filter(file => file.extension === 'md');
    const totalFiles = filteredFiles.length;
    if (totalFiles === 0) {
      noticeManager.addWarning('No files to update - all files are excluded or no markdown files found.');
      return;
    }
    let abort = false;
    const modal = new ProgressModal(
      this.app,
      totalFiles,
      `Mass Updating ${totalFiles} files`,
      `Mass Updating ${totalFiles} files in the folder "${directory}"`,
      async () => {
        abort = true;
        await Utils.sleep(this.settings.frontmatterUpdateDelayMs, () => {
          this.fileClassStateManager.setEnabled(true);
        });
      },
      async () => {
        // block fileClassStateManager to update note while mass update is in progress
        this.fileClassStateManager.setEnabled(false);

        try {
          let updatedCount = 0;
          let processedCount = 0;
          let movedCount = 0;
          let errorCount = 0;
          noticeManager.addInfo(`Starting mass update of ${totalFiles} files...`);
          const startTime = new Date();
          for (const file of filteredFiles) {
            try {
              if (abort) {
                break;
              }
              let fileInError = false;
              // Read file content
              const content = await this.app.vault.read(file);
              modal.setCurrentItem(file.path);
              let processedContent = content;
              try {
                processedContent = this.metaFlowService.processContent(content, file, modal);
                if (processedContent !== content) {
                  updatedCount++;
                  await this.app.vault.modify(file, processedContent);
                }
              } catch (error: any) {
                modal.addError(`Error updating metadata in file ${file.path}: ${error.message}`);
                console.error(`Error processing content for file ${file.path}:`, error);
                fileInError = true;
              }
              // Optionally move note to right folder
              const fileClass = this.metaFlowService.getFileClassFromContent(processedContent);
              if (fileClass) {
                try {
                  if (this.settings.autoMoveNoteToRightFolder) {
                    const newFilePath = await this.metaFlowService.moveNoteToTheRightFolder(file, fileClass);
                    if (file.path !== newFilePath) {
                      modal.addInfo(`Moved note ${file.path} to ${newFilePath}`);
                      movedCount++;
                    }
                  }
                } catch (error: any) {
                  modal.addError(`Error moving note to the right folder for file ${file.path}: ${error.message}`);
                  console.error(`Error moving note to the right folder for file ${file.path}:`, error);
                  fileInError = true;
                }
              }
              if (fileInError) {
                errorCount++;
              }
              processedCount++;
            } catch (error: any) {
              modal.addError(`Error updating metadata in file ${file.path}: ${error.message}`);
              console.error(`Error updating metadata in file ${file.path}:`, error);
              errorCount++;
            }
          }
          const endTime = new Date();
          const duration = (endTime.getTime() - startTime.getTime()) / 1000;
          const msg = (errorCount > 0) ? `Mass update completed in ${duration} seconds with ${errorCount} errors` : `Mass update completed in ${duration} seconds`;
          modal.addInfo(msg);
          modal.addInfo(`${processedCount} files processed out of ${totalFiles} total files`);
          modal.addInfo(`${updatedCount} files updated out of ${totalFiles} total files`);
          modal.addInfo(`${movedCount} files moved out of ${totalFiles} total files`);
          if (errorCount > 0) {
            modal.addError(`${errorCount} files encountered errors out of ${totalFiles} total files`);
          }
          modal.finish();
          noticeManager.addInfo(msg);
        } finally {
          this.fileClassStateManager.setEnabled(true);
        }
      }
    );
    modal.open();
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
