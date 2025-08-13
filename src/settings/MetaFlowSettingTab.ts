import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import MetaFlowPlugin from "../main";
import {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import {TemplaterAdapter} from "../externalApi/TemplaterAdapter";
import {MetaFlowService} from "../services/MetaFlowService";
import {FrontmatterParseResult, FrontMatterService} from "../services/FrontMatterService";
import {NoteTitleTemplate, FolderFileClassMapping} from "./types";
declare type AceModule = typeof import("ace-builds");
import * as Ace from "ace-builds";
import {FolderSuggest} from "./FolderSuggest";
import {LogNoticeManager} from "../managers/LogNoticeManager";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
declare const ace: AceModule;

/**
 * Settings tab for MetaFlow plugin
 * Provides configuration UI for folder mappings, property scripts, and integration settings
 */
export class MetaFlowSettingTab extends PluginSettingTab {
  plugin: MetaFlowPlugin;
  metadataMenuAdapter: MetadataMenuAdapter;
  templaterAdapter: TemplaterAdapter;
  obsidianAdapter: ObsidianAdapter;
  simulationDetails: HTMLDetailsElement;
  simulationContainer: HTMLElement;
  metadataMenuStatus: HTMLElement;
  templaterStatus: HTMLElement;
  metadataMenuImportButton: HTMLButtonElement;
  templaterImportButton: HTMLButtonElement;

  constructor(app: App, plugin: MetaFlowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.metadataMenuAdapter = new MetadataMenuAdapter(app, plugin.settings);
    this.templaterAdapter = new TemplaterAdapter(app, plugin.settings);
    this.obsidianAdapter = new ObsidianAdapter(app, plugin.settings);
  }


  display(): void {
    const {containerEl} = this;

    containerEl.setAttribute('id', 'metaflow-settings');
    containerEl.empty();

    containerEl.createDiv({cls: 'metaflow-settings-icon'});
    containerEl.createEl('p', {text: 'MetaFlow Settings', cls: 'metaflow-settings-title'});
    containerEl.createEl('p', {
      text: 'Configure automated metadata workflow management including folder mappings, property scripts, and plugin integrations.'
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
          this.plugin.metaFlowService.togglePropertiesVisibility(value);
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

    const metadataInsertionDetails = this.createSection(containerEl, 'Metadata insertion behavior');
    // Auto metadata insertion setting
    const updateDependentRadioButtons = () => {
      autoSortSetting.components[0].setDisabled(!this.plugin.settings.autoMetadataInsertion);
      autoSortSetting.controlEl.setAttribute('title', this.plugin.settings.autoMetadataInsertion ? '' : 'Disabled when auto-insert is off');
      autoMoveNoteToRightFolderSetting.components[0].setDisabled(!this.plugin.settings.autoMetadataInsertion);
      autoMoveNoteToRightFolderSetting.controlEl.setAttribute('title', this.plugin.settings.autoMetadataInsertion ? '' : 'Disabled when auto-insert is off');
    };
    new Setting(metadataInsertionDetails)
      .setName('Auto-insert missing metadata fields')
      .setDesc('Automatically insert missing metadata fields based on fileClass definitions')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoMetadataInsertion)
        .onChange(async (value) => {
          this.plugin.settings.autoMetadataInsertion = value;
          if (!this.plugin.settings.autoMetadataInsertion) {
            this.plugin.settings.autoSort = false;
            this.plugin.settings.autoMoveNoteToRightFolder = false;
          }
          updateDependentRadioButtons();
          await this.plugin.saveSettings();
        }));

    // Auto-sort on view setting
    const autoSortSetting = new Setting(metadataInsertionDetails)
      .setName('Auto-sort metadata properties')
      .setDesc('Automatically sort metadata properties when updating metadata')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSort)
        .onChange(async (value) => {
          this.plugin.settings.autoSort = value;
          await this.plugin.saveSettings();
        }));

    // Sort unknown properties setting
    new Setting(metadataInsertionDetails)
      .setName('Sort unknown properties alphabetically')
      .setDesc('Sort properties not in the custom order alphabetically at the end')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.sortUnknownPropertiesLast)
        .onChange(async (value) => {
          this.plugin.settings.sortUnknownPropertiesLast = value;
          await this.plugin.saveSettings();
        }));

    // Auto-move note to right folder setting
    const autoMoveNoteToRightFolderSetting = new Setting(metadataInsertionDetails)
      .setName('Auto-move note to the right folder')
      .setDesc('Automatically move note to the correct folder based on Folder/FileClass mapping when updating metadata')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoMoveNoteToRightFolder)
        .onChange(async (value) => {
          this.plugin.settings.autoMoveNoteToRightFolder = value;
          await this.plugin.saveSettings();
        }));

    updateDependentRadioButtons();

    // Exclude folders setting (multiple rows with folder suggest)
    const excludeFoldersContainer = metadataInsertionDetails.createDiv();
    excludeFoldersContainer.createEl('div', {text: 'Exclude folders', cls: 'setting-item-name'});
    excludeFoldersContainer.createEl('div', {text: 'Folders to exclude from metadata update commands. Add one per row.', cls: 'setting-item-description'});

    const excludeFoldersList = excludeFoldersContainer.createDiv();
    // Render each folder row
    (this.plugin.settings.excludeFolders || []).forEach((folder: string, idx: number) => {
      this.addFolderRow(excludeFoldersList, folder, idx);
    });

    // Add button to add new folder row
    new Setting(excludeFoldersContainer)
      .addButton(btn => {
        btn.setButtonText('Add folder')
          .setCta()
          .onClick(async () => {
            this.plugin.settings.excludeFolders = this.plugin.settings.excludeFolders || [];
            this.plugin.settings.excludeFolders.push('');
            await this.plugin.saveSettings();
            this.addFolderRow(excludeFoldersList, '', this.plugin.settings.excludeFolders.length - 1);
          });
      });

    // Folder/fileClass mappings - Collapsible
    const mappingsDetails = this.createSection(containerEl, 'Folder/fileClass mappings');
    mappingsDetails.createEl('p', {text: 'Map folder patterns to MetadataMenu fileClasses. Uses the same pattern matching as Templater plugin. Patterns are evaluated in order, with the first match being used.'});

    // Auto-populate from Templater button
    const templaterImportSetting = new Setting(mappingsDetails)
      .setName('Auto-populate from Templater')
      .setDesc('Automatically populate folder mappings from Templater plugin configuration');

    templaterImportSetting.addButton(button => {
      this.templaterImportButton = button.buttonEl;
      button
        .setButtonText('📥 Import from Templater')
        .onClick(async () => {
          await this.importFolderMappingsFromTemplater();
          this.displayFolderMappings(mappingsContainer);
        });
    });

    this.updateTemplaterButtonState();

    // Create container for mappings
    const mappingsContainer = mappingsDetails.createEl('div');
    this.displayFolderMappings(mappingsContainer);

    // Add new mapping button
    new Setting(mappingsDetails)
      .setName('Add folder mapping')
      .addButton(button => button
        .setButtonText('➕ Add mapping')
        .setCta()
        .onClick(() => {
          this.plugin.settings.folderFileClassMappings.push({
            folder: '',
            fileClass: '',
            moveToFolder: false,
            noteTitleTemplates: []
          });
          this.plugin.saveSettings();
          this.displayFolderMappings(mappingsContainer);
        }));

    // Property default value scripts - Collapsible
    const scriptsDetails = this.createSection(containerEl, 'Property default value scripts');
    scriptsDetails.createEl('p', {text: 'Define JavaScript scripts to generate default values for metadata properties.'});

    // Auto-populate from MetadataMenu button
    const metadataMenuImportSetting = new Setting(scriptsDetails)
      .setName('Auto-populate from MetadataMenu')
      .setDesc('Automatically populate property scripts from MetadataMenu plugin fileClass definitions');

    metadataMenuImportSetting.addButton(button => {
      this.metadataMenuImportButton = button.buttonEl;
      button
        .setButtonText('📥 Import from MetadataMenu')
        .onClick(async () => {
          await this.autoPopulatePropertyScriptsFromMetadataMenu();
          this.displayPropertyScripts(scriptsContainer);
        });
    });

    this.updateMetadataMenuButtonState();

    // Create container for scripts
    const scriptsContainer = scriptsDetails.createEl('div');
    this.displayPropertyScripts(scriptsContainer);

    // Add new script button
    new Setting(scriptsDetails)
      .setName('Add property script')
      .addButton(button => button
        .setButtonText('➕ Add property script')
        .setCta()
        .onClick(() => {
          this.plugin.settings.propertyDefaultValueScripts.push({
            propertyName: '',
            script: 'return "";',
            enabled: true,
            order: this.plugin.settings.propertyDefaultValueScripts.length
          });
          this.plugin.saveSettings();
          this.displayPropertyScripts(scriptsContainer);
        }));

    // Simulation Testing Section - Collapsible
    this.simulationDetails = this.createSection(containerEl, '🧪 Simulation & Testing');
    this.simulationDetails.createEl('p', {text: 'Test your MetaFlow configuration by simulating the <code>processContent</code> method with sample frontmatter and different fileClasses.'});

    // Create container for simulation
    this.simulationContainer = this.simulationDetails.createEl('div');
    this.displaySimulationSection();

    // Export/Import Settings Section - Collapsible
    const exportImportDetails = this.createSection(containerEl, 'Export/Import');
    exportImportDetails.createEl('p', {text: 'Export your MetaFlow settings as a JSON file or import settings from a JSON file.'});
    // Export button
    new Setting(exportImportDetails)
      .setName('Export Settings')
      .setDesc('Download current settings as a JSON file')
      .addButton(btn => btn
        .setButtonText('⬇️ Export')
        .setCta()
        .onClick(() => {
          const dataStr = JSON.stringify(this.plugin.settings, null, 2);
          const blob = new Blob([dataStr], {type: 'application/json'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'metaflow-settings.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        })
      );
    // Import button and file input
    new Setting(exportImportDetails)
      .setName('Import Settings')
      .setDesc('Import settings from a JSON file (overwrites current settings)')
      .addButton(btn => {
        btn.setButtonText('⬆️ Import')
          .setCta()
          .onClick(() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = async (event: any) => {
              const file = event.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = async (e: any) => {
                try {
                  const importedSettings = JSON.parse(e.target.result);
                  Object.assign(this.plugin.settings, importedSettings);
                  await this.plugin.saveSettings();
                  new window.Notice('Settings imported successfully!');
                  this.display();
                } catch (err) {
                  new window.Notice('Failed to import settings: Invalid JSON', 5000);
                }
              };
              reader.readAsText(file);
            };
            input.click();
          });
      });

    // Add some help text
    containerEl.createEl('p', {text: 'Usage', cls: 'metaflow-settings-section-header'});
    containerEl.createEl('p', {text: 'Use the command palette to:'});
    const list = containerEl.createEl('ul');
    list.createEl('li', {text: 'Update metadata properties - Add missing fields from fileClass (if automatic option disabled)'});
    list.createEl('li', {text: 'Sort metadata properties - Sort current note'});
    list.createEl('li', {text: 'Move the note to the right folder - depending on the fileClass'});
    list.createEl('li', {text: 'Auto Update metadata fields - Complete metadata processing with default values'});
    list.createEl('li', {text: 'Mass-update metadata properties - Apply changes to all notes'});
    list.createEl('li', {text: 'Toggle properties panel visibility on editor'});
    containerEl.createEl('p', {text: 'Properties will be sorted according to the order specified above. Unknown properties will be sorted alphabetically and placed at the end if the option is enabled.'});

    // plugins status
    this.metadataMenuStatus = containerEl.createEl('p', {text: ''});
    this.templaterStatus = containerEl.createEl('p', {text: ''});
    this.updatePluginsStatus();

    // Add MetaFlow plugin support information
    const pluginSupport = containerEl.createDiv({cls: 'vt-support'});
    // Section header
    pluginSupport.createEl('p', {text: 'Enjoying MetaFlow?', cls: 'metaflow-settings-section-header'});
    // Description
    pluginSupport.createEl('div', {text: 'If you like this Plugin, consider donating to support continued development:', cls: 'setting-item-description'});
    // Buttons row
    const buttonsDiv = pluginSupport.createDiv({cls: 'metaflow-settings-buttons'});
    // Buy me a coffee button
    const coffeeA = buttonsDiv.createEl('a', {
      href: 'https://www.buymeacoffee.com/fchastanetl',
      cls: 'metaflow-settings-btn-coffee',
      attr: {
        target: '_blank',
        rel: 'noopener',
        title: 'buy me a coffee to support my work'
      }
    });
    coffeeA.createEl('img', {
      attr: {
        src: 'https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=fchastanetl&button_colour=BD5FFF&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00'
      }
    });
    // GitHub star button
    const githubA = buttonsDiv.createEl('a', {
      href: 'https://github.com/fchastanet/obsidian-metaflow',
      cls: 'metaflow-settings-btn-github',
      attr: {
        target: '_blank',
        rel: 'noopener',
        title: 'Give me a star on Github'
      }
    });
    githubA.createEl('img', {
      attr: {
        height: '30',
        border: '0',
        src: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
      }
    });
    githubA.createEl('span', {text: 'Star on GitHub', cls: 'metaflow-settings-btn-github-label'});
    // Bug report
    const bugDiv = pluginSupport.createDiv({cls: 'bug-report'});
    bugDiv.appendText('Facing issues or have suggestions? ');
    const bugA = bugDiv.createEl('a', {
      href: 'https://github.com/fchastanet/obsidian-metaflow/issues/',
      attr: {
        target: '_blank',
        rel: 'noopener',
        title: 'Submit a report'
      }
    });
    bugA.setText('Submit a report');
    bugDiv.appendText('.');
  }


  private createSection(
    containerEl: HTMLElement, title: string
  ): HTMLDetailsElement {
    // General Settings - Collapsible
    const section = containerEl.createEl('details', {cls: 'setting-details'});
    section.open = false; // Collapsed by default
    const summary = section.createEl('summary', {cls: 'setting-summary'});
    summary.classList.add('metaflow-settings-summary');

    summary.createEl('p', {text: title, cls: 'metaflow-settings-section-header'});

    const generalToggleDiv = summary.createEl('div', {cls: 'setting-item-control'});
    const generalToggleButton = generalToggleDiv.createEl('button', {cls: 'mod-cta metaflow-settings-toggle-button'});

    // Prevent button click from triggering summary toggle
    generalToggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      section.open = !section.open;
    });

    return section;
  }
  private addFolderRow(excludeFoldersContainer: HTMLDivElement, folder: string, idx: number): void {
    const row = new Setting(excludeFoldersContainer)
      .addSearch(search => {
        search
          .setPlaceholder('Example: folder1/folder2')
          .setValue(folder)
          .onChange(async (value) => {
            if (!Array.isArray(this.plugin.settings.excludeFolders)) {
              this.plugin.settings.excludeFolders = [];
            }
            this.plugin.settings.excludeFolders[idx] = this.obsidianAdapter.normalizePath(value);
            await this.plugin.saveSettings();
          });
        // Add folder suggestions
        new FolderSuggest(this.app, search.inputEl);
      });
    row.settingEl.addClass('no-border');
    row.addExtraButton((btn) => {
      btn.setIcon('cross')
        .setTooltip('Remove')
        .onClick(async () => {
          if (!Array.isArray(this.plugin.settings.excludeFolders)) {
            this.plugin.settings.excludeFolders = [];
          }
          this.plugin.settings.excludeFolders.splice(idx, 1);
          await this.plugin.saveSettings();
          excludeFoldersContainer.removeChild(row.settingEl);
        });
    });
  }

  private updatePluginsStatus(): void {
    if (this.metadataMenuAdapter.isMetadataMenuAvailable()) {
      this.metadataMenuStatus.setText('✅ MetadataMenu plugin is available and ready for integration.');
    } else {
      this.metadataMenuStatus.setText('❌ MetadataMenu plugin not found. Install and enable it to use fileClass-based field insertion.');
    }
    if (this.templaterAdapter.isTemplaterAvailable()) {
      this.templaterStatus.setText('✅ Templater plugin is available and ready for integration.');
    } else {
      this.templaterStatus.setText('❌ Templater plugin not found. Install and enable it to use advanced scripting features.');
    }
  }

  private async importFolderMappingsFromTemplater(): Promise<void> {
    try {
      const folderTemplateMapping = this.templaterAdapter.getFolderTemplatesMapping();

      let importedCount = 0;
      for (const folderTemplate of folderTemplateMapping) {
        // Check if mapping already exists
        const existingMapping = this.plugin.settings.folderFileClassMappings.find(
          mapping => mapping.folder === folderTemplate.folder
        );

        if (!existingMapping) {
          this.plugin.settings.folderFileClassMappings.push({
            folder: folderTemplate.folder,
            fileClass: '',
            moveToFolder: true,
            noteTitleTemplates: []
          });
          importedCount++;
        }
      }

      // Create a map of folder names to their index in folderTemplateMapping
      const templaterOrder = new Map();
      folderTemplateMapping.forEach((template, index) => {
        templaterOrder.set(template.folder, index);
      });

      // make order of folderFileClassMappings elements, the same as folderTemplateMapping
      this.plugin.settings.folderFileClassMappings.sort((a, b) => {
        const aIndex = templaterOrder.get(a.folder);
        const bIndex = templaterOrder.get(b.folder);

        // If both patterns exist in templater settings, sort by their order
        if (aIndex !== undefined && bIndex !== undefined) {
          return aIndex - bIndex;
        }

        // If only one exists in templater settings, prioritize it
        if (aIndex !== undefined) return -1;
        if (bIndex !== undefined) return 1;

        // If neither exists in templater settings, maintain current order
        return 0;
      });

      await this.plugin.saveSettings();
      new Notice(`Imported ${importedCount} folder mappings from Templater`);

    } catch (error) {
      console.error('Error importing from Templater:', error);
      new Notice('Error importing folder mappings from Templater');
    }
  }

  private async autoPopulatePropertyScriptsFromMetadataMenu(): Promise<void> {
    try {
      if (!this.metadataMenuAdapter.isMetadataMenuAvailable()) {
        new Notice('MetadataMenu plugin not available');
        return;
      }

      const allFields = this.metadataMenuAdapter.getAllFieldsFileClassesAssociation();

      let importedCount = 0;
      for (const [propertyName, fieldData] of Object.entries(allFields)) {
        const {fileClasses} = fieldData;
        // Check if script already exists
        const existingScript = this.plugin.settings.propertyDefaultValueScripts.find(
          script => script.propertyName === propertyName
        );

        if (!existingScript) {
          const defaultScript = `return "";`;

          this.plugin.settings.propertyDefaultValueScripts.push({
            propertyName: propertyName,
            script: defaultScript,
            enabled: true,
            order: this.plugin.settings.propertyDefaultValueScripts.length,
            fileClasses,
          });
          importedCount++;
        }
      }

      await this.plugin.saveSettings();
      new Notice(`Imported ${importedCount} property scripts from MetadataMenu`);

    } catch (error) {
      console.error('Error importing from MetadataMenu:', error);
      new Notice('Error importing property scripts from MetadataMenu');
    }
  }

  private displayFolderMappings(container: HTMLElement): void {
    container.empty();

    this.plugin.settings.folderFileClassMappings.forEach((mapping, index) => {
      const mappingDiv = container.createEl('div', {cls: 'metaflow-settings-mapping-row metaflow-settings-grab'});

      // Add drag and drop functionality
      mappingDiv.draggable = true;
      mappingDiv.setAttribute('data-index', index.toString());

      // Add visual feedback for drag operations
      mappingDiv.addEventListener('dragstart', (e) => {
        mappingDiv.classList.add('metaflow-settings-dragging');
        e.dataTransfer?.setData('text/plain', index.toString());
      });

      mappingDiv.addEventListener('dragend', () => {
        mappingDiv.classList.remove('metaflow-settings-dragging');
      });

      mappingDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        mappingDiv.classList.add('metaflow-settings-dragover');
      });

      mappingDiv.addEventListener('dragleave', () => {
        mappingDiv.classList.remove('metaflow-settings-dragover');
      });

      mappingDiv.addEventListener('drop', async (e) => {
        e.preventDefault();
        mappingDiv.classList.remove('metaflow-settings-dragover');

        const draggedIndex = parseInt(e.dataTransfer?.getData('text/plain') || '');
        const targetIndex = index;

        if (draggedIndex !== targetIndex && !isNaN(draggedIndex)) {
          // Reorder the array
          const draggedItem = this.plugin.settings.folderFileClassMappings[draggedIndex];
          this.plugin.settings.folderFileClassMappings.splice(draggedIndex, 1);
          this.plugin.settings.folderFileClassMappings.splice(targetIndex, 0, draggedItem);

          await this.plugin.saveSettings();
          this.displayFolderMappings(container);
        }
      });

      const mappingControl = mappingDiv.createEl('div', {cls: 'setting-item-control'});
      mappingControl.classList.add('metaflow-settings-mapping-control');

      // Control row
      const controlRow = mappingControl.createEl('div');
      controlRow.classList.add('metaflow-settings-mapping-control-row');

      // Folder pattern input
      const inputId = `metaflow-settings-mapping-folder-${index}`;
      controlRow.createEl('label', {text: 'Folder', attr: {for: inputId}});
      const folderInput = controlRow.createEl('input', {
        type: 'text',
        placeholder: 'A Vault folder',
        value: mapping.folder,
        attr: {id: inputId},
      });
      // Add folder suggestions
      new FolderSuggest(this.app, folderInput);
      folderInput.classList.add('metaflow-settings-mapping-folder-input');

      folderInput.addEventListener('input', async () => {
        mapping.folder = this.obsidianAdapter.normalizePath(folderInput.value);
        await this.plugin.saveSettings();
      });

      // FileClass input or select (dropdown) based on MetadataMenu availability
      let fileClassControl: HTMLInputElement | HTMLSelectElement;
      let fileClasses: string[] = [];

      // Try to get fileClasses from MetadataMenu
      try {
        if (this.metadataMenuAdapter.isMetadataMenuAvailable()) {
          const plugin = this.metadataMenuAdapter.getMetadataMenuPlugin();
          if (plugin?.fieldIndex?.fileClassesFields) {
            fileClasses = Array.from(plugin.fieldIndex.fileClassesFields.keys()).map(String);
          }
        }
      } catch (error) {
        console.error('Error getting fileClasses:', error);
      }

      if (fileClasses.length > 0) {
        // Create select dropdown when fileClasses are available
        const fileClassSelect = controlRow.createEl('select');
        fileClassSelect.classList.add('metaflow-settings-mapping-fileclass-select');

        // Add default option
        fileClassSelect.createEl('option', {value: '', text: 'Select fileClass...'});

        // Add fileClasses from MetadataMenu
        fileClasses.sort().forEach(fc => {
          fileClassSelect.createEl('option', {value: fc, text: fc});
        });

        // Add existing fileClasses from mappings if not already present
        this.plugin.settings.folderFileClassMappings.forEach(m => {
          if (m.fileClass && !fileClasses.includes(m.fileClass)) {
            fileClassSelect.createEl('option', {value: m.fileClass, text: m.fileClass});
          }
        });

        fileClassSelect.value = mapping.fileClass || '';
        fileClassControl = fileClassSelect;
      } else {
        // Fallback to text input when MetadataMenu not available
        const fileClassInput = controlRow.createEl('input', {
          type: 'text',
          placeholder: 'FileClass name',
          value: mapping.fileClass
        });
        fileClassInput.classList.add('metaflow-settings-mapping-fileclass-input');
        fileClassControl = fileClassInput;
      }

      // moveToFolder toggle
      const [moveToFolderToggle, moveToFolderLabel] = this.createCheckboxWithLabel(controlRow, {
        label: 'Auto-Move',
        labelClass: 'metaflow-settings-mapping-moveToFolder-label',
        labelTitle: 'Move files to this folder if they match this fileClass',
        checkboxClass: 'metaflow-settings-mapping-moveToFolder-checkbox',
        checked: mapping.moveToFolder || false
      });
      moveToFolderToggle.addEventListener('change', async (event) => {
        mapping.moveToFolder = moveToFolderToggle.checked;
        await this.plugin.saveSettings();
      });

      // Delete button
      const deleteButton = controlRow.createEl('button', {text: '🗑️ Delete'});
      deleteButton.classList.add('metaflow-settings-mapping-delete');

      // Event listeners
      fileClassControl.addEventListener('change', async () => {
        mapping.fileClass = fileClassControl.value;
        await this.plugin.saveSettings();
      });

      if (fileClassControl.tagName === 'INPUT') {
        fileClassControl.addEventListener('input', async () => {
          mapping.fileClass = fileClassControl.value;
          await this.plugin.saveSettings();
        });
      }

      deleteButton.addEventListener('click', async () => {
        this.plugin.settings.folderFileClassMappings.splice(index, 1);
        await this.plugin.saveSettings();
        this.displayFolderMappings(container);
      });

      // Note Title Templates Section
      this.displayNoteTitleTemplates(mappingDiv, mapping, index);
    });
  }

  private createCheckboxWithLabel(container: HTMLElement, options: {
    label?: string,
    labelClass: string,
    labelTitle: string,
    checkboxClass: string,
    checked?: boolean
  }): [HTMLInputElement, HTMLElement] {
    const enabledLabel = container.createEl('label', {title: options.labelTitle});
    enabledLabel.classList.add(options.labelClass);
    const enabledToggle = enabledLabel.createEl('input', {type: 'checkbox'});
    enabledToggle.classList.add(options.checkboxClass);
    enabledLabel.appendChild(document.createTextNode(options.label ?? 'Enabled'));
    if (options.checked !== undefined) {
      enabledToggle.checked = options.checked;
    }
    return [enabledToggle, enabledLabel];
  }

  private displayPropertyScripts(container: HTMLElement): void {
    container.empty();
    const orderedProperties = this.plugin.settings.propertyDefaultValueScripts
      .slice()
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

    orderedProperties.forEach((script, index) => {
      const scriptDiv = container.createEl('div', {cls: 'setting-item'});
      scriptDiv.classList.add('metaflow-settings-script');

      // Add drag and drop functionality
      scriptDiv.draggable = true;
      scriptDiv.classList.add('metaflow-settings-grab');
      scriptDiv.setAttribute('data-index', index.toString());

      // Add visual feedback for drag operations
      scriptDiv.addEventListener('dragstart', (e) => {
        scriptDiv.classList.add('metaflow-settings-dragging');
        e.dataTransfer?.setData('text/plain', index.toString());
      });

      scriptDiv.addEventListener('dragend', () => {
        scriptDiv.classList.remove('metaflow-settings-dragging');
      });

      scriptDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        scriptDiv.classList.add('metaflow-settings-dragover');
      });

      scriptDiv.addEventListener('dragleave', () => {
        scriptDiv.classList.remove('metaflow-settings-dragover');
      });

      scriptDiv.addEventListener('drop', async (e) => {
        e.preventDefault();
        scriptDiv.classList.remove('metaflow-settings-dragover');

        const draggedDisplayIndex = parseInt(e.dataTransfer?.getData('text/plain') || '');
        const targetDisplayIndex = index;

        if (draggedDisplayIndex !== targetDisplayIndex && !isNaN(draggedDisplayIndex)) {
          // Get the actual script objects from the sorted array
          const draggedScript = orderedProperties[draggedDisplayIndex];
          const targetScript = orderedProperties[targetDisplayIndex];

          // Remove dragged item from the ordered array
          orderedProperties.splice(draggedDisplayIndex, 1);

          // Insert at the new position
          const insertIndex = draggedDisplayIndex < targetDisplayIndex ? targetDisplayIndex : targetDisplayIndex;
          orderedProperties.splice(insertIndex, 0, draggedScript);

          // Recompute all order values based on new positions
          orderedProperties.forEach((script, newIndex) => {
            script.order = newIndex + 1;
          });

          await this.plugin.saveSettings();
          this.displayPropertyScripts(container);
        }
      });

      // Create read-only view
      const readOnlyDiv = scriptDiv.createEl('div', {cls: 'property-script-readonly'});
      readOnlyDiv.classList.add('metaflow-settings-script-readonly');

      // Order display (moved to left)
      const orderSpan = readOnlyDiv.createEl('span');
      orderSpan.textContent = `#${index + 1}`;
      orderSpan.classList.add('metaflow-settings-script-order');

      // Property name
      const propertySpan = readOnlyDiv.createEl('span');
      propertySpan.textContent = script.propertyName || 'Unnamed Property';
      propertySpan.classList.add('metaflow-settings-script-property');

      // Script preview (extended to 100 characters)
      const scriptPreview = readOnlyDiv.createEl('span');
      const scriptPreviewText = script.script.replace(/\n/g, ' ').substring(0, 100);
      scriptPreview.textContent = scriptPreviewText + (script.script.length > 100 ? '...' : '');
      scriptPreview.classList.add('metaflow-settings-script-preview');

      // Enabled toggle
      const [enabledTogglePreview, enabledLabelPreview] = this.createCheckboxWithLabel(
        readOnlyDiv, {
        labelClass: 'metaflow-settings-script-enabled-label',
        labelTitle: 'Allows this script to run',
        checkboxClass: 'metaflow-settings-script-enabled-toggle',
        label: 'Enabled',
        checked: script.enabled,
      }
      );

      // Edit button (aligned to right)
      const editButton = readOnlyDiv.createEl('button', {text: '✏️ Edit'});
      editButton.classList.add('metaflow-settings-script-edit-btn');

      // Create edit view (hidden by default)
      const editDiv = scriptDiv.createEl('div', {cls: 'property-script-edit'});
      editDiv.classList.add('metaflow-settings-script-edit');
      editDiv.classList.add('metaflow-settings-hide');

      // Store original values for cancel functionality
      let originalPropertyName = script.propertyName;
      let originalScript = script.script;
      let originalEnabled = script.enabled;

      // Property name input
      const propertyRow = editDiv.createEl('div');
      propertyRow.classList.add('metaflow-settings-script-property-row');

      propertyRow.createEl('label', {text: 'Property:'});
      const propertyInput = propertyRow.createEl('input', {
        type: 'text',
        placeholder: 'Property name (e.g., title, author)',
        value: script.propertyName
      });
      propertyInput.classList.add('metaflow-settings-script-property-input');

      const [enabledToggle, enabledLabel] = this.createCheckboxWithLabel(
        propertyRow, {
        labelClass: 'metaflow-settings-script-enabled-label',
        labelTitle: 'Allows this script to run',
        checkboxClass: 'metaflow-settings-script-enabled-toggle',
        label: 'Enabled',
        checked: script.enabled,
      }
      );

      // Order controls
      const orderDiv = propertyRow.createEl('div', {cls: 'setting-item-order'});
      orderDiv.createEl('span', {text: `Order: ${index + 1}`});

      // Script textarea
      const scriptRow = editDiv.createEl('div');
      let scriptLabel = 'Script';
      if (script.fileClasses) {
        scriptLabel += ` (used by fileClasses: ${script.fileClasses.join(', ')})`;
      }
      scriptLabel += ':';
      scriptRow.createEl('label', {text: scriptLabel});

      // Add help button for completions
      const helpButton = scriptRow.createEl('button', {text: '🛈 Help'});
      helpButton.classList.add('metaflow-settings-script-help-btn');
      helpButton.addEventListener('click', async () => {
        // Import and open the modal
        // @ts-ignore
        const mod = await import('./CompletionsHelpModal');
        new mod.CompletionsHelpModal(this.app, completions).open();
      });

      const scriptTextarea = scriptRow.createEl('textarea', {
        placeholder: 'return "default value";',
      });
      scriptTextarea.value = script.script;
      scriptTextarea.classList.add('metaflow-settings-script-textarea');
      const completions: Ace.Ace.ValueCompletion[] = [
        {value: 'file', score: 1, meta: 'TFile', docHTML: 'the obsidian TFile object currently being edited'},
        {value: 'fileClass', score: 2, meta: 'string', docHTML: 'the deduced or forced fileClass for the current file'},
        {value: 'metadata', score: 1, meta: 'object', docHTML: 'the metadata for the current file'},
        {value: "now()", score: 1, meta: 'string', docHTML: 'current date with default ISO format'},
        {value: "now('YYYY-MM-DD')", score: 1, meta: 'string', docHTML: 'current date with the moment library\'s format'},
        {value: "tomorrow()", score: 1, meta: 'string', docHTML: 'date of tomorrow with default ISO format'},
        {value: "tomorrow('YYYY-MM-DD')", score: 1, meta: 'string', docHTML: 'date of tomorrow with the moment library\'s format'},
        {value: "yesterday()", score: 1, meta: 'string', docHTML: 'date of yesterday with default ISO format'},
        {value: "yesterday('YYYY-MM-DD')", score: 1, meta: 'string', docHTML: 'date of yesterday with the moment library\'s format'},
        {value: "formatDate(date, 'YYYY-MM-DD')", score: 1, meta: 'string', docHTML: 'format javascript date with the moment library\'s format'},
        {value: 'generateMarkdownLink(file)', score: 1, meta: 'string', docHTML: 'generate a markdown link to the file'},
        {value: 'detectLanguage(text)', score: 1, meta: 'string', docHTML: 'simple language detection of the given text'},
        {value: 'prompt("Your prompt here", "defaultValue")', score: 1, meta: 'string: show prompt dialog', docHTML: 'show a prompt dialog to the user and return the input value, defaultValue will be used in case of mass update'},
        {value: 'getParentFile()', score: 1, meta: 'string', docHTML: 'get the parent file of the current file'},
      ];

      const fileCompletions: Ace.Ace.ValueCompletion[] = [
        {value: 'name', score: 1, meta: 'filename', docHTML: 'obsidian TFile object - file name without the path'},
        {value: 'basename', score: 1, meta: 'file\'s basename', docHTML: 'obsidian TFile object - file name without path and extension'},
        {value: 'extension', score: 1, meta: 'file extension', docHTML: 'obsidian TFile object - file extension without the dot'},
        {value: 'parent.path', score: 1, meta: 'folder path', docHTML: 'obsidian TFile object - parent folder path'},
        {value: 'path', score: 1, meta: 'file path', docHTML: 'obsidian TFile object - full file path'},
      ];
      const metadataCompletions: Ace.Ace.ValueCompletion[] = [];
      this.metadataMenuAdapter.getAllFields().forEach(field => {
        metadataCompletions.push({
          value: field.name,
          score: 1,
          meta: `Metadata`,
          docHTML: `Metadata field: ${field.name}.<br>Type: ${field.type}.<br>Description: ${field?.tooltip || 'No description available.'}`,
        });
      });

      let editor: Ace.Editor | null = null;
      if (typeof ace !== 'undefined') {
        editor = ace.edit(scriptTextarea);
        editor.setTheme("ace/theme/dracula");
        editor.session.setMode("ace/mode/javascript");
        editor.session.setUseWrapMode(true);
        editor.setHighlightActiveLine(true);
        editor.completers = [
          {
            getCompletions: (Editor, session, pos, prefix, callback) => {
              const linePrefix = session.getLine(pos.row).substring(0, pos.column);
              if (/metadata\./.exec(linePrefix)) {
                // If the prefix matches metadata., return metadata completions
                callback(null, metadataCompletions);
                return;
              } else if (/file\./.exec(linePrefix)) {
                // If the prefix matches metadata., return metadata completions
                callback(null, fileCompletions);
                return;
              }
              callback(null, completions);
            },
          }
        ];
        editor.setOptions({
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          useWorker: false,
          showLineNumbers: true,
          fontSize: "14px",
          wrap: true,
          autoScrollEditorIntoView: true,
          minLines: 5,
          maxLines: 20,
          tabSize: 2,
          useSoftTabs: true,
          highlightActiveLine: true,
          highlightGutterLine: true,
        });
        editor.resize();
      }
      // Button row
      const buttonRow = editDiv.createEl('div');
      buttonRow.classList.add('metaflow-settings-script-btn-row');

      // Delete button
      const deleteButton = buttonRow.createEl('button', {text: '🗑️ Delete'});
      deleteButton.classList.add('metaflow-settings-script-delete-btn');

      // Add a spacer
      const spacer = buttonRow.createDiv();
      spacer.classList.add('metaflow-settings-script-btn-spacer');

      // OK button
      const okButton = buttonRow.createEl('button', {text: '✅ OK'});
      okButton.classList.add('metaflow-settings-script-ok-btn');

      // Cancel button
      const cancelButton = buttonRow.createEl('button', {text: '❌ Cancel'});
      cancelButton.classList.add('metaflow-settings-script-cancel-btn');

      // Toggle between read-only and edit mode
      const toggleEditMode = (editMode: boolean) => {
        if (editMode) {
          readOnlyDiv.classList.add('metaflow-settings-hide');
          editDiv.classList.remove('metaflow-settings-hide');
          scriptDiv.draggable = false;
          scriptDiv.classList.remove('metaflow-settings-grab');
        } else {
          readOnlyDiv.classList.remove('metaflow-settings-hide');
          editDiv.classList.add('metaflow-settings-hide');
          scriptDiv.draggable = true;
          scriptDiv.classList.add('metaflow-settings-grab');
        }
      };

      // Event listeners
      enabledLabelPreview.addEventListener('click', async (event) => {
        event.preventDefault();
        script.enabled = !script.enabled;
        await this.plugin.saveSettings();
        this.displayPropertyScripts(container);
      });

      editButton.addEventListener('click', () => {
        toggleEditMode(true);
      });

      okButton.addEventListener('click', async () => {
        // Apply changes
        script.propertyName = propertyInput.value;
        script.enabled = enabledToggle.checked;
        if (editor !== null) {
          scriptTextarea.value = editor.getValue();
        }
        script.script = scriptTextarea.value;
        await this.plugin.saveSettings();
        this.displayPropertyScripts(container);
      });

      cancelButton.addEventListener('click', () => {
        // Revert changes
        script.propertyName = originalPropertyName;
        script.script = originalScript;
        script.enabled = originalEnabled;
        propertyInput.value = originalPropertyName;
        scriptTextarea.value = originalScript;
        enabledToggle.checked = originalEnabled;
        toggleEditMode(false);
      });

      deleteButton.addEventListener('click', async () => {
        this.plugin.settings.propertyDefaultValueScripts.splice(index, 1);
        await this.plugin.saveSettings();
        this.displayPropertyScripts(container);
      });
    });
  }

  private displayNoteTitleTemplates(mappingDiv: HTMLElement, mapping: any, mappingIndex: number): void {
    // Initialize noteTitleTemplates if not exists
    if (!mapping.noteTitleTemplates) {
      mapping.noteTitleTemplates = [];
    }

    const templateSection = mappingDiv.createDiv({cls: 'note-title-template-section'});
    const templateSectionToolbar = templateSection.createEl('div', {cls: 'metaflow-settings-note-title-template-toolbar'});
    templateSectionToolbar.createEl('label', {text: 'Note Title Templates', cls: 'metaflow-settings-note-title-template-label'});

    // Add button to create new template
    const addTemplateButton = templateSectionToolbar.createEl('button', {text: '➕ Add Note Title Template'});
    addTemplateButton.classList.add('metaflow-settings-note-title-template-add-btn');
    addTemplateButton.onclick = async () => {
      mapping.noteTitleTemplates.push({template: '', enabled: true});
      await this.plugin.saveSettings();
      this.displayFolderMappings(mappingDiv.parentElement as HTMLElement);
    };

    // Help button
    const helpButton = templateSectionToolbar.createEl('button', {text: '🛈 Help', cls: 'metaflow-settings-template-help-btn'});
    helpButton.onclick = () => {
      this.showAvailableFields(mapping.fileClass);
    };

    // Display existing templates
    const templatesContainer = templateSection.createDiv({cls: 'metaflow-settings-templates-container'});
    this.displayTemplateRows(templatesContainer, mapping, mappingIndex);

  }

  private displayTemplateRows(container: HTMLElement, mapping: any, mappingIndex: number): void {
    container.empty();

    mapping.noteTitleTemplates.forEach((template: any, templateIndex: number) => {
      const templateRow = container.createDiv({cls: 'metaflow-settings-template-row'});
      templateRow.draggable = true;
      templateRow.classList.add('metaflow-settings-template-row-draggable');
      templateRow.setAttribute('data-template-index', templateIndex.toString());

      // Add drag and drop functionality for templates
      templateRow.addEventListener('dragstart', (e) => {
        templateRow.classList.add('metaflow-settings-dragging');
        e.dataTransfer?.setData('text/plain', templateIndex.toString());
      });

      templateRow.addEventListener('dragend', () => {
        templateRow.classList.remove('metaflow-settings-dragging');
      });

      templateRow.addEventListener('dragover', (e) => {
        e.preventDefault();
        templateRow.classList.add('metaflow-settings-dragover');
      });

      templateRow.addEventListener('dragleave', () => {
        templateRow.classList.remove('metaflow-settings-dragover');
      });

      templateRow.addEventListener('drop', async (e) => {
        e.preventDefault();
        templateRow.classList.remove('metaflow-settings-dragover');

        const draggedIndex = parseInt(e.dataTransfer?.getData('text/plain') || '');
        const targetIndex = templateIndex;

        if (draggedIndex !== targetIndex && !isNaN(draggedIndex)) {
          // Reorder the templates array
          const draggedItem = mapping.noteTitleTemplates[draggedIndex];
          mapping.noteTitleTemplates.splice(draggedIndex, 1);
          mapping.noteTitleTemplates.splice(targetIndex, 0, draggedItem);

          await this.plugin.saveSettings();
          this.displayTemplateRows(container, mapping, mappingIndex);
        }
      });

      // Drag handle
      const dragHandle = templateRow.createEl('span', {cls: 'drag-handle', text: '⋮⋮'});

      // Template input (CodeMirror placeholder for now, can be enhanced later)
      const templateInput = templateRow.createEl('textarea', {cls: 'metaflow-settings-template-input', attr: {rows: 1}});
      templateInput.value = template.template;
      templateInput.placeholder = 'Enter template (e.g., {{title}} - {{author}})';
      templateInput.addEventListener('input', async () => {
        template.template = templateInput.value;
        await this.plugin.saveSettings();
      });

      // Enabled toggle
      const [enabledToggle, enabledLabel] = this.createCheckboxWithLabel(templateRow, {
        label: 'Enabled',
        labelClass: 'metaflow-settings-template-checkbox-label',
        labelTitle: 'Toggle template enabled state',
        checkboxClass: 'metaflow-settings-template-checkbox',
        checked: template.enabled,
      });
      enabledToggle.addEventListener('change', async (event: Event) => {
        template.enabled = enabledToggle.checked;
        await this.plugin.saveSettings();
      });

      // Delete button
      const deleteButton = templateRow.createEl('button', {text: '🗑️', cls: 'metaflow-settings-template-delete-btn'});
      deleteButton.onclick = async () => {
        mapping.noteTitleTemplates.splice(templateIndex, 1);
        await this.plugin.saveSettings();
        this.displayTemplateRows(container, mapping, mappingIndex);
      };
    });

    // Default template row (always at the end)
    const defaultRow = container.createDiv({cls: 'metaflow-settings-template-row metaflow-settings-default-template'});
    defaultRow.createEl('span', {cls: 'metaflow-settings-drag-handle-not-allowed', text: '⋮⋮'});
    defaultRow.createEl('span', {cls: 'metaflow-settings-default-template-label', text: 'Default: Untitled'});

  }

  private showAvailableFields(fileClass: string): void {
    const modal = new (this.app as any).Modal(this.app);
    modal.contentEl.createEl('h2', {text: 'Available Fields'});

    if (!fileClass) {
      modal.contentEl.createEl('p', {text: 'Please select a fileClass first to see available fields.'});
      modal.open();
      return;
    }

    modal.contentEl.createEl('h3', {text: `Fields for fileClass: ${fileClass}`});

    try {
      if (this.metadataMenuAdapter.isMetadataMenuAvailable()) {
        const logManager = new LogNoticeManager(this.obsidianAdapter);
        const fields = this.metadataMenuAdapter.getFileClassAndAncestorsFields(fileClass, logManager);

        if (fields.length > 0) {
          const fieldsList = modal.contentEl.createEl('ul');
          fields.forEach((field: any) => {
            const fieldItem = fieldsList.createEl('li');
            fieldItem.createEl('strong', {text: field.name});
            if (field.type) {
              fieldItem.appendText(` (${field.type})`);
            }
            if (field.tooltip) {
              fieldItem.appendText(` - ${field.tooltip}`);
            }
          });
        } else {
          modal.contentEl.createEl('p', {text: 'No fields found for this fileClass.'});
        }
      } else {
        modal.contentEl.createEl('p', {text: 'MetadataMenu plugin is not available. Cannot show field information.'});
      }
    } catch (error) {
      modal.contentEl.createEl('p', {text: `Error retrieving fields: ${error.message}`});
    }

    // Add template syntax help
    modal.contentEl.createEl('h3', {text: 'Template Syntax'});
    const syntaxList = modal.contentEl.createEl('ul');
    syntaxList.createEl('li', {text: '{{fieldName}} - Insert value of a metadata field'});
    syntaxList.createEl('li', {text: '{{file.name}} - File name without extension'});
    syntaxList.createEl('li', {text: '{{file.basename}} - File name without path and extension'});
    syntaxList.createEl('li', {text: '{{now()}} - Current date/time'});

    modal.open();
  }

  private displaySimulationSection(): void {
    if (!this.metadataMenuAdapter.isMetadataMenuAvailable() || !this.templaterAdapter.isTemplaterAvailable()) {
      this.simulationDetails.setAttr('style', 'display: none');
      return;
    }
    this.simulationDetails.setAttr('style', 'display: block');
    this.simulationContainer.empty();

    // FileClass selection
    const fileClassSetting = new Setting(this.simulationContainer)
      .setName('FileClass for simulation')
      .setDesc('Select the fileClass to use for testing');

    let fileClassSelect: HTMLSelectElement;
    fileClassSetting.addDropdown(dropdown => {
      fileClassSelect = dropdown.selectEl;
      dropdown.addOption('', 'Select a fileClass...');

      // Get available fileClasses from MetadataMenu
      if (this.metadataMenuAdapter.isMetadataMenuAvailable()) {
        try {
          const metadataMenuPlugin = this.app.plugins?.plugins?.['metadata-menu'];
          if (metadataMenuPlugin?.fieldIndex?.fileClassesFields) {
            const fileClasses = Array.from(metadataMenuPlugin.fieldIndex.fileClassesFields.keys()).sort();
            fileClasses.forEach(fileClass => {
              const fileClassName = String(fileClass);
              dropdown.addOption(fileClassName, fileClassName);
            });
          }
        } catch (error) {
          console.error('Error getting fileClasses:', error);
        }
      }

      // Also add fileClasses from folder mappings
      this.plugin.settings.folderFileClassMappings.forEach(mapping => {
        if (mapping.fileClass && !dropdown.selectEl.querySelector(`option[value="${mapping.fileClass}"]`)) {
          dropdown.addOption(mapping.fileClass, mapping.fileClass);
        }
      });
    });

    // Input frontmatter
    const sampleSetting = new Setting(this.simulationContainer)
      .setName('Frontmatter content sample')
      .setDesc('Enter frontmatter content sample to test with your configuration');
    sampleSetting.addTextArea(textarea => {
      textarea.inputEl.placeholder = `---
title: Sample Title
author:
date:
tags: []
----

This is sample content for testing.`;
      textarea.inputEl.classList.add('metaflow-settings-simulation-textarea');
    });
    const inputTextarea = sampleSetting.settingEl.querySelector('textarea') as HTMLTextAreaElement;

    // Run simulation button
    const simulationButtonContainer = this.simulationContainer.createEl('div', {cls: 'setting-item'});
    const simulateButton = simulationButtonContainer.createEl('button', {text: '🚀 Run Simulation'});
    simulateButton.classList.add('metaflow-settings-simulation-btn');

    // Status message
    const statusDiv = simulationButtonContainer.createEl('div');
    statusDiv.classList.add('metaflow-settings-simulation-status');
    statusDiv.classList.add('metaflow-settings-hide');

    // Output container
    const outputContainer = this.simulationContainer.createEl('div', {cls: 'setting-item'});
    outputContainer.createEl('p', {text: 'Simulation Output'});

    const outputTextarea = outputContainer.createEl('textarea', {
      placeholder: 'Simulation results will appear here...'
    });
    outputTextarea.classList.add('metaflow-settings-simulation-output');
    outputTextarea.readOnly = true;

    // Event listener for simulation
    simulateButton.addEventListener('click', async () => {
      const selectedFileClass = fileClassSelect.value;
      let inputContent = inputTextarea.value.trim();

      // Validation
      if (!selectedFileClass) {
        this.showStatus(statusDiv, 'Please select a fileClass for simulation.', 'error');
        return;
      }

      if (!inputContent) {
        this.showStatus(statusDiv, 'Please enter some input frontmatter content.', 'error');
        return;
      }

      // inject fileClass inside inputContent metadata
      const frontMatterService = new FrontMatterService();
      const fileClassAlias = this.metadataMenuAdapter.getFileClassAlias();
      const parseResult: FrontmatterParseResult | null = frontMatterService.parseFrontmatter(inputContent);
      if (parseResult === null) {
        this.showStatus(statusDiv, `❌ Invalid input sample`, 'error');
        return;
      }
      parseResult.metadata[fileClassAlias] = selectedFileClass;
      inputContent = frontMatterService.serializeFrontmatter(parseResult.metadata, parseResult.restOfContent);

      const originalGetFileClassFromMetadata = this.metadataMenuAdapter.getFileClassFromMetadata;
      try {
        simulateButton.disabled = true;
        simulateButton.textContent = '⏳ Running...';
        this.showStatus(statusDiv, 'Running simulation...', 'info');

        // Create a mock file object for simulation
        const obsidianAdapter = new ObsidianAdapter(this.app, this.plugin.settings);
        const mockFile = ObsidianAdapter.createMockTFile('folder/simulation-test.md');

        // Create a MetaFlowService instance with current settings
        const metaFlowService = new MetaFlowService(this.app, this.plugin.settings);

        // Override the fileClass detection to use the selected one
        this.metadataMenuAdapter.getFileClassFromMetadata = () => selectedFileClass;

        // Run the simulation
        const logManager = new LogNoticeManager(new ObsidianAdapter(this.app, this.plugin.settings));
        const result = metaFlowService.processContent(inputContent, mockFile, logManager);

        // Display results
        outputTextarea.value = result;
        this.showStatus(statusDiv, `✅ Simulation completed successfully with fileClass: ${selectedFileClass}`, 'success');

      } catch (error) {
        console.error('Simulation error:', error);
        outputTextarea.value = `Error during simulation:\n${error.message}\n\nStack trace:\n${error.stack}`;
        this.showStatus(statusDiv, `❌ Simulation failed: ${error.message}`, 'error');
      } finally {
        // Restore original method
        this.metadataMenuAdapter.getFileClassFromMetadata = originalGetFileClassFromMetadata;

        simulateButton.disabled = false;
        simulateButton.textContent = '🚀 Run Simulation';
      }
    });

    // Pre-fill with example content
    inputTextarea.value = `---
title:
author:
date:
tags: []
status:
---

This is sample content for testing MetaFlow configuration.

The simulation will:
1. Parse this frontmatter
2. Apply the selected fileClass
3. Insert missing fields from MetadataMenu
4. Execute property default value scripts
5. Sort properties according to your settings`;
  }

  private showStatus(statusDiv: HTMLElement, message: string, type: 'success' | 'error' | 'info'): void {
    statusDiv.textContent = message;
    statusDiv.className = 'metaflow-settings-simulation-status';
    statusDiv.classList.remove('success', 'error', 'info', 'metaflow-settings-hide');
    statusDiv.classList.add(type);
  }

  private updateMetadataMenuButtonState(): void {
    if (!this.metadataMenuImportButton) return;

    const isMetadataMenuAvailable = this.metadataMenuAdapter.isMetadataMenuAvailable();
    const shouldEnable = isMetadataMenuAvailable;

    this.metadataMenuImportButton.disabled = !shouldEnable;

    if (!isMetadataMenuAvailable) {
      this.metadataMenuImportButton.title = 'MetadataMenu plugin is not available or not enabled';
    } else {
      this.metadataMenuImportButton.title = 'Import property scripts from MetadataMenu plugin';
    }
  }

  private updateTemplaterButtonState(): void {
    if (!this.templaterImportButton) return;

    const isTemplaterAvailable = this.templaterAdapter.isTemplaterAvailable();
    const shouldEnable = isTemplaterAvailable;

    this.templaterImportButton.disabled = !shouldEnable;

    if (!isTemplaterAvailable) {
      this.templaterImportButton.title = 'Templater plugin is not available or not enabled';
    } else {
      this.templaterImportButton.title = 'Import folder mappings from Templater plugin';
    }
  }
}
