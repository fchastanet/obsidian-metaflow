import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import MetaFlowPlugin from "..";
import {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import {TemplaterAdapter, TemplaterSettingsInterface} from "../externalApi/TemplaterAdapter";

/**
 * Settings tab for MetaFlow plugin
 * Provides configuration UI for folder mappings, property scripts, and integration settings
 */
export class MetaFlowSettingTab extends PluginSettingTab {
  plugin: MetaFlowPlugin;
  metadataMenuAdapter: MetadataMenuAdapter;
  templaterAdapter: TemplaterAdapter;
  EXPAND_BUTTON: string = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-chevrons-up-down"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>';

  constructor(app: App, plugin: MetaFlowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.metadataMenuAdapter = new MetadataMenuAdapter(app, plugin.settings);
    this.templaterAdapter = new TemplaterAdapter(app, plugin.settings);
  }

  display(): void {
    const {containerEl} = this;

    containerEl.empty();

    containerEl.createEl('h1', {text: 'MetaFlow Settings'});

    containerEl.createEl('p', {
      text: 'Configure automated metadata workflow management including folder mappings, property scripts, and plugin integrations.'
    });

    // General Settings - Collapsible
    const generalDetails = containerEl.createEl('details', {cls: 'setting-details'});
    generalDetails.open = false; // Collapsed by default
    const generalSummary = generalDetails.createEl('summary', {cls: 'setting-summary'});
    generalSummary.style.display = 'flex';
    generalSummary.style.alignItems = 'center';
    generalSummary.style.justifyContent = 'space-between';
    generalSummary.style.cursor = 'pointer';

    generalSummary.createEl('h3', {text: 'General Settings'});

    const generalToggleDiv = generalSummary.createEl('div', {cls: 'setting-item-control'});
    const generalToggleButton = generalToggleDiv.createEl('button', {cls: 'mod-cta'});
    generalToggleButton.innerHTML = this.EXPAND_BUTTON;

    // Prevent button click from triggering summary toggle
    generalToggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      generalDetails.open = !generalDetails.open;
    });

    // Sort unknown properties setting
    new Setting(generalDetails)
      .setName('Sort unknown properties alphabetically')
      .setDesc('Sort properties not in the custom order alphabetically at the end')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.sortUnknownPropertiesLast)
        .onChange(async (value) => {
          this.plugin.settings.sortUnknownPropertiesLast = value;
          await this.plugin.saveSettings();
        }));

    // MetadataMenu Integration section
    generalDetails.createEl('h4', {text: 'MetadataMenu Integration'});

    // Enable MetadataMenu integration
    new Setting(generalDetails)
      .setName('Enable MetadataMenu integration')
      .setDesc('Enable integration with the MetadataMenu plugin for fileClass-based field insertion')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.metadataMenuIntegration)
        .onChange(async (value) => {
          this.plugin.settings.metadataMenuIntegration = value;
          if (value) {
            if (!this.metadataMenuAdapter.isMetadataMenuAvailable()) {
              new Notice('MetadataMenu plugin not found or not enabled');
              this.plugin.settings.metadataMenuIntegration = false;
            }
          }
          await this.plugin.saveSettings();
        }));

    // Auto metadata insertion setting
    new Setting(generalDetails)
      .setName('Auto-insert missing metadata fields')
      .setDesc('Automatically insert missing metadata fields based on fileClass definitions')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAutoMetadataInsertion)
        .onChange(async (value) => {
          this.plugin.settings.enableAutoMetadataInsertion = value;
          await this.plugin.saveSettings();
        }));

    // Templater Integration
    generalDetails.createEl('h4', {text: 'Templater Integration'});

    new Setting(generalDetails)
      .setName('Enable Templater integration')
      .setDesc('Enable integration with Templater plugin for advanced scripting features')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableTemplaterIntegration)
        .onChange(async (value) => {
          this.plugin.settings.enableTemplaterIntegration = value;
          await this.plugin.saveSettings();
          // Check consistency when enabling
          if (value) {
            const consistency = await this.templaterAdapter.checkTemplaterConsistency();
            if (!consistency.isConsistent) {
              new Notice(`Templater consistency warnings: ${consistency.warnings.join(', ')}`);
            }
          }
        }));

    // Folder/FileClass Mappings - Collapsible
    const mappingsDetails = containerEl.createEl('details', {cls: 'setting-details'});
    mappingsDetails.open = false; // Collapsed by default
    const mappingsSummary = mappingsDetails.createEl('summary', {cls: 'setting-summary'});
    mappingsSummary.style.display = 'flex';
    mappingsSummary.style.alignItems = 'center';
    mappingsSummary.style.justifyContent = 'space-between';
    mappingsSummary.style.cursor = 'pointer';

    mappingsSummary.createEl('h3', {text: 'Folder/FileClass Mappings'});

    const mappingsToggleDiv = mappingsSummary.createEl('div', {cls: 'setting-item-control'});
    const mappingsToggleButton = mappingsToggleDiv.createEl('button', {cls: 'mod-cta'});
    mappingsToggleButton.innerHTML = this.EXPAND_BUTTON;

    // Prevent button click from triggering summary toggle
    mappingsToggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mappingsDetails.open = !mappingsDetails.open;
    });

    const mappingsDesc = mappingsDetails.createEl('p');
    mappingsDesc.innerHTML = 'Map folder patterns to MetadataMenu fileClasses. Uses the same pattern matching as Templater plugin. Patterns are evaluated in order, with the first match being used.';

    // Auto-populate from Templater button
    new Setting(mappingsDetails)
      .setName('Auto-populate from Templater')
      .setDesc('Automatically populate folder mappings from Templater plugin configuration')
      .addButton(button => button
        .setButtonText('🔃 Sync with Templater')
        .onClick(async () => {
          await this.syncFolderMappingsWithTemplater();
          this.displayFolderMappings(mappingsContainer);
        }));

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
            folderPattern: '',
            fileClass: '',
            isRegex: false
          });
          this.plugin.saveSettings();
          this.displayFolderMappings(mappingsContainer);
        }));

    // Property Default Value Scripts - Collapsible
    const scriptsDetails = containerEl.createEl('details', {cls: 'setting-details'});
    scriptsDetails.open = false; // Collapsed by default
    const scriptsSummary = scriptsDetails.createEl('summary', {cls: 'setting-summary'});
    scriptsSummary.style.display = 'flex';
    scriptsSummary.style.alignItems = 'center';
    scriptsSummary.style.justifyContent = 'space-between';
    scriptsSummary.style.cursor = 'pointer';

    scriptsSummary.createEl('h3', {text: 'Property Default Value Scripts'});

    const scriptsToggleDiv = scriptsSummary.createEl('div', {cls: 'setting-item-control'});
    const scriptsToggleButton = scriptsToggleDiv.createEl('button', {cls: 'mod-cta'});
    scriptsToggleButton.innerHTML = this.EXPAND_BUTTON;

    // Prevent button click from triggering summary toggle
    scriptsToggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      scriptsDetails.open = !scriptsDetails.open;
    });

    const scriptsDesc = scriptsDetails.createEl('p');
    scriptsDesc.innerHTML = 'Define JavaScript scripts to generate default values for properties. Scripts have access to: <code>fileClass</code>, <code>file</code>, <code>metadata</code>, <code>prompt</code>, <code>date</code>, <code>generateMarkdownLink</code>, <code>detectLanguage</code>.';

    // Auto-populate from MetadataMenu button
    new Setting(scriptsDetails)
      .setName('Auto-populate from MetadataMenu')
      .setDesc('Automatically populate property scripts from MetadataMenu plugin fileClass definitions')
      .addButton(button => button
        .setButtonText('📥 Import from MetadataMenu')
        .onClick(async () => {
          await this.autoPopulatePropertyScriptsFromMetadataMenu();
          this.displayPropertyScripts(scriptsContainer);
        }));

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

    // Add some help text
    containerEl.createEl('h3', {text: 'Usage'});
    containerEl.createEl('p', {text: 'Use the command palette to:'});
    const list = containerEl.createEl('ul');
    list.createEl('li', {text: 'Sort metadata properties - Sort current note'});
    list.createEl('li', {text: 'Sort metadata properties in all notes - Sort entire vault'});
    list.createEl('li', {text: 'Insert missing metadata fields - Add missing fields from fileClass'});
    list.createEl('li', {text: 'Sort and insert missing metadata - Combined operation'});
    list.createEl('li', {text: 'Auto Update metadata fields - Complete metadata processing with default values'});

    containerEl.createEl('p', {text: 'Properties will be sorted according to the order specified above. Unknown properties will be sorted alphabetically and placed at the end if the option is enabled.'});

    // MetadataMenu status
    if (this.metadataMenuAdapter.isMetadataMenuAvailable()) {
      containerEl.createEl('p', {text: '✅ MetadataMenu plugin is available and ready for integration.'});
    } else {
      containerEl.createEl('p', {text: '❌ MetadataMenu plugin not found. Install and enable it to use fileClass-based field insertion.'});
    }
  }

  private async syncFolderMappingsWithTemplater(): Promise<void> {
    try {
      const templaterPlugin = (this.app as any).plugins?.plugins?.['templater-obsidian'];
      if (!templaterPlugin) {
        new Notice('Templater plugin not found');
        return;
      }

      const templaterSettings = templaterPlugin.settings as TemplaterSettingsInterface;
      if (!templaterSettings?.file_templates) {
        new Notice('No file templates found in Templater settings');
        return;
      }

      let importedCount = 0;
      for (const fileTemplate of templaterSettings.file_templates) {
        // Check if mapping already exists
        const existingMapping = this.plugin.settings.folderFileClassMappings.find(
          mapping => mapping.folderPattern === fileTemplate.regex
        );

        if (!existingMapping) {
          this.plugin.settings.folderFileClassMappings.push({
            folderPattern: fileTemplate.regex,
            fileClass: '',
            isRegex: false
          });
          importedCount++;
        }
      }

      // Create a map of regex patterns to their index in templaterSettings.file_templates
      const templaterOrder = new Map();
      templaterSettings.file_templates.forEach((template, index) => {
        templaterOrder.set(template.regex, index);
      });

      // make order of folderFileClassMappings elements, the same as templaterSettings.file_templates
      this.plugin.settings.folderFileClassMappings.sort((a, b) => {
        const aIndex = templaterOrder.get(a.folderPattern);
        const bIndex = templaterOrder.get(b.folderPattern);

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

      const metadataMenuPlugin = (this.app as any).plugins?.plugins?.['metadata-menu'];
      if (!metadataMenuPlugin?.fieldIndex?.fileClassesAncestors) {
        new Notice('No fileClass definitions found in MetadataMenu');
        return;
      }

      //const fileClassesAncestors = metadataMenuPlugin.fieldIndex.fileClassesAncestors;
      const fileClassesFields = metadataMenuPlugin.fieldIndex.fileClassesFields;
      const allFields: {
        [fieldName: string]: {
          fileClasses: string[],
        }
      } = {};

      // Collect all properties and which fileClasses use them
      fileClassesFields.forEach(
        (fields: {name: string}[], fileClass: string) => {
          fields.forEach((field) => {
            if (!allFields[field.name]) {
              allFields[field.name] = {
                fileClasses: [],
              };
            }
            allFields[field.name].fileClasses.push(fileClass);
          });
        }
      );

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
            enabled: false, // Start disabled so user can configure
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
      const mappingDiv = container.createEl('div', {cls: 'setting-item'});

      // Add drag and drop functionality
      mappingDiv.draggable = true;
      mappingDiv.style.cursor = 'grab';
      mappingDiv.setAttribute('data-index', index.toString());

      // Add visual feedback for drag operations
      mappingDiv.addEventListener('dragstart', (e) => {
        mappingDiv.style.opacity = '0.5';
        mappingDiv.style.cursor = 'grabbing';
        e.dataTransfer?.setData('text/plain', index.toString());
      });

      mappingDiv.addEventListener('dragend', () => {
        mappingDiv.style.opacity = '1';
        mappingDiv.style.cursor = 'grab';
      });

      mappingDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        mappingDiv.style.borderTop = '2px solid var(--interactive-accent)';
      });

      mappingDiv.addEventListener('dragleave', () => {
        mappingDiv.style.borderTop = '';
      });

      mappingDiv.addEventListener('drop', async (e) => {
        e.preventDefault();
        mappingDiv.style.borderTop = '';

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
      mappingControl.style.justifyContent = 'space-between';

      // Order controls
      const orderDiv = mappingControl.createEl('div', {cls: 'setting-item-order'});
      orderDiv.style.display = 'flex';
      orderDiv.style.alignItems = 'center';
      orderDiv.style.marginBottom = '5px';

      const upButton = orderDiv.createEl('button', {text: '↑'});
      upButton.style.marginRight = '5px';
      upButton.disabled = index === 0;

      const downButton = orderDiv.createEl('button', {text: '↓'});
      downButton.style.marginRight = '10px';
      downButton.disabled = index === this.plugin.settings.folderFileClassMappings.length - 1;

      orderDiv.createEl('span', {text: `Order: ${index + 1}`});

      // Control row
      const controlRow = mappingControl.createEl('div');
      controlRow.style.display = 'flex';
      controlRow.style.alignItems = 'center';
      controlRow.style.gap = '10px';
      controlRow.style.flexGrow = '1';

      // Folder pattern input
      const patternInput = controlRow.createEl('input', {
        type: 'text',
        placeholder: 'Folder pattern (e.g., Books/*, .*)',
        value: mapping.folderPattern
      });
      patternInput.style.flexGrow = '1';

      // FileClass input
      const fileClassInput = controlRow.createEl('input', {
        type: 'text',
        placeholder: 'FileClass name',
        value: mapping.fileClass
      });
      fileClassInput.style.width = '150px';

      // Regex toggle
      const regexToggle = controlRow.createEl('input', {
        type: 'checkbox'
      });
      regexToggle.checked = mapping.isRegex || false;

      const regexLabel = controlRow.createEl('label', {text: 'Regex'});

      // Delete button
      const deleteButton = controlRow.createEl('button', {text: '🗑️ Delete'});
      deleteButton.style.backgroundColor = '#e74c3c';
      deleteButton.style.color = 'white';
      deleteButton.style.border = 'none';
      deleteButton.style.padding = '5px 10px';
      deleteButton.style.cursor = 'pointer';

      // Event listeners
      upButton.addEventListener('click', async () => {
        if (index > 0) {
          const temp = this.plugin.settings.folderFileClassMappings[index];
          this.plugin.settings.folderFileClassMappings[index] = this.plugin.settings.folderFileClassMappings[index - 1];
          this.plugin.settings.folderFileClassMappings[index - 1] = temp;
          await this.plugin.saveSettings();
          this.displayFolderMappings(container);
        }
      });

      downButton.addEventListener('click', async () => {
        if (index < this.plugin.settings.folderFileClassMappings.length - 1) {
          const temp = this.plugin.settings.folderFileClassMappings[index];
          this.plugin.settings.folderFileClassMappings[index] = this.plugin.settings.folderFileClassMappings[index + 1];
          this.plugin.settings.folderFileClassMappings[index + 1] = temp;
          await this.plugin.saveSettings();
          this.displayFolderMappings(container);
        }
      });

      patternInput.addEventListener('input', async () => {
        mapping.folderPattern = patternInput.value;
        await this.plugin.saveSettings();
      });

      fileClassInput.addEventListener('input', async () => {
        mapping.fileClass = fileClassInput.value;
        await this.plugin.saveSettings();
      });

      regexToggle.addEventListener('change', async () => {
        mapping.isRegex = regexToggle.checked;
        await this.plugin.saveSettings();
      });

      deleteButton.addEventListener('click', async () => {
        this.plugin.settings.folderFileClassMappings.splice(index, 1);
        await this.plugin.saveSettings();
        this.displayFolderMappings(container);
      });
    });
  }

  private displayPropertyScripts(container: HTMLElement): void {
    container.empty();

    this.plugin.settings.propertyDefaultValueScripts.forEach((script, index) => {
      const scriptDiv = container.createEl('div', {cls: 'setting-item'});
      scriptDiv.style.border = '1px solid #ccc';
      scriptDiv.style.padding = '10px';
      scriptDiv.style.marginBottom = '10px';

      // Add drag and drop functionality
      scriptDiv.draggable = true;
      scriptDiv.style.cursor = 'grab';
      scriptDiv.setAttribute('data-index', index.toString());

      // Add visual feedback for drag operations
      scriptDiv.addEventListener('dragstart', (e) => {
        scriptDiv.style.opacity = '0.5';
        scriptDiv.style.cursor = 'grabbing';
        e.dataTransfer?.setData('text/plain', index.toString());
      });

      scriptDiv.addEventListener('dragend', () => {
        scriptDiv.style.opacity = '1';
        scriptDiv.style.cursor = 'grab';
      });

      scriptDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        scriptDiv.style.borderTop = '3px solid var(--interactive-accent)';
      });

      scriptDiv.addEventListener('dragleave', () => {
        scriptDiv.style.borderTop = '1px solid #ccc';
      });

      scriptDiv.addEventListener('drop', async (e) => {
        e.preventDefault();
        scriptDiv.style.borderTop = '1px solid #ccc';

        const draggedIndex = parseInt(e.dataTransfer?.getData('text/plain') || '');
        const targetIndex = index;

        if (draggedIndex !== targetIndex && !isNaN(draggedIndex)) {
          // Reorder the array
          const draggedItem = this.plugin.settings.propertyDefaultValueScripts[draggedIndex];
          this.plugin.settings.propertyDefaultValueScripts.splice(draggedIndex, 1);
          this.plugin.settings.propertyDefaultValueScripts.splice(targetIndex, 0, draggedItem);

          await this.plugin.saveSettings();
          this.displayPropertyScripts(container);
        }
      });

      // Create read-only view
      const readOnlyDiv = scriptDiv.createEl('div', {cls: 'property-script-readonly'});
      readOnlyDiv.style.display = 'flex';
      readOnlyDiv.style.alignItems = 'center';
      readOnlyDiv.style.gap = '10px';
      readOnlyDiv.style.padding = '5px';
      readOnlyDiv.style.borderRadius = '3px';
      readOnlyDiv.style.width = '100%';

      // Order display (moved to left)
      const orderSpan = readOnlyDiv.createEl('span');
      orderSpan.textContent = `#${index + 1}`;
      orderSpan.style.color = 'var(--text-muted)';
      orderSpan.style.fontSize = '12px';
      orderSpan.style.minWidth = '30px';

      // Status indicator with tooltip
      const statusSpan = readOnlyDiv.createEl('span');
      statusSpan.textContent = script.enabled ? '✅' : '❌';
      statusSpan.style.fontSize = '14px';
      statusSpan.style.cursor = 'help';
      statusSpan.title = script.enabled ? 'Enabled' : 'Disabled';

      // Property name
      const propertySpan = readOnlyDiv.createEl('span');
      propertySpan.textContent = script.propertyName || 'Unnamed Property';
      propertySpan.style.fontWeight = 'bold';
      propertySpan.style.minWidth = '150px';

      // Script preview (extended to 100 characters)
      const scriptPreview = readOnlyDiv.createEl('span');
      const scriptPreviewText = script.script.replace(/\n/g, ' ').substring(0, 100);
      scriptPreview.textContent = scriptPreviewText + (script.script.length > 100 ? '...' : '');
      scriptPreview.style.color = 'var(--text-muted)';
      scriptPreview.style.fontFamily = 'monospace';
      scriptPreview.style.fontSize = '12px';
      scriptPreview.style.flexGrow = '1';

      // Enable/Disable button
      const toggleButton = readOnlyDiv.createEl('button', {
        text: script.enabled ? '⏸️ Disable' : '▶️ Enable'
      });
      toggleButton.style.backgroundColor = script.enabled ? '#f39c12' : '#27ae60';
      toggleButton.style.color = 'white';
      toggleButton.style.border = 'none';
      toggleButton.style.padding = '3px 8px';
      toggleButton.style.cursor = 'pointer';
      toggleButton.style.borderRadius = '3px';
      toggleButton.style.fontSize = '11px';
      toggleButton.style.marginRight = '5px';

      // Edit button (aligned to right)
      const editButton = readOnlyDiv.createEl('button', {text: '✏️ Edit'});
      editButton.style.backgroundColor = 'var(--interactive-accent)';
      editButton.style.color = 'white';
      editButton.style.border = 'none';
      editButton.style.padding = '3px 8px';
      editButton.style.cursor = 'pointer';
      editButton.style.borderRadius = '3px';
      editButton.style.fontSize = '11px';

      // Create edit view (hidden by default)
      const editDiv = scriptDiv.createEl('div', {cls: 'property-script-edit'});
      editDiv.style.display = 'none';
      editDiv.style.flexDirection = 'column';
      editDiv.style.gap = '10px';
      editDiv.style.width = '100%';

      // Store original values for cancel functionality
      let originalPropertyName = script.propertyName;
      let originalScript = script.script;
      let originalEnabled = script.enabled;

      // Property name input
      const propertyRow = editDiv.createEl('div');
      propertyRow.style.display = 'flex';
      propertyRow.style.alignItems = 'center';
      propertyRow.style.gap = '10px';

      propertyRow.createEl('label', {text: 'Property:'});
      const propertyInput = propertyRow.createEl('input', {
        type: 'text',
        placeholder: 'Property name (e.g., title, author)',
        value: script.propertyName
      });
      propertyInput.style.flexGrow = '1';

      // Enabled toggle
      const enabledLabel = propertyRow.createEl('label');
      const enabledToggle = enabledLabel.createEl('input', {type: 'checkbox'});
      enabledToggle.checked = script.enabled;
      enabledToggle.style.marginRight = '5px';
      enabledLabel.appendChild(document.createTextNode('Enabled'));

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
      const scriptTextarea = scriptRow.createEl('textarea', {
        placeholder: 'return "default value";',
      });
      scriptTextarea.value = script.script;
      scriptTextarea.style.width = '100%';
      scriptTextarea.style.height = '100px';
      scriptTextarea.style.marginTop = '5px';
      scriptTextarea.style.fontFamily = 'monospace';

      // Button row
      const buttonRow = editDiv.createEl('div');
      buttonRow.style.display = 'flex';
      buttonRow.style.gap = '10px';
      buttonRow.style.justifyContent = 'flex-end';

      // Delete button
      const deleteButton = buttonRow.createEl('button', {text: '🗑️ Delete'});
      deleteButton.style.backgroundColor = '#e74c3c';
      deleteButton.style.color = 'white';
      deleteButton.style.border = 'none';
      deleteButton.style.padding = '5px 15px';
      deleteButton.style.cursor = 'pointer';
      deleteButton.style.borderRadius = '3px';

      // Add a spacer
      const spacer = buttonRow.createDiv();
      spacer.style.flexGrow = '1';

      // OK button
      const okButton = buttonRow.createEl('button', {text: '✅ OK'});
      okButton.style.backgroundColor = 'var(--interactive-accent)';
      okButton.style.color = 'white';
      okButton.style.border = 'none';
      okButton.style.padding = '5px 15px';
      okButton.style.cursor = 'pointer';
      okButton.style.borderRadius = '3px';

      // Cancel button
      const cancelButton = buttonRow.createEl('button', {text: '❌ Cancel'});
      cancelButton.style.backgroundColor = 'var(--background-modifier-border)';
      cancelButton.style.color = 'var(--text-normal)';
      cancelButton.style.border = 'none';
      cancelButton.style.padding = '5px 15px';
      cancelButton.style.cursor = 'pointer';
      cancelButton.style.borderRadius = '3px';

      // Toggle between read-only and edit mode
      const toggleEditMode = (editMode: boolean) => {
        if (editMode) {
          readOnlyDiv.style.display = 'none';
          editDiv.style.display = 'flex';
          scriptDiv.draggable = false;
          scriptDiv.style.cursor = 'default';
          // Store current values as originals when entering edit mode
          originalPropertyName = script.propertyName;
          originalScript = script.script;
          originalEnabled = script.enabled;
        } else {
          readOnlyDiv.style.display = 'flex';
          editDiv.style.display = 'none';
          scriptDiv.draggable = true;
          scriptDiv.style.cursor = 'grab';
        }
      };

      // Event listeners
      toggleButton.addEventListener('click', async () => {
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
        script.script = scriptTextarea.value;
        script.enabled = enabledToggle.checked;
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
}
