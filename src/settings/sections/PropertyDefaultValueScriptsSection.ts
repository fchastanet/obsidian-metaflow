import {App, Notice, Setting} from "obsidian";
import {MetadataMenuAdapter} from "@metaflow/externalApi/MetadataMenuAdapter";
import {MetaFlowSettings, PropertyDefaultValueScript} from "@metaflow/settings/types";
import {SettingsUtils} from "@metaflow/settings/SettingsUtils";
import {ScriptEditor} from "@metaflow/settings/ScriptEditor";
import {DragDropHelper} from "@metaflow/settings/DragDropHelper";

export class PropertyDefaultValueScriptsSection {
  private metadataMenuImportButton: HTMLButtonElement | null = null;
  private dragDropHelper: DragDropHelper<PropertyDefaultValueScript>;

  constructor(
    private app: App,
    private container: HTMLElement,
    private settings: MetaFlowSettings,
    private metadataMenuAdapter: MetadataMenuAdapter,
    private onChange: () => void
  ) {
    // Initialize drag and drop helper
    this.dragDropHelper = new DragDropHelper<PropertyDefaultValueScript>({
      container: this.container,
      items: this.settings.propertyDefaultValueScripts,
      onReorder: this.onChange,
      refreshDisplay: () => {
        const scriptsContainer = this.container.querySelector('.scripts-container') as HTMLElement;
        if (scriptsContainer) {
          this.displayPropertyScripts(scriptsContainer);
        }
      },
      getOrder: (script) => script.order ?? Number.MAX_SAFE_INTEGER,
      setOrder: (script, order) => {script.order = order;}
    });
  }

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
    scriptsContainer.classList.add('scripts-container');
    this.displayPropertyScripts(scriptsContainer);
  }

  private getUniqueFileClasses(): string[] {
    const fileClasses: string[] = [];
    this.settings.propertyDefaultValueScripts.forEach(script => {
      if (script.fileClasses && script.fileClasses.length > 0) {
        fileClasses.push(...script.fileClasses);
      }
    });
    const uniqueFileClasses = Array.from(new Set(fileClasses)).sort((a, b) => a.localeCompare(b));
    return uniqueFileClasses;
  }

  private displayPropertyScripts(container: HTMLElement, selectedFileClass: string = '', searchValue: string = '', showScriptPreview: boolean = false): void {
    container.empty();

    const fileClasses: string[] = this.getUniqueFileClasses();

    const orderedProperties = this.settings.propertyDefaultValueScripts
      .slice()
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
      .filter(script => {
        if (!selectedFileClass) return true;
        return script.fileClasses?.includes(selectedFileClass) ?? false;
      })
      .filter(script => {
        if (!searchValue) return true;
        return script.propertyName?.toLowerCase().includes(searchValue.toLowerCase()) ?? false;
      });


    // Filters (by fileClass and search input)
    let selectedFileClassValue = selectedFileClass;
    let searchInputValue = searchValue;

    const filterSection = new Setting(container)
      .setName('Filter property scripts')
      .setDesc(`Filtering property scripts by fileClass or search by property name`)
      .setClass('metaflow-settings-filter-section')
    ;
    filterSection.controlEl.enterKeyHint = 'search';
    filterSection.controlEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.displayPropertyScripts(container, selectedFileClassValue, searchInputValue, showScriptPreview);
      }
    });
    filterSection.controlEl.classList.add('metaflow-settings-filter-section-controls');
    const filterSectionControlsRow1 = filterSection.controlEl.createEl('div', {cls: 'metaflow-settings-row'});
    new Setting(filterSectionControlsRow1)
      .setClass('metaflow-settings-component')
      .setName('Show script preview')
      .addToggle(toggle => toggle
        .setValue(!!showScriptPreview)
        .onChange((value) => {
          showScriptPreview = value;
          this.displayPropertyScripts(container, selectedFileClassValue, searchInputValue, showScriptPreview);
        })
      )
    ;
    new Setting(filterSectionControlsRow1)
      .setClass('metaflow-settings-component')
      .setName('Filter by fileClass')
      .addDropdown((dropdown) => {
        if (fileClasses.length > 0) {
          dropdown.addOption('', 'All');
          fileClasses.forEach(fileClass => {
            dropdown.addOption(fileClass, fileClass);
          });
          dropdown.setValue(selectedFileClass);
        }
        dropdown.onChange((newFileClass) => {
          selectedFileClassValue = newFileClass;
        });
      })
    ;
    new Setting(filterSectionControlsRow1)
      .setClass('metaflow-settings-component')
      .addSearch((searchInput) => {
        searchInput
          .setPlaceholder('Search property name...')
          .setValue(searchValue)
          .onChange((searchValue) => {
            searchInputValue = searchValue;
          })
        ;
        searchInput.inputEl.classList.add('metaflow-settings-search-input');
      })
    ;

    const filterSectionControlsRow2 = filterSection.controlEl.createEl('div', {
      cls: 'metaflow-settings-row metaflow-settings-row-right'
    });
    filterSectionControlsRow2.createEl('div',
      {
        text: `Filtered ${orderedProperties.length}/${this.settings.propertyDefaultValueScripts.length}`,
        cls: 'metaflow-settings-component'
      }
    );
    new Setting(filterSectionControlsRow2)
      .setClass('metaflow-settings-component')
      .addButton(button => {
        button
          .setButtonText('Search')
          .onClick(() => {
            this.displayPropertyScripts(container, selectedFileClassValue, searchInputValue, showScriptPreview);
          });
      })
    new Setting(filterSectionControlsRow2)
      .setClass('metaflow-settings-component')
      .addButton(button => {
        button.setButtonText('Clear Filters')
          .onClick(() => {
            this.displayPropertyScripts(container, '', '', showScriptPreview);
          });
      });

    // Display scripts in order, filtered by fileClass if applicable
    orderedProperties.forEach((script, index) => {
      const scriptDiv = container.createEl('div', {cls: 'setting-item'});
      scriptDiv.classList.add('metaflow-settings-script');

      // Add drag and drop functionality using helper
      this.dragDropHelper.makeDraggable(scriptDiv, index);

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

      // Add a spacer
      const spacer = readOnlyDiv.createDiv();
      spacer.classList.add('metaflow-settings-script-btn-spacer');

      // Enabled toggle
      const [, enabledLabelPreview] = SettingsUtils.createCheckboxWithLabel(
        readOnlyDiv, {
        labelClass: 'metaflow-settings-script-enabled-label',
        labelTitle: 'Allows this script to run',
        checkboxClass: 'metaflow-settings-script-enabled-toggle',
        label: 'Enabled',
        checked: script.enabled,
      }
      );

      // Delete button
      const deleteButton = readOnlyDiv.createEl('button', {text: '🗑️ Delete'});
      deleteButton.classList.add('metaflow-settings-script-delete-btn');

      // Edit button (aligned to right)
      const editButton = readOnlyDiv.createEl('button', {text: '✏️ Edit'});
      editButton.classList.add('metaflow-settings-script-edit-btn');

      // Script preview (extended to 100 characters)
      if (showScriptPreview) {
        // Script preview (extended to 100 characters)
        const scriptPreview = scriptDiv.createEl('span');
        const scriptPreviewText = script.script.replace(/\n/g, ' ').substring(0, 100);
        scriptPreview.textContent = scriptPreviewText + (script.script.length > 100 ? '...' : '');
        scriptPreview.classList.add('metaflow-settings-script-preview');

        // Create edit view (hidden by default)
        const editDiv = scriptDiv.createEl('div', {cls: 'property-script-edit'});
        editDiv.classList.add('metaflow-settings-script-edit');
        editDiv.classList.add('metaflow-settings-hide');

        // Store original values for cancel functionality
        const originalPropertyName = script.propertyName;
        const originalScript = script.script;
        const originalEnabled = script.enabled;

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

        const [enabledToggle,] = SettingsUtils.createCheckboxWithLabel(
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
          new mod.CompletionsHelpModal(this.app, scriptEditor.getCompletions()).open();
        });

        // Create script editor
        const scriptEditor = new ScriptEditor(this.app, this.metadataMenuAdapter, {
          enableDateFunctions: true,
          enablePromptFunction: true
        });

        scriptEditor.createEditor(scriptRow, 'return "default value";', script.script);
        // Button row
        const buttonRow = editDiv.createEl('div');
        buttonRow.classList.add('metaflow-settings-script-btn-row');

        // Add a spacer
        const spacer2 = buttonRow.createDiv();
        spacer2.classList.add('metaflow-settings-script-btn-spacer');

        // OK button
        const okButton = buttonRow.createEl('button', {text: '✅ OK'});
        okButton.classList.add('metaflow-settings-script-ok-btn');

        // Cancel button
        const cancelButton = buttonRow.createEl('button', {text: '❌ Cancel'});
        cancelButton.classList.add('metaflow-settings-script-cancel-btn');

        // Toggle between read-only and edit mode
        const toggleEditMode = (editMode: boolean) => {
          if (editMode) {
            scriptPreview.classList.add('metaflow-settings-hide');
            readOnlyDiv.classList.add('metaflow-settings-hide');
            editDiv.classList.remove('metaflow-settings-hide');
            this.dragDropHelper.makeNonDraggable(scriptDiv);
          } else {
            scriptPreview.classList.remove('metaflow-settings-hide');
            readOnlyDiv.classList.remove('metaflow-settings-hide');
            editDiv.classList.add('metaflow-settings-hide');
            this.dragDropHelper.makeDraggable(scriptDiv, index);
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
          script.script = scriptEditor.getValue();
          await this.onChange();
          scriptEditor.destroy();
          this.displayPropertyScripts(container);
        });

        cancelButton.addEventListener('click', () => {
          // Revert changes
          script.propertyName = originalPropertyName;
          script.script = originalScript;
          script.enabled = originalEnabled;
          propertyInput.value = originalPropertyName;
          scriptEditor.setValue(originalScript);
          enabledToggle.checked = originalEnabled;
          toggleEditMode(false);
        });
      }

      deleteButton.addEventListener('click', async () => {
        // Find the correct index in the original array
        const originalIdx = this.settings.propertyDefaultValueScripts.indexOf(script);
        if (originalIdx !== -1) {
          this.settings.propertyDefaultValueScripts.splice(originalIdx, 1);
          await this.onChange();
          this.displayPropertyScripts(container);
        }
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
            fileClasses: fileClasses.sort((a, b) => a.localeCompare(b)) // Sort fileClasses for consistency
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
