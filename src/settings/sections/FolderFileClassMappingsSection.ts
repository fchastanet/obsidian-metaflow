import {App, Setting, TFile} from "obsidian";
import {FolderFileClassMapping, Msg, MsgLevel, NoteTitleTemplate} from "@metaflow/settings/types";
import {TemplaterAdapter} from "@metaflow/externalApi/TemplaterAdapter";
import {FolderSuggest} from "@metaflow/settings/FolderSuggest";
import {ObsidianAdapter} from "@metaflow/externalApi/ObsidianAdapter";
import {MetadataMenuAdapter} from "@metaflow/externalApi/MetadataMenuAdapter";
import {SettingsUtils} from "@metaflow/settings/SettingsUtils";
import {LogNoticeManager} from "@metaflow/managers/LogNoticeManager";
import {FileClassAvailableFieldsHelpModal} from "@metaflow/settings/modals/FileClassAvailableFieldsHelpModal";
import {ScriptEditor} from "@metaflow/settings/ScriptEditor";
import {CompletionsHelpModal} from "@metaflow/settings/modals/CompletionsHelpModal";
import {TitleTemplateLinter, ValidationResult} from "../../linters/TitleTemplateLinter";
import {TitleScriptLinter} from "../../linters/TitleScriptLinter";

export class FolderFileClassMappingsSection {
  private templaterImportButton?: HTMLButtonElement;
  private templateLinter: TitleTemplateLinter;
  private scriptLinter: TitleScriptLinter;

  constructor(
    private app: App,
    private container: HTMLElement,
    private folderFileClassMappings: FolderFileClassMapping[],
    private obsidianAdapter: ObsidianAdapter,
    private metadataMenuAdapter: MetadataMenuAdapter,
    private templaterAdapter: TemplaterAdapter,
    private logNoticeManager: LogNoticeManager,
    private onChange: () => void
  ) {
    this.templateLinter = new TitleTemplateLinter();
    this.scriptLinter = new TitleScriptLinter();
  }

  render() {
    this.container.empty();

    // Auto-populate from Templater button
    const templaterImportSetting = new Setting(this.container)
      .setName('Auto-populate from Templater')
      .setDesc('Automatically populate folder mappings from Templater plugin configuration');
    const importFromTemplaterMsgsContainer = this.container.createEl('div', {cls: 'metaflow-settings-import-feedback'});

    templaterImportSetting.addButton(button => {
      this.templaterImportButton = button.buttonEl;
      button
        .setButtonText('📥 Import from Templater')
        .onClick(async () => {
          importFromTemplaterMsgsContainer.empty();
          const msgs: Msg[] = [];
          await this.importFolderMappingsFromTemplater(msgs);
          const mappingsContainer = this.container.getElementsByClassName('mappings-container')[0] as HTMLElement;
          this.displayFolderMappings(mappingsContainer, msgs);
          this.displayMsgs(importFromTemplaterMsgsContainer, msgs);
        });
    });
    this.updateTemplaterButtonState();

    // Create container for mappings
    const mappingsContainer = this.container.createEl('div');
    mappingsContainer.classList.add('mappings-container');
    const msgs: Msg[] = [];
    this.displayFolderMappings(mappingsContainer, msgs);
    this.displayMsgs(importFromTemplaterMsgsContainer, msgs);
  }

  private displayMsgs(container: HTMLElement, msgs: Msg[]): void {
    if (msgs.length === 0) {
      return;
    }
    const ul = container.createEl('ul', {cls: 'metaflow-settings-import-feedback'});
    msgs.forEach(msgObj => {
      ul.createEl('li', {text: `${msgObj.level} - ${msgObj.text}`, cls: `metaflow-settings-mapping-fileclass-${msgObj.level}`});
    });
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

  private displayFolderMappings(container: HTMLElement, msgs: Msg[]): void {
    const folderMappings = this.getFolderFileClassMappings(msgs)
    folderMappings.forEach((mapping, index) => {
      this.displayFolderMapping(container, mapping, index);
    });
  }

  private displayFolderMapping(container: HTMLElement, mapping: FolderFileClassMapping, index: number): void {
    const mappingDiv = container.createEl('div', {cls: 'metaflow-settings-mapping-row'});
    this.makeFolderMappingDefaultFields(mapping, mappingDiv, index);

    const templateSection = mappingDiv.createDiv({cls: 'metaflow-note-title-template-section'});
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

  /**
   * try to deduce the fileClass from the template associated with the folder
   * @param path {string} The path to the template file
   * @param msgs {any[]} An array to collect warning and info messages
   * @returns The deduced fileClass or null if it cannot be determined
   */
  private async getFileClassFromFileFrontmatter(path: string, msgs: Msg[]): Promise<string | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      msgs.push({level: MsgLevel.Warning, text: `Template file ${path} does not exist or is not a TFile`});
      return null;
    }
    const frontmatter = await this.obsidianAdapter.getFileFrontmatter(file);
    if (!frontmatter) {
      msgs.push({level: MsgLevel.Warning, text: `Template file ${path} does not have frontmatter`});
      return null;
    }
    return this.metadataMenuAdapter.getFileClassFromMetadata(frontmatter);
  }

  private async importFolderMappingsFromTemplater(msgs: Msg[]): Promise<void> {
    try {
      const folderMappings = this.getFolderFileClassMappings(msgs);
      if (folderMappings.length === 0) {
        return;
      }
      const folderTemplateMapping = this.templaterAdapter.getFolderTemplatesMapping(msgs);

      let importedCount = 0;
      const fileClassesUsed = new Set<string>();
      for (const folderTemplate of folderTemplateMapping) {
        const fileClass = await this.getFileClassFromFileFrontmatter(folderTemplate.template, msgs);
        if (!fileClass) {
          msgs.push({level: MsgLevel.Warning, text: `${folderTemplate.folder} - Template file ${folderTemplate.template} does not have a fileClass in frontmatter`});
          continue;
        }
        if (fileClassesUsed.has(fileClass)) {
          msgs.push({level: MsgLevel.Warning, text: `${folderTemplate.folder} - FileClass ${fileClass} already imported, skipping duplicate`});
          continue;
        }
        fileClassesUsed.add(fileClass);
        // Check if folder mapping exists for this fileClass
        const existingMapping = this.folderFileClassMappings.find(mapping => mapping.fileClass === fileClass);
        if (typeof existingMapping === 'undefined') {
          msgs.push({level: MsgLevel.Info, text: `${folderTemplate.folder} - Folder mapping for fileClass ${fileClass} does not exist, skipping`});
          continue;
        }
        const oldFolder = existingMapping.folder;
        if (oldFolder === folderTemplate.folder) {
          // No change needed
          continue;
        } else if (oldFolder === '') {
          msgs.push({level: MsgLevel.Success, text: `${folderTemplate.folder} - Folder mapping for fileClass ${fileClass} updated to ${folderTemplate.folder}`});
        } else {
          msgs.push({level: MsgLevel.Success, text: `${folderTemplate.folder} - Folder mapping for fileClass ${fileClass} updated from ${oldFolder} to ${folderTemplate.folder}`});
        }
        existingMapping.folder = this.obsidianAdapter.normalizePath(folderTemplate.folder);
        importedCount++;
      }

      await this.onChange();
      msgs.push({level: MsgLevel.Success, text: `Imported ${importedCount} folder mappings from Templater`});
    } catch (error) {
      console.error('Error importing from Templater:', error);
      msgs.push({level: MsgLevel.Error, text: 'Error importing folder mappings from Templater'});
    }
  }

  private getFileClassesFromMetadataMenu() {
    const plugin = this.metadataMenuAdapter.getMetadataMenuPlugin();
    if (plugin?.fieldIndex?.fileClassesFields) {
      return Array.from(plugin.fieldIndex.fileClassesFields.keys()).map(String);
    }
    return [];
  }

  private tryToGetFileClassesFromMetadataMenu(msgs: Msg[]): string[] {
    // Try to get fileClasses from MetadataMenu
    let fileClasses: string[] = [];
    let msg = '';
    let msgType: MsgLevel = MsgLevel.Success;
    try {
      if (!this.metadataMenuAdapter.isMetadataMenuAvailable()) {
        msgs.push({level: MsgLevel.Error, text: 'MetadataMenu plugin is not available.'});
        return [];
      }
      fileClasses = this.getFileClassesFromMetadataMenu();
      if (fileClasses.length === 0) {
        msg = 'MetadataMenu plugin - no fileClasses found.';
      } else {
        msg = `MetadataMenu plugin - found ${fileClasses.length} fileClasses.`;
      }
    } catch (error) {
      console.error('Error getting fileClasses:', error);
      msg = 'MetadataMenu plugin - Error getting fileClasses.';
      msgType = MsgLevel.Error;
    }
    if (msg) {
      msgs.push({level: msgType, text: msg});
    }
    return fileClasses;
  }

  private getFolderFileClassMappings(msgs: Msg[]): FolderFileClassMapping[] {
    // Try to get fileClasses from MetadataMenu
    const fileClasses = this.tryToGetFileClassesFromMetadataMenu(msgs);
    if (fileClasses.length === 0) {
      return []; // No fileClasses available, skip rendering the fileClass input
    }

    // remove folderMappings with no longer existing fileClasses
    this.folderFileClassMappings = this.folderFileClassMappings.filter(mapping => {
      const fileClassExists = mapping.fileClass && mapping.fileClass !== '' && fileClasses.includes(mapping.fileClass);
      if (!fileClassExists) {
        msgs.push({level: MsgLevel.Warning, text: `${mapping.folder} - Folder mapping for fileClass ${mapping.fileClass} does not exist, skipping`});
      }
      return fileClassExists;
    });

    // add folderMappings for fileClasses that are not already in the list
    fileClasses.forEach(fileClass => {
      if (!this.folderFileClassMappings.some(mapping => mapping.fileClass === fileClass)) {
        msgs.push({level: MsgLevel.Info, text: `Folder mapping for fileClass ${fileClass} does not exist, adding default mapping`});
        this.folderFileClassMappings.push({
          folder: '',
          fileClass: fileClass,
          moveToFolder: true,
          noteTitleTemplates: [],
          noteTitleScript: {
            script: 'return "";',
            enabled: true
          },
          templateMode: 'template'
        });
      }
    });

    // sort folderFileClassMappings by fileClass
    this.folderFileClassMappings.sort((a, b) => a.fileClass.localeCompare(b.fileClass));

    // ensure all needed fields are set
    this.folderFileClassMappings.forEach(mapping => {
      // make autoMoveToFolder false for folderMappings with no folder set
      if (typeof mapping.folder !== 'string' || mapping.folder === '') {
        mapping.moveToFolder = false;
      }
      if (typeof mapping.moveToFolder !== 'boolean') {
        mapping.moveToFolder = false;
      }
      if (typeof mapping.templateMode !== 'string' || (mapping.templateMode !== 'template' && mapping.templateMode !== 'script')) {
        mapping.templateMode = 'template';
      }
    });

    return this.folderFileClassMappings;
  }

  private makeFolderMappingDefaultFields(mapping: FolderFileClassMapping, mappingDiv: HTMLElement, index: number) {
    const mappingControl = mappingDiv.createEl('div', {cls: 'setting-item-control'});
    mappingControl.classList.add('metaflow-settings-mapping-control');

    // Control row
    const controlRow = mappingControl.createEl('div');
    controlRow.classList.add('metaflow-settings-mapping-control-row');

    // Order display (moved to left)
    const orderSpan = controlRow.createEl('span');
    orderSpan.textContent = `#${index + 1}`;
    orderSpan.classList.add('metaflow-settings-mapping-folder-order');

    // FileClass label
    controlRow.createEl('span', {text: `${mapping.fileClass}`, cls: 'metaflow-settings-mapping-fileclass-label', attr: {title: 'FileClass'}});

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

    // moveToFolder toggle
    const [moveToFolderToggle] = SettingsUtils.createCheckboxWithLabel(controlRow, {
      label: 'Auto-Move',
      labelClass: 'metaflow-settings-mapping-moveToFolder-label',
      labelTitle: 'Move files to this folder if they match this fileClass',
      checkboxClass: 'metaflow-settings-mapping-moveToFolder-checkbox',
      checked: mapping.moveToFolder || false
    });
    moveToFolderToggle.addEventListener('change', async () => {
      mapping.moveToFolder = moveToFolderToggle.checked;
      this.onChange();
    });
  }

  private displayNoteTitleTemplates(mappingDiv: HTMLElement, mapping: FolderFileClassMapping, mappingIndex: number): void {
    // Initialize properties if not exists
    if (!mapping.noteTitleTemplates) {
      mapping.noteTitleTemplates = [];
    }
    if (!mapping.noteTitleScript) {
      mapping.noteTitleScript = {script: 'return "";', enabled: true};
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

  private displayTemplateRows(container: HTMLElement, mapping: FolderFileClassMapping, mappingIndex: number): void {
    container.empty();

    // Toolbar
    const toolbar = container.createDiv({cls: 'metaflow-settings-template-toolbar'});

    // Help button
    const helpButton = toolbar.createEl('button', {text: '🛈 Help', cls: 'metaflow-settings-template-help-btn'});
    helpButton.addEventListener('click', async () => {
      // Import and open the modal
      const modal = new FileClassAvailableFieldsHelpModal(this.app, mapping.fileClass, this.metadataMenuAdapter, this.logNoticeManager);
      modal.open();
    });

    // Add button only for templates mode (script mode allows only one script)
    const addButton = toolbar.createEl('button', {text: '➕ Add note title template'});
    addButton.classList.add('metaflow-settings-note-title-template-add-btn');
    addButton.onclick = async () => {
      mapping.noteTitleTemplates.push({template: '', enabled: true});
      await this.onChange();
      this.displayNoteTitleTemplates(container.parentElement as HTMLElement, mapping, mappingIndex);
    };

    mapping.noteTitleTemplates.forEach((template: NoteTitleTemplate, templateIndex: number) => {
      const templateRow = container.createDiv({cls: 'metaflow-settings-template-row'});

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
      const [enabledToggle] = SettingsUtils.createCheckboxWithLabel(templateRow, {
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
    const [enabledTogglePreview] = SettingsUtils.createCheckboxWithLabel(
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
    const originalScript = script.script;

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
    let validationTimeout: number | null = null;
    const scriptElement = editDiv.querySelector('.ace_editor');
    if (scriptElement) {
      scriptElement.addEventListener('input', () => {
        if (validationTimeout) {
          clearTimeout(validationTimeout);
        }
        validationTimeout = window.setTimeout(validateScript, 500);
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
