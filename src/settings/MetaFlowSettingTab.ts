import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import MetaFlowPlugin from "..";
import {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import {TemplaterAdapter, TemplaterSettingsInterface} from "../externalApi/TemplaterAdapter";
import {MetaFlowService} from "../services/MetaFlowService";
import {FrontmatterParseResult, FrontMatterService} from "../services/FrontMatterService";

/**
 * Settings tab for MetaFlow plugin
 * Provides configuration UI for folder mappings, property scripts, and integration settings
 */
export class MetaFlowSettingTab extends PluginSettingTab {
  plugin: MetaFlowPlugin;
  metadataMenuAdapter: MetadataMenuAdapter;
  templaterAdapter: TemplaterAdapter;
  simulationDetails: HTMLDetailsElement;
  simulationContainer: HTMLElement;
  metadataMenuStatus: HTMLElement;
  templaterStatus: HTMLElement;
  metadataMenuImportButton: HTMLButtonElement;
  templaterImportButton: HTMLButtonElement;
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

    // Auto-sort on view setting
    new Setting(generalDetails)
      .setName('Sort metadata properties on insert')
      .setDesc('Automatically sort metadata properties when updating metadata')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSort)
        .onChange(async (value) => {
          this.plugin.settings.autoSort = value;
          await this.plugin.saveSettings();
        }));

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

    // Hide properties section setting
    new Setting(generalDetails)
      .setName('Hide properties section in editor')
      .setDesc('Hide the properties section from the file editor view for a cleaner writing experience')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.hidePropertiesInEditor || false)
        .onChange(async (value) => {
          this.plugin.settings.hidePropertiesInEditor = value;
          await this.plugin.saveSettings();
          // Apply CSS to hide/show properties section immediately
          this.togglePropertiesVisibility(value);
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
          this.displaySimulationSection();
          // Update button states when integration setting changes
          this.updateMetadataMenuButtonState();
          this.updatePluginsStatus();
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
          this.displaySimulationSection();
          // Update button states when integration setting changes
          this.updateTemplaterButtonState();
          this.updatePluginsStatus();
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
    const templaterImportSetting = new Setting(mappingsDetails)
      .setName('Auto-populate from Templater')
      .setDesc('Automatically populate folder mappings from Templater plugin configuration');

    templaterImportSetting.addButton(button => {
      this.templaterImportButton = button.buttonEl;
      button
        .setButtonText('🔃 Sync with Templater')
        .onClick(async () => {
          await this.syncFolderMappingsWithTemplater();
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
    this.simulationDetails = containerEl.createEl('details', {cls: 'setting-details'});
    this.simulationDetails.open = false; // Collapsed by default
    const simulationSummary = this.simulationDetails.createEl('summary', {cls: 'setting-summary'});
    simulationSummary.style.display = 'flex';
    simulationSummary.style.alignItems = 'center';
    simulationSummary.style.justifyContent = 'space-between';
    simulationSummary.style.cursor = 'pointer';

    simulationSummary.createEl('h3', {text: '🧪 Simulation & Testing'});

    const simulationToggleDiv = simulationSummary.createEl('div', {cls: 'setting-item-control'});
    const simulationToggleButton = simulationToggleDiv.createEl('button', {cls: 'mod-cta'});
    simulationToggleButton.innerHTML = this.EXPAND_BUTTON;

    // Prevent button click from triggering summary toggle
    simulationToggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.simulationDetails.open = !this.simulationDetails.open;
    });

    const simulationDesc = this.simulationDetails.createEl('p');
    simulationDesc.innerHTML = 'Test your MetaFlow configuration by simulating the <code>processContent</code> method with sample frontmatter and different fileClasses.';

    // Create container for simulation
    this.simulationContainer = this.simulationDetails.createEl('div');
    this.displaySimulationSection();

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

    // plugins status
    this.metadataMenuStatus = containerEl.createEl('p', {text: ''});
    this.templaterStatus = containerEl.createEl('p', {text: ''});
    this.updatePluginsStatus();
  }

  private updatePluginsStatus(): void {
    if (!this.plugin.settings.metadataMenuIntegration) {
      this.metadataMenuStatus.setText('❌ MetadataMenu integration is disabled. Enable it to use fileClass-based field insertion.');
    } else if (this.metadataMenuAdapter.isMetadataMenuAvailable()) {
      this.metadataMenuStatus.setText('✅ MetadataMenu plugin is available and ready for integration.');
    } else {
      this.metadataMenuStatus.setText('❌ MetadataMenu plugin not found. Install and enable it to use fileClass-based field insertion.');
    }
    if (!this.plugin.settings.enableTemplaterIntegration) {
      this.templaterStatus.setText('❌ Templater integration is disabled. Enable it to use advanced scripting features.');
    } else if (this.templaterAdapter.isTemplaterAvailable()) {
      this.templaterStatus.setText('✅ Templater plugin is available and ready for integration.');
    } else {
      this.templaterStatus.setText('❌ Templater plugin not found. Install and enable it to use advanced scripting features.');
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
            isRegex: true
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
    const orderedProperties = this.plugin.settings.propertyDefaultValueScripts
      .slice()
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
    orderedProperties.forEach((script, index) => {
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

      // Enabled toggle
      const enabledLabelPreview = readOnlyDiv.createEl('label');
      enabledLabelPreview.style.minWidth = '77px';
      const enabledTogglePreview = enabledLabelPreview.createEl('input', {type: 'checkbox'});
      enabledTogglePreview.checked = script.enabled;
      enabledTogglePreview.style.marginRight = '5px';
      enabledLabelPreview.appendChild(document.createTextNode('Enabled'));

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

  private togglePropertiesVisibility(hide: boolean): void {
    const styleId = 'metaflow-hide-properties';
    let styleEl = document.getElementById(styleId);

    if (hide) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `
          .metadata-container,
          .frontmatter-container,
          .metadata-properties-heading,
          .metadata-property,
          .metadata-add-button,
          .frontmatter-container-header {
            display: none !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      if (styleEl) {
        styleEl.remove();
      }
    }
  }

  private displaySimulationSection(): void {
    if (!this.metadataMenuAdapter.isMetadataMenuAvailable() || !this.templaterAdapter.isTemplaterAvailable()) {
      this.simulationDetails.style.display = 'none';
      return;
    }
    this.simulationDetails.style.display = 'block';
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
          const metadataMenuPlugin = (this.app as any).plugins?.plugins?.['metadata-menu'];
          if (metadataMenuPlugin?.fieldIndex?.fileClassesFields) {
            const fileClasses = Array.from(metadataMenuPlugin.fieldIndex.fileClassesFields.keys());
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
    const inputContainer = this.simulationContainer.createEl('div', {cls: 'setting-item'});
    inputContainer.createEl('h4', {text: 'Input Frontmatter'});
    inputContainer.createEl('p', {text: 'Enter sample frontmatter content to test with your configuration:'});

    const inputTextarea = inputContainer.createEl('textarea', {
      placeholder: `---
title: Sample Title
author:
date:
tags: []
---

This is sample content for testing.`
    });
    inputTextarea.style.width = '100%';
    inputTextarea.style.height = '150px';
    inputTextarea.style.fontFamily = 'monospace';
    inputTextarea.style.fontSize = '12px';

    // Run simulation button
    const simulationButtonContainer = this.simulationContainer.createEl('div', {cls: 'setting-item'});
    const simulateButton = simulationButtonContainer.createEl('button', {text: '🚀 Run Simulation'});
    simulateButton.style.backgroundColor = 'var(--interactive-accent)';
    simulateButton.style.color = 'white';
    simulateButton.style.border = 'none';
    simulateButton.style.padding = '10px 20px';
    simulateButton.style.cursor = 'pointer';
    simulateButton.style.borderRadius = '5px';
    simulateButton.style.marginTop = '10px';
    simulateButton.style.marginBottom = '10px';

    // Status message
    const statusDiv = simulationButtonContainer.createEl('div');
    statusDiv.style.marginTop = '10px';
    statusDiv.style.padding = '10px';
    statusDiv.style.borderRadius = '5px';
    statusDiv.style.flexGrow = '1';
    statusDiv.style.display = 'none';

    // Output container
    const outputContainer = this.simulationContainer.createEl('div', {cls: 'setting-item'});
    outputContainer.createEl('h4', {text: 'Simulation Output'});

    const outputTextarea = outputContainer.createEl('textarea', {
      placeholder: 'Simulation results will appear here...'
    });
    outputTextarea.style.width = '100%';
    outputTextarea.style.height = '200px';
    outputTextarea.style.fontFamily = 'monospace';
    outputTextarea.style.fontSize = '12px';
    outputTextarea.style.backgroundColor = 'var(--background-secondary)';
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
        const mockFile = {
          name: 'simulation-test.md',
          path: 'simulation-test.md',
          extension: 'md'
        } as any;

        // Create a MetaFlowService instance with current settings
        const metaFlowService = new MetaFlowService(this.app, this.plugin.settings);

        // Override the fileClass detection to use the selected one
        this.metadataMenuAdapter.getFileClassFromMetadata = () => selectedFileClass;

        // Run the simulation
        const result = await metaFlowService.processContent(inputContent, mockFile);

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
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;

    // Reset classes
    statusDiv.className = '';

    switch (type) {
      case 'success':
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.style.color = '#155724';
        statusDiv.style.border = '1px solid #c3e6cb';
        break;
      case 'error':
        statusDiv.style.backgroundColor = '#f8d7da';
        statusDiv.style.color = '#721c24';
        statusDiv.style.border = '1px solid #f5c6cb';
        break;
      case 'info':
        statusDiv.style.backgroundColor = '#d1ecf1';
        statusDiv.style.color = '#0c5460';
        statusDiv.style.border = '1px solid #bee5eb';
        break;
    }
  }

  private updateMetadataMenuButtonState(): void {
    if (!this.metadataMenuImportButton) return;

    const isMetadataMenuAvailable = this.metadataMenuAdapter.isMetadataMenuAvailable();
    const isMetadataMenuEnabled = this.plugin.settings.metadataMenuIntegration;
    const shouldEnable = isMetadataMenuAvailable && isMetadataMenuEnabled;

    this.metadataMenuImportButton.disabled = !shouldEnable;

    if (!isMetadataMenuAvailable) {
      this.metadataMenuImportButton.title = 'MetadataMenu plugin is not available or not enabled';
    } else if (!isMetadataMenuEnabled) {
      this.metadataMenuImportButton.title = 'Enable MetadataMenu integration first';
    } else {
      this.metadataMenuImportButton.title = 'Import property scripts from MetadataMenu plugin';
    }
  }

  private updateTemplaterButtonState(): void {
    if (!this.templaterImportButton) return;

    const isTemplaterAvailable = this.templaterAdapter.isTemplaterAvailable();
    const isTemplaterEnabled = this.plugin.settings.enableTemplaterIntegration;
    const shouldEnable = isTemplaterAvailable && isTemplaterEnabled;

    this.templaterImportButton.disabled = !shouldEnable;

    if (!isTemplaterAvailable) {
      this.templaterImportButton.title = 'Templater plugin is not available or not enabled';
    } else if (!isTemplaterEnabled) {
      this.templaterImportButton.title = 'Enable Templater integration first';
    } else {
      this.templaterImportButton.title = 'Import folder mappings from Templater plugin';
    }
  }
}
