import {App, Notice, Setting} from "obsidian";
import {MetadataMenuAdapter} from "../../externalApi/MetadataMenuAdapter";
import {MetaFlowSettings, PropertyDefaultValueScript} from "../types";
import {SettingsUtils} from "../SettingsUtils";

declare type AceModule = typeof import("ace-builds");
import * as Ace from "ace-builds";
declare const ace: AceModule;

export class PropertyDefaultValueScriptsSection {
  private metadataMenuImportButton: HTMLButtonElement | null = null;

  constructor(
    private app: App,
    private container: HTMLElement,
    private settings: MetaFlowSettings,
    private metadataMenuAdapter: MetadataMenuAdapter,
    private onChange: () => void
  ) { }

  render() {
    this.container.empty();

    // Auto-populate from MetadataMenu button
    const metadataMenuImportSetting = new Setting(this.container)
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
    const scriptsContainer = this.container.createEl('div');
    this.displayPropertyScripts(scriptsContainer);

    // Add new script button
    new Setting(this.container)
      .setName('Add property script')
      .addButton(button => button
        .setButtonText('➕ Add property script')
        .setCta()
        .onClick(() => {
          this.settings.propertyDefaultValueScripts.push({
            propertyName: '',
            script: 'return "";',
            enabled: true,
            order: this.settings.propertyDefaultValueScripts.length
          });
          this.onChange();
          this.displayPropertyScripts(scriptsContainer);
        }));
  }

  private displayPropertyScripts(container: HTMLElement): void {
    container.empty();
    const orderedProperties = this.settings.propertyDefaultValueScripts
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

          await this.onChange();
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
      const [enabledTogglePreview, enabledLabelPreview] = SettingsUtils.createCheckboxWithLabel(
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

      const [enabledToggle, enabledLabel] = SettingsUtils.createCheckboxWithLabel(
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
        const mod = await import('../modals/CompletionsHelpModal');
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
      if (this.metadataMenuAdapter.isMetadataMenuAvailable()) {
        this.metadataMenuAdapter.getAllFields().forEach(field => {
          metadataCompletions.push({
            value: field.name,
            score: 1,
            meta: `Metadata`,
            docHTML: `Metadata field: ${field.name}.<br>Type: ${field.type}.<br>Description: ${field?.tooltip || 'No description available.'}`,
          });
        });
      }

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
        await this.onChange();
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
        await this.onChange();
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
        this.settings.propertyDefaultValueScripts.splice(index, 1);
        await this.onChange();
        this.displayPropertyScripts(container);
      });
    });
  }

  private updateMetadataMenuButtonState(): void {
    if (!this.metadataMenuImportButton) return;

    const isMetadataMenuAvailable = this.metadataMenuAdapter.isMetadataMenuAvailable();

    this.metadataMenuImportButton.disabled = !isMetadataMenuAvailable;
    if (!isMetadataMenuAvailable) {
      this.metadataMenuImportButton.title = 'MetadataMenu plugin is not available or not enabled';
    } else {
      this.metadataMenuImportButton.title = 'Import property scripts from MetadataMenu plugin';
    }
  }


  private autoPopulatePropertyScriptsFromMetadataMenu() {
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
        const existingScript = this.settings.propertyDefaultValueScripts.find(
          script => script.propertyName === propertyName
        );

        if (!existingScript) {
          const defaultScript = `return "";`;

          this.settings.propertyDefaultValueScripts.push({
            propertyName: propertyName,
            script: defaultScript,
            enabled: true,
            order: this.settings.propertyDefaultValueScripts.length,
            fileClasses,
          });
          importedCount++;
        } else {
          existingScript.fileClasses = fileClasses;
        }
      }

      this.onChange();
      new Notice(`Imported ${importedCount} property scripts from MetadataMenu`);

    } catch (error) {
      console.error('Error importing from MetadataMenu:', error);
      new Notice('Error importing property scripts from MetadataMenu');
    }
  }

}