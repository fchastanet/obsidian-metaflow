import {Plugin, Editor, MarkdownView, TFolder, Notice} from 'obsidian';
import {MetaFlowSettings} from './settings/types';
import {DEFAULT_SETTINGS} from './settings/defaultSettings';
import {MetaFlowSettingTab} from './settings/MetaFlowSettingTab';
import {MetaFlowService} from './services/MetaFlowService';
import {MetaFlowException} from './MetaFlowException';

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
        this.massUpdateMetadataProperties();
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
              .onClick(async () => {
                await this.massUpdateMetadataProperties();
              });
          });
        }
      })
    );

    // Add settings tab
    this.addSettingTab(new MetaFlowSettingTab(this.app, this));
  }

  async updateMetadataPropertiesInEditor(editor: Editor, view: MarkdownView) {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      new Notice('No active file');
      return;
    }

    try {
      const processedContent = await this.metaFlowService.processContent(content, file);

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

  async sortMetadataPropertiesInEditor(editor: Editor, view: MarkdownView) {
    const content = editor.getValue();
    const file = view.file;

    if (!file) {
      new Notice('No active file');
      return;
    }

    try {
      const processedContent = await this.metaFlowService.processSortContent(content, file);

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

  async massUpdateMetadataProperties() {
    const files = this.app.vault.getMarkdownFiles();
    let updatedCount = 0;
    let totalFiles = files.length;

    new Notice(`Starting mass update of ${totalFiles} files...`);

    for (const file of files) {
      try {
        const content = await this.app.vault.read(file);
        const processedContent = await this.metaFlowService.processContent(content, file);

        if (processedContent !== content) {
          await this.app.vault.modify(file, processedContent);
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating metadata in file ${file.path}:`, error);
      }
    }

    new Notice(`Mass update completed: ${updatedCount} files updated out of ${totalFiles} total files`);
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
