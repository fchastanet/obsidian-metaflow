import {App, Setting, Notice} from "obsidian";
import {FolderFileClassMapping} from "../types";
import {TemplaterAdapter} from "../../externalApi/TemplaterAdapter";
import {FolderSuggest} from "../FolderSuggest";
import {ObsidianAdapter} from "../../externalApi/ObsidianAdapter";
import {MetadataMenuAdapter} from "../../externalApi/MetadataMenuAdapter";
import {SettingsUtils} from "../SettingsUtils";
import {LogNoticeManager} from "../../managers/LogNoticeManager";
import {FileClassAvailableFieldsHelpModal} from "../modals/FileClassAvailableFieldsHelpModal";
import {ScriptEditor} from "../ScriptEditor";
import {CompletionsHelpModal} from "../modals/CompletionsHelpModal";
import {TitleTemplateLinter, ValidationResult} from "./TitleTemplateLinter";
import {TitleScriptLinter} from "./TitleScriptLinter";
import {DragDropHelper} from "../DragDropHelper";

export class FolderFileClassMappingsSection {
  private templaterImportButton: HTMLButtonElement;
  private templateLinter: TitleTemplateLinter;
  private scriptLinter: TitleScriptLinter;
  private folderMappingDragDropHelper: DragDropHelper<FolderFileClassMapping>;
  private templateDragDropHelper: (element: HTMLElement, childIndex: number, parentIndex: number) => void;

  constructor(
    private app: App,
    private container: HTMLElement,
    private folderFileClassMappings: FolderFileClassMapping[],
    private obsidianAdapter: ObsidianAdapter,
    private metadataMenuAdapter: MetadataMenuAdapter,
    private templaterAdapter: TemplaterAdapter,
    private logManager: LogNoticeManager,
    private onChange: () => void
  ) {
    this.templateLinter = new TitleTemplateLinter();
    this.scriptLinter = new TitleScriptLinter();

    // Initialize drag and drop helper for folder mappings
    this.folderMappingDragDropHelper = new DragDropHelper<FolderFileClassMapping>({
      container: this.container,
      items: this.folderFileClassMappings,
      onReorder: this.onChange,
      refreshDisplay: () => {
        const mappingsContainer = this.container.querySelector('.mappings-container') as HTMLElement;
        if (mappingsContainer) {
          this.displayFolderMappings(mappingsContainer);
        }
      }
      // No order functions since this uses simple array ordering
    });

    // Initialize drag and drop helper for templates
    this.templateDragDropHelper = DragDropHelper.createNestedArrayHelper(
      this.folderFileClassMappings,
      (mapping) => mapping.noteTitleTemplates,
      this.onChange,
      () => {
        const mappingsContainer = this.container.querySelector('.mappings-container') as HTMLElement;
        if (mappingsContainer) {
          this.displayFolderMappings(mappingsContainer);
        }
      }
    );
  }

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
    mappingsContainer.classList.add('mappings-container');
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
            noteTitleTemplates: [],
            noteTitleScript: {
              script: 'return "";',
              enabled: true
            },
            templateMode: 'template'
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
            noteTitleTemplates: [],
            noteTitleScript: {
              script: 'return "";',
              enabled: true
            },
            templateMode: 'template'
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
      this.displayFolderMapping(container, mapping, index);
    });
  }

  private displayFolderMapping(container: HTMLElement, mapping: FolderFileClassMapping, index: number): void {
    const mappingDiv = container.createEl('div', {cls: 'metaflow-settings-mapping-row metaflow-settings-grab'});
    this.folderMappingDragDropHelper.makeDraggable(mappingDiv, index);
    this.makeFolderMappingDefaultFields(container, mapping, mappingDiv, index);

    const templateSection = mappingDiv.createDiv({cls: 'note-title-template-section'});
    const modeRadioContainer = templateSection.createEl('div', {cls: 'metaflow-settings-mode-selector'});
    const templateSectionToolbar = templateSection.createEl('div', {cls: 'metaflow-settings-note-title-template-toolbar'});
    const modeContainer = templateSectionToolbar.createEl('div', {cls: 'metaflow-settings-mode-container'});
    this.makeModeSelector(modeRadioContainer, modeContainer, mapping, index);

    // Note Title Templates Section
    this.displayNoteTitleTemplates(modeContainer, mapping, index);
  }

  private makeModeSelector(modeRadioContainer: HTMLElement, modeContainer: HTMLElement, mapping: FolderFileClassMapping, index: number) {
    modeRadioContainer.createEl('label', {
      text: 'Auto title mode:', cls: 'metaflow-settings-mode-label', attr: {
        title: 'Choose the mode for auto-generating note titles',
      }
    });

    SettingsUtils.createRadioButtonWithLabel(
      modeRadioContainer,
      {
        label: 'Script',
        labelClass: 'metaflow-settings-radio-label',
        labelTitle: 'Use script',
        radioClass: 'metaflow-settings-radio',
        radioName: `templateMode-${index}`,
        radioValue: 'script',
        checked: mapping.templateMode === 'script'
      }
    );

    SettingsUtils.createRadioButtonWithLabel(
      modeRadioContainer,
      {
        label: 'Template',
        labelClass: 'metaflow-settings-radio-label',
        labelTitle: 'Use template',
        radioClass: 'metaflow-settings-radio',
        radioName: `templateMode-${index}`,
        radioValue: 'template',
        checked: mapping.templateMode === 'template'
      }
    );

    // Add event listeners for radio buttons
    modeRadioContainer.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.type !== 'radio') {
        return;
      }
      mapping.templateMode = target.value as "template" | "script";
      this.onChange();
      this.displayNoteTitleTemplates(modeContainer, mapping, index);
    });
  }

  private makeFolderMappingDefaultFields(container: HTMLElement, mapping: FolderFileClassMapping, mappingDiv: HTMLElement, index: number) {
    const mappingControl = mappingDiv.createEl('div', {cls: 'setting-item-control'});
    mappingControl.classList.add('metaflow-settings-mapping-control');

    // Control row
    const controlRow = mappingControl.createEl('div');
    controlRow.classList.add('metaflow-settings-mapping-control-row');

    // Order display (moved to left)
    const orderSpan = controlRow.createEl('span');
    orderSpan.textContent = `#${index + 1}`;
    orderSpan.classList.add('metaflow-settings-mapping-folder-order');

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
  }

  private displayNoteTitleTemplates(mappingDiv: HTMLElement, mapping: any, mappingIndex: number): void {
    // Initialize properties if not exists
    if (!mapping.noteTitleTemplates) {
      mapping.noteTitleTemplates = [];
    }
    if (!mapping.noteTitleScripts) {
      mapping.noteTitleScripts = [];
    }
    if (!mapping.templateMode) {
      mapping.templateMode = 'template';
    }
    mappingDiv.empty();

    // Display existing templates or scripts based on mode
    const templatesContainer = mappingDiv.createDiv({cls: 'metaflow-settings-templates-container'});
    if (mapping.templateMode === 'template') {
      this.displayTemplateRows(templatesContainer, mapping, mappingIndex);
    } else {
      this.displayScriptRowReadOnly(templatesContainer, mapping, mappingIndex);
    }
  }

  private displayTemplateRows(container: HTMLElement, mapping: any, mappingIndex: number): void {
    container.empty();

    // Toolbar
    const toolbar = container.createDiv({cls: 'metaflow-settings-template-toolbar'});

    // Help button
    const helpButton = toolbar.createEl('button', {text: '🛈 Help', cls: 'metaflow-settings-template-help-btn'});
    helpButton.addEventListener('click', async () => {
      // Import and open the modal
      const modal = new FileClassAvailableFieldsHelpModal(this.app, mapping.fileClass, this.metadataMenuAdapter, this.logManager);
      modal.open();
    });

    // Add button only for templates mode (script mode allows only one script)
    const addButton = toolbar.createEl('button', {text: '➕ Add Note Title Template'});
    addButton.classList.add('metaflow-settings-note-title-template-add-btn');
    addButton.onclick = async () => {
      mapping.noteTitleTemplates.push({template: '', enabled: true});
      await this.onChange();
      this.displayNoteTitleTemplates(container.parentElement as HTMLElement, mapping, mappingIndex);
    };

    mapping.noteTitleTemplates.forEach((template: any, templateIndex: number) => {
      const templateRow = container.createDiv({cls: 'metaflow-settings-template-row'});

      // Add drag and drop functionality for templates
      this.templateDragDropHelper(templateRow, templateIndex, mappingIndex);

      // Drag handle
      templateRow.createEl('span', {cls: 'drag-handle', text: '⋮⋮', attr: {title: 'You can drag and drop this element to rearrange the order of the title templates.'}});

      // Template input (CodeMirror placeholder for now, can be enhanced later)
      const templateInputContainer = templateRow.createEl('div', {cls: 'metaflow-settings-template-input-container'});
      const templateInput = templateInputContainer.createEl('textarea', {cls: 'metaflow-settings-template-input', attr: {rows: 1}});
      templateInput.value = template.template;
      templateInput.placeholder = 'Enter template (e.g., {{title}} - {{author}})';

      templateInput.addEventListener('input', async () => {
        template.template = templateInput.value;
        await this.onChange();
        // Update validation feedback
        this.updateValidationFeedback(templateInputContainer, templateInput.value, false);
      });

      // Initial validation feedback
      if (template.template) {
        this.updateValidationFeedback(templateInputContainer, template.template, false);
      }

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
    defaultRow.createEl('span', {cls: 'metaflow-settings-drag-handle-not-allowed', text: '⋮⋮', attr: {draggable: false, title: 'This element should stay at last position'}});
    defaultRow.createEl('span', {cls: 'metaflow-settings-default-template-label', text: 'Default: Untitled'});

  }

  private displayScriptRowReadOnly(container: HTMLElement, mapping: FolderFileClassMapping, mappingIndex: number): void {
    container.empty();
    const script = mapping.noteTitleScript;

    const toolbarReadOnly = container.createEl('div', {cls: 'metaflow-script-toolbar'});
    // Enabled toggle
    const [enabledTogglePreview, enabledLabelPreview] = SettingsUtils.createCheckboxWithLabel(
      toolbarReadOnly, {
      labelClass: 'metaflow-settings-script-enabled-label',
      labelTitle: 'Allows this script to run',
      checkboxClass: 'metaflow-settings-script-enabled-toggle',
      label: 'Enabled',
      checked: script.enabled,
    });

    enabledTogglePreview.addEventListener('change', async () => {
      script.enabled = enabledTogglePreview.checked;
      await this.onChange();
    });

    // Edit button
    const editButton = toolbarReadOnly.createEl('button', {text: '✏️ Edit'});
    editButton.classList.add('metaflow-settings-script-edit-btn');
    // Event handlers
    editButton.addEventListener('click', () => {
      this.displayScriptRow(container, mapping, mappingIndex);
    });

    // Create read-only view
    const scriptDiv = container.createDiv({cls: 'metaflow-settings-script-row'});
    const readOnlyDiv = scriptDiv.createEl('div', {cls: 'note-title-script-readonly'});

    // Script preview
    const scriptPreview = readOnlyDiv.createEl('span');
    const scriptPreviewText = script.script.replace(/\n/g, ' ').substring(0, 80);
    scriptPreview.textContent = scriptPreviewText + (script.script.length > 80 ? '...' : '');
    scriptPreview.classList.add('metaflow-settings-script-preview');
  }

  private displayScriptRow(container: HTMLElement, mapping: FolderFileClassMapping, mappingIndex: number): void {
    container.empty();
    const script = mapping.noteTitleScript;

    // toolbar
    const toolbar = container.createEl('div', {cls: 'metaflow-script-toolbar'});

    // Help button
    const helpButton = toolbar.createEl('button', {text: '🛈 Help', cls: 'metaflow-settings-template-help-btn'});
    helpButton.addEventListener('click', async () => {
      // Import and open the modal
      new CompletionsHelpModal(this.app, scriptEditor.getCompletions()).open();
    });

    // OK button
    const okButton = toolbar.createEl('button', {text: '✅ OK'});
    okButton.classList.add('metaflow-settings-script-ok-btn');

    // Cancel button
    const cancelButton = toolbar.createEl('button', {text: '❌ Cancel'});
    cancelButton.classList.add('metaflow-settings-script-cancel-btn');

    // Create edit view (hidden by default)
    const scriptDiv = container.createDiv({cls: 'metaflow-settings-script-row'});
    const editDiv = scriptDiv.createEl('div', {cls: 'note-title-script-edit'});
    editDiv.classList.add('metaflow-settings-script-edit');

    // Create validation feedback container
    const validationContainer = scriptDiv.createEl('div', {cls: 'metaflow-script-validation-container'});

    // Store original values for cancel functionality
    let originalScript = script.script;

    // Script editor
    const scriptEditor = new ScriptEditor(this.app, this.metadataMenuAdapter, {
      enableDateFunctions: false, // Don't enable date functions for note title scripts
      enablePromptFunction: false // Don't enable prompt function for note title scripts
    });
    scriptEditor.createEditor(editDiv, 'return "";', script.script);

    // Add validation on script change
    const validateScript = () => {
      const currentScript = scriptEditor.getValue();
      this.updateValidationFeedback(validationContainer, currentScript, true);
    };

    // Initial validation
    if (script.script) {
      validateScript();
    }

    // Add a small delay to validation to avoid too frequent updates
    let validationTimeout: NodeJS.Timeout | null = null;
    const scriptElement = editDiv.querySelector('.ace_editor');
    if (scriptElement) {
      scriptElement.addEventListener('input', () => {
        if (validationTimeout) {
          clearTimeout(validationTimeout);
        }
        validationTimeout = setTimeout(validateScript, 500);
      });
    }

    okButton.addEventListener('click', async () => {
      script.script = scriptEditor.getValue();
      await this.onChange();
      scriptEditor.destroy();
      this.displayScriptRowReadOnly(container, mapping, mappingIndex);
    });

    cancelButton.addEventListener('click', () => {
      script.script = originalScript;
      scriptEditor.destroy();
      this.displayScriptRowReadOnly(container, mapping, mappingIndex);
    });

    // No delete button and no default row for script mode since there's only one script
  }

  /**
   * Creates a validation feedback element for templates or scripts
   */
  private createValidationFeedback(container: HTMLElement, validationResult: ValidationResult): HTMLElement {
    const existingFeedback = container.querySelector('.metaflow-validation-feedback') as HTMLElement | null;
    if (existingFeedback) {
      if (existingFeedback.classList.contains(`metaflow-validation-${validationResult.type}`)) {
        // just update the message
        existingFeedback.textContent = validationResult.message;
        return existingFeedback;
      }
      container.removeChild(existingFeedback);
    }

    const feedbackEl = container.createEl('div', {cls: 'metaflow-validation-feedback'});

    // Add type-specific classes
    feedbackEl.classList.add(`metaflow-validation-${validationResult.type}`);

    // Add icon based on type
    const icon = validationResult.type === 'error' ? '❌' :
      validationResult.type === 'warning' ? '⚠️' : '✅';

    feedbackEl.createEl('span', {
      cls: 'metaflow-validation-icon',
      text: icon
    });

    feedbackEl.createEl('span', {
      cls: 'metaflow-validation-message',
      text: validationResult.message
    });

    return feedbackEl;
  }

  /**
   * Updates validation feedback for a given element
   */
  private updateValidationFeedback(container: HTMLElement, value: string, isScript: boolean = false): void {
    // Only show feedback if there's content to validate
    if (!value || value.trim() === '') {
      // Remove existing feedback
      const existingFeedback = container.querySelector('.metaflow-validation-feedback');
      if (existingFeedback) {
        existingFeedback.remove();
      }
      return;
    }

    // Validate and create feedback
    const validationResult = isScript ?
      this.scriptLinter.validateScript(value) :
      this.templateLinter.validateTemplate(value);

    this.createValidationFeedback(container, validationResult);
  }


}