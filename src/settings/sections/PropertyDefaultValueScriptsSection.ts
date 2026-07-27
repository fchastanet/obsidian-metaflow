import {App, Setting} from "obsidian";
import {MetadataMenuAdapter} from "@metaflow/externalApi/MetadataMenuAdapter";
import {SettingsUtils} from "@metaflow/settings/SettingsUtils";
import {ScriptEditor} from "@metaflow/settings/ScriptEditor";
import {ConfirmModal} from "../modals/ConfirmModal";
import MetaFlowPlugin from "@metaflow/main";

type Options =  {
  selectedFileClass: string;
  searchValue: string;
  showScriptDetails: boolean;
  currentSelectedScriptIndex?: number;
  importResultMessage: string;
  importResultLevel: 'info' | 'warning' | 'error';
};

const defaultOptions: Options = {
  selectedFileClass: '',
  searchValue: '',
  showScriptDetails: true,
  currentSelectedScriptIndex: undefined,
  importResultMessage: '',
  importResultLevel: 'info'
};

export class PropertyDefaultValueScriptsSection {
  private metadataMenuImportButton: HTMLButtonElement | null = null;
  private eventListeners: { element: HTMLElement, event: string, listener: EventListenerOrEventListenerObject }[] = [];

  constructor(
    private app: App,
    private container: HTMLElement,
    private plugin: MetaFlowPlugin,
    private metadataMenuAdapter: MetadataMenuAdapter,
    private onChange: () => void
  ) {
  }

  private clearEventListeners(): void {
    for (const {element, event, listener} of this.eventListeners) {
      element.removeEventListener(event, listener);
    }
    this.eventListeners = [];
  }

  private async changeSettings(options: Options): Promise<void> {
    this.clearEventListeners();
    await this.onChange();
    this.displayPropertyScripts(this.container.getElementsByClassName('scripts-container')[0] as HTMLElement, options);
  }

  render() {
    this.container.empty();

    // Auto-populate from MetadataMenu button
    const metadataMenuImportSetting = new Setting(this.container)
      .setName('Auto-populate from MetadataMenu')
      .setDesc('Automatically populate property scripts from MetadataMenu plugin fileClass definitions');

    const importResultMessage = this.container.createEl('div', {
      text: '',
      cls: 'metaflow-settings-content metaflow-settings-import-result-message'
    });
    metadataMenuImportSetting.addButton(button => {
      this.metadataMenuImportButton = button.buttonEl;
      button
        .setButtonText('📥 Import from MetadataMenu')
        .onClick(async () => {
          const {msg, level} = await this.autoPopulatePropertyScriptsFromMetadataMenu();
          importResultMessage.setHTMLUnsafe(msg);
          importResultMessage.removeClass('metaflow-settings-import-result-info');
          importResultMessage.removeClass('metaflow-settings-import-result-warning');
          importResultMessage.removeClass('metaflow-settings-import-result-error');
          importResultMessage.addClass(`metaflow-settings-import-result-${level}`);
          this.displayPropertyScripts(this.container.querySelector('.scripts-container') as HTMLElement);
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
    this.plugin.settings.propertyDefaultValueScripts.forEach(script => {
      if (script.fileClasses && script.fileClasses.length > 0) {
        fileClasses.push(...script.fileClasses);
      }
    });
    const uniqueFileClasses = Array.from(new Set(fileClasses)).sort((a, b) => a.localeCompare(b));
    return uniqueFileClasses;
  }

  /**
   * If fileClasses is undefined or empty
   *    returns a message indicating that the property script is not used by any fileClasses.
   * If all available fileClasses are associated with the property script
   *    returns a message indicating that the property script is used by all fileClasses.
   * if most of the available fileClasses are associated with the property script
   *   returns a message indicating that the property script is used by all fileClasses except a few.
   * Otherwise, returns a message listing the specific fileClasses associated with the property script.
   * @param {string[] | undefined} fileClasses The list of file classes associated with the property script
   * @param {string[]} allFileClasses The list of all available file classes
   * @returns A formatted HTML string previewing the file classes
   */
  private getClassListPreview(fileClasses: string[] | undefined, allFileClasses: string[]): string {
    if (!fileClasses || fileClasses.length === 0) {
      return '<b>Not used by any fileClasses</b>';
    }
    if (fileClasses.length === allFileClasses.length) {
      return '<span class="metaflow-settings-script-class-list-used">Used by all fileClasses</span>';
    }
    if (fileClasses.length > allFileClasses.length / 2) {
      const exceptClasses = allFileClasses.filter(fc => !fileClasses.includes(fc));
      // each fileClass is wrapped in a span with class metaflow-settings-script-class-list-except
      return `Used by <span class="metaflow-settings-script-class-list-used">all</span> fileClasses except: ${exceptClasses.map(fc => `<span class="metaflow-settings-script-class-list-except">${fc}</span>`).join(', ')}`;
    }
    return `Used by fileClasses: ${fileClasses.map(fc => `<span class="metaflow-settings-script-class-list-used">${fc}</span>`).join(', ')}`;
  }

  private isFiltered(options: Options): boolean {
    return !!options.selectedFileClass || !!options.searchValue;
  }

  private displayPropertyScripts(
    container: HTMLElement,
    options: Options = defaultOptions
  ): void {
    const parent = container.parentElement;
    if (!parent) {
      throw new Error('Container has no parent element'); // should never happen
    }
    parent.removeChild(container);
    container.empty();

    const fileClasses: string[] = this.getUniqueFileClasses();

    const orderedProperties = this.plugin.settings.propertyDefaultValueScripts
      .slice()
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
      .filter(script => {
        if (!options.selectedFileClass) return true;
        return script.fileClasses?.includes(options.selectedFileClass) ?? false;
      })
      .filter(script => {
        if (!options.searchValue) return true;
        return script.propertyName?.toLowerCase().includes(options.searchValue.toLowerCase()) ?? false;
      });


    // Filters (by fileClass and search input)
    const filterSection = new Setting(container)
      .setName('Filter property scripts')
      .setDesc(`Filtering property scripts by fileClass or search by property name`)
      .setClass('metaflow-settings-filter-section')
    ;
    filterSection.controlEl.enterKeyHint = 'search';
    filterSection.controlEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.displayPropertyScripts(container, options);
      }
    });
    filterSection.controlEl.classList.add('metaflow-settings-filter-section-controls');
    const filterSectionControlsRow1 = filterSection.controlEl.createEl('div', {cls: 'metaflow-settings-row'});
    new Setting(filterSectionControlsRow1)
      .setClass('metaflow-settings-component')
      .setName('Show script details')
      .addToggle(toggle => toggle
        .setValue(!!options.showScriptDetails)
        .onChange((value) => {
          options.showScriptDetails = value;
          container.querySelectorAll('.metaflow-settings-script-preview').forEach(preview => {
            if (value) {
              preview.classList.remove('metaflow-settings-hide');
            } else {
              preview.classList.add('metaflow-settings-hide');
            }
          });
          container.querySelectorAll('.metaflow-settings-script-class-list').forEach(preview => {
            if (value) {
              preview.classList.remove('metaflow-settings-hide');
            } else {
              preview.classList.add('metaflow-settings-hide');
            }
          });
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
          dropdown.setValue(options.selectedFileClass);
        }
        dropdown.onChange((newFileClass) => {
          options.selectedFileClass = newFileClass;
        });
      })
    ;
    new Setting(filterSectionControlsRow1)
      .setClass('metaflow-settings-component')
      .addSearch((searchInput) => {
        searchInput
          .setPlaceholder('Search property name...')
          .setValue(options.searchValue)
          .onChange((searchValue) => {
            options.searchValue = searchValue;
          })
        ;
        searchInput.inputEl.classList.add('metaflow-settings-search-input');
      })
    ;

    const filterSectionControlsRow2 = filterSection.controlEl.createEl('div', {
      cls: 'metaflow-settings-row metaflow-settings-row-right'
    });
    const msg = this.isFiltered(options) ?
      `Order disabled - Filtered ${orderedProperties.length}/${this.plugin.settings.propertyDefaultValueScripts.length}` :
      `Total ${orderedProperties.length}`;
    filterSectionControlsRow2.createEl('div',
      {
        text: msg,
        cls: 'metaflow-settings-component'
      }
    );
    new Setting(filterSectionControlsRow2)
      .setClass('metaflow-settings-component')
      .addButton(button => {
        button
          .setButtonText('Filter')
          .onClick(() => {
            this.displayPropertyScripts(container, options);
          });
      })
    ;
    new Setting(filterSectionControlsRow2)
      .setClass('metaflow-settings-component')
      .addButton(button => {
        button.setButtonText('Clear Filters')
          .onClick(() => {
            options.selectedFileClass = '';
            options.searchValue = '';
            this.displayPropertyScripts(container, options);
          });
      });

    // Display scripts in order, filtered by fileClass if applicable
    let scriptDivToScrollIntoView: HTMLDivElement | null = null;
    orderedProperties.forEach((script, index) => {
      const scriptDiv = container.createEl('div', {cls: 'setting-item'});
      scriptDiv.classList.add('metaflow-settings-script');
      if (script.new) {
        scriptDiv.classList.add('metaflow-settings-script-new');
      }
      if (options.currentSelectedScriptIndex !== undefined && options.currentSelectedScriptIndex === index) {
        scriptDiv.classList.add('metaflow-settings-script-selected');
        scriptDivToScrollIntoView = scriptDiv;
      }

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

      // order buttons (up and down) for reordering scripts, only if not filtered
      if (!this.isFiltered(options)) {
        // Up button for reordering
        const upButton = readOnlyDiv.createEl('button', {
          text: 'V',
          cls: 'metaflow-settings-up-btn',
          title: 'Move up',
          attr: {
            'disabled': index === 0 ? 'true' : null
          }
        });
        const upButtonListener = async () => {
          this.orderButtonListener(upButton, index, orderedProperties, scriptDiv, container, options, false);
        };
        upButton.addEventListener('click', upButtonListener);
        this.eventListeners.push({element: upButton, event: 'click', listener: upButtonListener});

        // Down button for reordering
        const downButton = readOnlyDiv.createEl(
          'button', {
            text: 'V',
            cls: 'metaflow-settings-down-btn',
            title: 'Move down',
            attr: {
              'disabled': index === orderedProperties.length - 1 ? 'true' : null
            }
          }
        );
        const downButtonListener = async () => {
          this.orderButtonListener(downButton, index, orderedProperties, scriptDiv, container, options, true);
        }
        downButton.addEventListener('click', downButtonListener);
        this.eventListeners.push({element: downButton, event: 'click', listener: downButtonListener});
      }

      // Script preview (extended to 100 characters)
      const classListPreview = scriptDiv.createEl('span', {cls: 'metaflow-settings-script-class-list'});
      classListPreview.innerHTML = this.getClassListPreview(script.fileClasses, fileClasses);

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

      // Script edit section
      const scriptRow = editDiv.createEl('div');
      const classListPreviewEditMode = scriptRow.createEl('span', {cls: 'metaflow-settings-script-class-list metaflow-settings-hide'});
      classListPreviewEditMode.innerHTML = this.getClassListPreview(script.fileClasses, fileClasses);

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
          classListPreviewEditMode.classList.remove('metaflow-settings-hide');
          classListPreview.classList.add('metaflow-settings-hide');
          scriptPreview.classList.add('metaflow-settings-hide');
          readOnlyDiv.classList.add('metaflow-settings-hide');
          editDiv.classList.remove('metaflow-settings-hide');
        } else {
          if (options.showScriptDetails) {
            classListPreview.classList.remove('metaflow-settings-hide');
            scriptPreview.classList.remove('metaflow-settings-hide');
          }
          classListPreviewEditMode.classList.add('metaflow-settings-hide');
          readOnlyDiv.classList.remove('metaflow-settings-hide');
          editDiv.classList.add('metaflow-settings-hide');
        }
      };

      // Event listeners
      enabledLabelPreview.addEventListener('click', async (event) => {
        event.preventDefault();
        script.enabled = !script.enabled;
        script.new = false; // Mark as not new when toggled
        await this.changeSettings(options);
        this.displayPropertyScripts(container, options);
      });

      editButton.addEventListener('click', () => {
        toggleEditMode(true);
      });

      okButton.addEventListener('click', async () => {
        // Apply changes
        script.propertyName = propertyInput.value;
        script.enabled = enabledToggle.checked;
        script.script = scriptEditor.getValue();
        script.new = false; // Mark as not new when edited
        await this.changeSettings(options);
        scriptEditor.destroy();
        this.displayPropertyScripts(container, options);
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

      deleteButton.addEventListener('click', async () => {
        // Find the correct index in the original array
        const originalIdx = this.plugin.settings.propertyDefaultValueScripts.indexOf(script);
        if (originalIdx !== -1) {
          new ConfirmModal(
              this.app,
              "Are you sure you want to delete this script? This cannot be undone.",
              async () => {
                this.plugin.settings.propertyDefaultValueScripts.splice(originalIdx, 1);
                options.currentSelectedScriptIndex = undefined; // Reset the selected script index
                await this.changeSettings(options);
                this.displayPropertyScripts(container, options);
              },
              () => {
                  console.info("User cancelled the deletion of the script.");
              }
          ).open();
        }
      });
    });
    parent.appendChild(container);
    if (scriptDivToScrollIntoView) {
      (scriptDivToScrollIntoView as HTMLElement).scrollIntoView({behavior: 'smooth', block: 'center'});
    }
  }

  private removeSelectedScriptScript(container: HTMLElement): void {
    const allScriptDivs = container.querySelectorAll('.metaflow-settings-script-selected');
    allScriptDivs.forEach(div => div.classList.remove('metaflow-settings-script-selected'));
  }

  private async orderButtonListener(
    button: HTMLButtonElement,
    index: number,
    orderedProperties: typeof this.plugin.settings.propertyDefaultValueScripts,
    scriptDiv: HTMLDivElement,
    container: HTMLElement,
    options: Options,
    moveDown: boolean
  ): Promise<void> {
    this.removeSelectedScriptScript(container);
    const script = orderedProperties[index];
    const isSortable = moveDown ? index < orderedProperties.length : index > 0;
    if (isSortable) {
      const nextScript = moveDown ? orderedProperties[index + 1] : orderedProperties[index - 1];
      const nextDivPosition = moveDown ? scriptDiv.nextSibling?.nextSibling : scriptDiv.previousSibling;
      const currentOrder = script.order ?? Number.MAX_SAFE_INTEGER;
      const nextOrder = nextScript.order ?? Number.MAX_SAFE_INTEGER;
      script.order = nextOrder;
      nextScript.order = currentOrder;
      options.currentSelectedScriptIndex = moveDown ? index + 1 : index - 1; // Update the selected script index to the new position
      await this.onChange();
      // move the div to the new position in the DOM
      scriptDiv.parentNode?.insertBefore(scriptDiv, nextDivPosition || null);
      scriptDiv.scrollIntoView({behavior: 'smooth', block: 'center'});
      scriptDiv.classList.add('metaflow-settings-script-selected');
      // Refresh the display to update the order numbers and button states
      this.updateScriptOrderDisplay(container);
      this.updateScriptButtonStates(container, orderedProperties);
    }
  }

  private updateScriptOrderDisplay(container: HTMLElement): void {
    const scriptDivs = container.querySelectorAll('.metaflow-settings-script');
    scriptDivs.forEach((scriptDiv, index) => {
      const orderSpan = scriptDiv.querySelector('.metaflow-settings-script-order');
      if (orderSpan) {
        orderSpan.textContent = `#${index + 1}`;
      }
      const itemOrder = scriptDiv.querySelector('.setting-item-order span');
      if (itemOrder) {
        itemOrder.textContent = `Order: ${index + 1}`;
      }
    });
  }

  private updateScriptButtonStates(container: HTMLElement, orderedProperties: typeof this.plugin.settings.propertyDefaultValueScripts): void {
    const scriptDivs = container.querySelectorAll('.metaflow-settings-script');
    scriptDivs.forEach((scriptDiv, index) => {
      const downButton = scriptDiv.querySelector('.metaflow-settings-down-btn') as HTMLButtonElement;
      const upButton = scriptDiv.querySelector('.metaflow-settings-up-btn') as HTMLButtonElement;
      if (downButton) {
        downButton.disabled = index === orderedProperties.length - 1;
      }
      if (upButton) {
        upButton.disabled = index === 0;
      }
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

  private autoPopulatePropertyScriptsFromMetadataMenu(): {msg: string, level: 'info' | 'warning' | 'error'} {
    try {
      if (!this.metadataMenuAdapter.isMetadataMenuAvailable()) {
        return {msg: 'MetadataMenu plugin not available', level: 'error'};
      }

      const allFields = this.metadataMenuAdapter.getAllFieldsFileClassesAssociation();

      let importedCount = 0;
      let updatedCount = 0;
      for (const [propertyName, fieldData] of Object.entries(allFields)) {
        const {fileClasses} = fieldData;
        // Check if script already exists
        const existingScript = this.plugin.settings.propertyDefaultValueScripts.find(
          script => script.propertyName === propertyName
        );

        const newFileClasses = fileClasses.sort((a, b) => a.localeCompare(b)); // Sort fileClasses for consistency
        if (!existingScript) {
          const defaultScript = `return "";`;

          this.plugin.settings.propertyDefaultValueScripts.push({
            propertyName: propertyName,
            script: defaultScript,
            enabled: false,
            new: true,
            order: this.plugin.settings.propertyDefaultValueScripts.length,
            fileClasses: newFileClasses
          });
          importedCount++;
        } else if (JSON.stringify(existingScript.fileClasses) !== JSON.stringify(newFileClasses)) {
          existingScript.fileClasses = newFileClasses;
          existingScript.new = false; // Mark as not new when updated
          updatedCount++;
        }
      }

      // mark all scripts that are not in MetadataMenu as disabled and remove their fileClasses association
      const removedProperties: string[] = [];
      this.plugin.settings.propertyDefaultValueScripts.forEach(script => {
        if (!allFields[script.propertyName]) {
          script.enabled = false;
          script.fileClasses = [];
          removedProperties.push(script.propertyName);
        }
      });

      this.changeSettings(defaultOptions); // Refresh the display after import
      let msg = `Imported ${importedCount} property scripts from MetadataMenu`;
      if (updatedCount > 0) {
        msg += `<br>Updated ${updatedCount} property scripts with new fileClasses`;
      }
      if (removedProperties.length > 0) {
        msg += `<br>Disabled ${removedProperties.length} properties that were not found in MetadataMenu: ${removedProperties.join(', ')}`;
      }
      return {msg, level: 'info'};
    } catch (error) {
      console.error('Error importing from MetadataMenu:', error);
      return {msg: 'Error importing property scripts from MetadataMenu', level: 'error'};
    }
  }

}
