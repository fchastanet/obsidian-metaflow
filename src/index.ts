import {Plugin, Editor, MarkdownView, TFolder, Notice, TFile, TAbstractFile, Vault, ProgressBarComponent, Modal} from 'obsidian';
import {MetaFlowSettings} from './settings/types';
import {DEFAULT_SETTINGS} from './settings/defaultSettings';
import {MetaFlowSettingTab} from './settings/MetaFlowSettingTab';
import {MetaFlowService} from './services/MetaFlowService';
import {MetaFlowException} from './MetaFlowException';
import {ProgressModal} from './ui/ProgressModal';

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

  async onload() {
    this.settings = await this.loadSettings();
    this.metaFlowService = new MetaFlowService(this.app, this.settings);

    // Apply properties visibility setting on load
    this.metaFlowService.togglePropertiesVisibility(this.settings.hidePropertiesInEditor);

    // Register the main command for single file processing
    this.addCommand({
      id: 'metaflow-update-metadata',
      name: 'Update metadata properties',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.updateMetadataPropertiesInEditor(editor, view);
      }
    });

    let leafChangeTimeout: ReturnType<typeof setTimeout> | null = null;
    this.app.workspace.on("active-leaf-change", () => {
      if (!this.settings.enableAutoMetadataInsertion) {
        return;
      }
      if (leafChangeTimeout) {
        clearTimeout(leafChangeTimeout);
      }
      leafChangeTimeout = setTimeout(() => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView?.editor) {
          this.updateMetadataPropertiesInEditor(activeView.editor, activeView);
        }
      }, 200);
    });

    // Register the command for single file processing to sort metadata
    this.addCommand({
      id: 'metaflow-sort-metadata',
      name: 'Sort metadata properties',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.sortMetadataPropertiesInEditor(editor, view);
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
        this.togglePropertiesPanelSetting();
      }
    });

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

    // Add settings tab
    this.addSettingTab(new MetaFlowSettingTab(this.app, this));
  }

  updateMetadataPropertiesInEditor(editor: Editor, view: MarkdownView) {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      new Notice('No active file');
      return;
    }
    // Exclude files in excluded folders
    const excludeFolders = (this.settings.excludeFolders || []);
    if (excludeFolders.some(folder => file.path.startsWith(folder + '/'))) {
      new Notice(`File ${file.name} is in an excluded folder: ${file.path}`);
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

  sortMetadataPropertiesInEditor(editor: Editor, view: MarkdownView) {
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

  massUpdateMetadataProperties(files: TFile[]) {
    let updatedCount = 0;
    let processedCount = 0;
    // Filter out files in excluded folders
    const excludeFolders = (this.settings.excludeFolders || []);
    const filteredFiles = files.filter(file => {
      return !excludeFolders.some(folder => file.path.startsWith(folder + '/'));
    });
    let totalFiles = filteredFiles.length;
    if (totalFiles === 0) {
      new Notice('No files to update');
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
          }).bind(this));
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

  private togglePropertiesPanelSetting() {
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
