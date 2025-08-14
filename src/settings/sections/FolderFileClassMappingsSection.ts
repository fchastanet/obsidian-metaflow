import {App, Setting, Notice} from "obsidian";
import {FolderFileClassMapping} from "../types";
import {TemplaterAdapter} from "../../externalApi/TemplaterAdapter";
import {FolderSuggest} from "../FolderSuggest";
import {ObsidianAdapter} from "../../externalApi/ObsidianAdapter";
import {MetadataMenuAdapter} from "../../externalApi/MetadataMenuAdapter";
import {SettingsUtils} from "../SettingsUtils";
import {LogNoticeManager} from "../../managers/LogNoticeManager";
import {FileClassAvailableFieldsHelpModal} from "../modals/FileClassAvailableFieldsHelpModal";

export class FolderFileClassMappingsSection {
  private templaterImportButton: HTMLButtonElement;

  constructor(
    private app: App,
    private container: HTMLElement,
    private folderFileClassMappings: FolderFileClassMapping[],
    private obsidianAdapter: ObsidianAdapter,
    private metadataMenuAdapter: MetadataMenuAdapter,
    private templaterAdapter: TemplaterAdapter,
    private logManager: LogNoticeManager,
    private onChange: () => void
  ) { }

  render() {
    this.container.empty();

    // Auto-populate from Templater button
    const templaterImportSetting = new Setting(this.container)
      .setName('Auto-populate from Templater')
      .setDesc('Automatically populate folder mappings from Templater plugin configuration');

    templaterImportSetting.addButton(button => {
      this.templaterImportButton = button.buttonEl;
      button
        .setButtonText('📥 Import from Templater')
        .onClick(async () => {
          await this.importFolderMappingsFromTemplater();
          this.render();
        });
    });
    this.updateTemplaterButtonState();

    // Create container for mappings
    const mappingsContainer = this.container.createEl('div');
    this.displayFolderMappings(mappingsContainer);

    // Add new mapping button
    new Setting(this.container)
      .setName('Add folder mapping')
      .addButton(button => button
        .setButtonText('➕ Add mapping')
        .setCta()
        .onClick(() => {
          this.folderFileClassMappings.push({
            folder: '',
            fileClass: '',
            moveToFolder: false,
            noteTitleTemplates: []
          });
          this.onChange();
          this.render();
        }));
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

  private async importFolderMappingsFromTemplater(): Promise<void> {
    try {
      const folderTemplateMapping = this.templaterAdapter.getFolderTemplatesMapping();

      let importedCount = 0;
      for (const folderTemplate of folderTemplateMapping) {
        // Check if mapping already exists
        const existingMapping = this.folderFileClassMappings.find(
          mapping => mapping.folder === folderTemplate.folder
        );

        if (!existingMapping) {
          this.folderFileClassMappings.push({
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
      this.folderFileClassMappings.sort((a, b) => {
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

      await this.onChange();
      new Notice(`Imported ${importedCount} folder mappings from Templater`);

    } catch (error) {
      console.error('Error importing from Templater:', error);
      new Notice('Error importing folder mappings from Templater');
    }
  }

  private displayFolderMappings(container: HTMLElement): void {
    container.empty();

    this.folderFileClassMappings.forEach((mapping, index) => {
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
          const draggedItem = this.folderFileClassMappings[draggedIndex];
          this.folderFileClassMappings.splice(draggedIndex, 1);
          this.folderFileClassMappings.splice(targetIndex, 0, draggedItem);

          await this.onChange();
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
        await this.onChange();
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
        this.folderFileClassMappings.forEach(m => {
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
      const [moveToFolderToggle, moveToFolderLabel] = SettingsUtils.createCheckboxWithLabel(controlRow, {
        label: 'Auto-Move',
        labelClass: 'metaflow-settings-mapping-moveToFolder-label',
        labelTitle: 'Move files to this folder if they match this fileClass',
        checkboxClass: 'metaflow-settings-mapping-moveToFolder-checkbox',
        checked: mapping.moveToFolder || false
      });
      moveToFolderToggle.addEventListener('change', async (event) => {
        mapping.moveToFolder = moveToFolderToggle.checked;
        await this.onChange();
      });

      // Delete button
      const deleteButton = controlRow.createEl('button', {text: '🗑️ Delete'});
      deleteButton.classList.add('metaflow-settings-mapping-delete');

      // Event listeners
      fileClassControl.addEventListener('change', async () => {
        mapping.fileClass = fileClassControl.value;
        await this.onChange();
      });

      if (fileClassControl.tagName === 'INPUT') {
        fileClassControl.addEventListener('input', async () => {
          mapping.fileClass = fileClassControl.value;
          await this.onChange();
        });
      }

      deleteButton.addEventListener('click', async () => {
        this.folderFileClassMappings.splice(index, 1);
        await this.onChange();
        this.displayFolderMappings(container);
      });

      // Note Title Templates Section
      this.displayNoteTitleTemplates(mappingDiv, mapping, index);
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
      await this.onChange();
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

          await this.onChange();
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
        await this.onChange();
      });

      // Enabled toggle
      const [enabledToggle, enabledLabel] = SettingsUtils.createCheckboxWithLabel(templateRow, {
        label: 'Enabled',
        labelClass: 'metaflow-settings-template-checkbox-label',
        labelTitle: 'Toggle template enabled state',
        checkboxClass: 'metaflow-settings-template-checkbox',
        checked: template.enabled,
      });
      enabledToggle.addEventListener('change', async (event: Event) => {
        template.enabled = enabledToggle.checked;
        await this.onChange();
      });

      // Delete button
      const deleteButton = templateRow.createEl('button', {text: '🗑️', cls: 'metaflow-settings-template-delete-btn'});
      deleteButton.onclick = async () => {
        mapping.noteTitleTemplates.splice(templateIndex, 1);
        await this.onChange();
        this.displayTemplateRows(container, mapping, mappingIndex);
      };
    });

    // Default template row (always at the end)
    const defaultRow = container.createDiv({cls: 'metaflow-settings-template-row metaflow-settings-default-template'});
    defaultRow.createEl('span', {cls: 'metaflow-settings-drag-handle-not-allowed', text: '⋮⋮'});
    defaultRow.createEl('span', {cls: 'metaflow-settings-default-template-label', text: 'Default: Untitled'});

  }

  private showAvailableFields(fileClass: string): void {
    const modal = new FileClassAvailableFieldsHelpModal(this.app, fileClass, this.metadataMenuAdapter, this.logManager);
    modal.open();
  }


}