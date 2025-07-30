import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import MetadataPropertiesSorterPlugin from './index';

export class MetadataPropertiesSorterSettingTab extends PluginSettingTab {
	plugin: MetadataPropertiesSorterPlugin;

	constructor(app: App, plugin: MetadataPropertiesSorterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Metadata Properties Sorter Settings'});

		// Sort unknown properties setting
		new Setting(containerEl)
			.setName('Sort unknown properties alphabetically')
			.setDesc('Sort properties not in the custom order alphabetically at the end')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.sortUnknownPropertiesLast)
				.onChange(async (value) => {
					this.plugin.settings.sortUnknownPropertiesLast = value;
					await this.plugin.saveSettings();
				}));

		// MetadataMenu Integration section
		containerEl.createEl('h3', {text: 'MetadataMenu Integration'});

		// Enable MetadataMenu integration
		new Setting(containerEl)
			.setName('Enable MetadataMenu integration')
			.setDesc('Enable integration with the MetadataMenu plugin for fileClass-based field insertion')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.metadataMenuIntegration)
				.onChange(async (value) => {
					this.plugin.settings.metadataMenuIntegration = value;
					if (value) {
						const success = await this.plugin.autoInserter.initializeMetadataMenuIntegration();
						if (!success) {
							new Notice('MetadataMenu plugin not found or not enabled');
							this.plugin.settings.metadataMenuIntegration = false;
						}
					}
					await this.plugin.saveSettings();
				}));

		// Auto metadata insertion setting
		new Setting(containerEl)
			.setName('Auto-insert missing metadata fields')
			.setDesc('Automatically insert missing metadata fields based on fileClass definitions')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAutoMetadataInsertion)
				.onChange(async (value) => {
					this.plugin.settings.enableAutoMetadataInsertion = value;
					await this.plugin.saveSettings();
				}));

		// Templater Integration
		containerEl.createEl('h3', {text: 'Templater Integration'});

		new Setting(containerEl)
			.setName('Enable Templater integration')
			.setDesc('Enable integration with Templater plugin for advanced scripting features')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableTemplaterIntegration)
				.onChange(async (value) => {
					this.plugin.settings.enableTemplaterIntegration = value;
					await this.plugin.saveSettings();
					// Check consistency when enabling
					if (value) {
						const consistency = await this.plugin.autoUpdateCommand.checkTemplaterConsistency();
						if (!consistency.isConsistent) {
							new Notice(`Templater consistency warnings: ${consistency.warnings.join(', ')}`);
						}
					}
				}));

		// Folder/FileClass Mappings
		containerEl.createEl('h3', {text: 'Folder/FileClass Mappings'});
		
		const mappingsDesc = containerEl.createEl('p');
		mappingsDesc.innerHTML = 'Map folder patterns to MetadataMenu fileClasses. Uses the same pattern matching as Templater plugin. Patterns are evaluated in order, with the first match being used.';

		// Auto-populate from Templater button
		new Setting(containerEl)
			.setName('Auto-populate from Templater')
			.setDesc('Automatically populate folder mappings from Templater plugin configuration')
			.addButton(button => button
				.setButtonText('Import from Templater')
				.onClick(async () => {
					await this.autoPopulateFolderMappingsFromTemplater();
					this.displayFolderMappings(mappingsContainer);
				}));

		// Create container for mappings
		const mappingsContainer = containerEl.createEl('div');
		this.displayFolderMappings(mappingsContainer);

		// Add new mapping button
		new Setting(containerEl)
			.setName('Add folder mapping')
			.addButton(button => button
				.setButtonText('Add mapping')
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

		// Property Default Value Scripts
		containerEl.createEl('h3', {text: 'Property Default Value Scripts'});
		
		const scriptsDesc = containerEl.createEl('p');
		scriptsDesc.innerHTML = 'Define JavaScript scripts to generate default values for properties. Scripts have access to: <code>fileClass</code>, <code>file</code>, <code>metadata</code>, <code>prompt</code>, <code>date</code>, <code>generateMarkdownLink</code>, <code>detectLanguage</code>.';

		// Auto-populate from MetadataMenu button
		new Setting(containerEl)
			.setName('Auto-populate from MetadataMenu')
			.setDesc('Automatically populate property scripts from MetadataMenu plugin fileClass definitions')
			.addButton(button => button
				.setButtonText('Import from MetadataMenu')
				.onClick(async () => {
					await this.autoPopulatePropertyScriptsFromMetadataMenu();
					this.displayPropertyScripts(scriptsContainer);
				}));
		
		// Create container for scripts
		const scriptsContainer = containerEl.createEl('div');
		this.displayPropertyScripts(scriptsContainer);

		// Add new script button
		new Setting(containerEl)
			.setName('Add property script')
			.addButton(button => button
				.setButtonText('Add property script')
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
		if (this.plugin.autoInserter.isMetadataMenuAvailable()) {
			containerEl.createEl('p', {text: '✅ MetadataMenu plugin is available and ready for integration.'});
		} else {
			containerEl.createEl('p', {text: '❌ MetadataMenu plugin not found. Install and enable it to use fileClass-based field insertion.'});
		}
	}

	private async autoPopulateFolderMappingsFromTemplater(): Promise<void> {
		try {
			const templaterPlugin = (this.app as any).plugins?.plugins?.['templater-obsidian'];
			if (!templaterPlugin) {
				new Notice('Templater plugin not found');
				return;
			}

			const templaterSettings = templaterPlugin.settings;
			if (!templaterSettings?.folder_templates) {
				new Notice('No folder templates found in Templater settings');
				return;
			}

			let importedCount = 0;
			for (const folderTemplate of templaterSettings.folder_templates) {
				// Extract file class name from template filename (remove .md extension)
				const templateName = folderTemplate.template.replace('.md', '');
				
				// Check if mapping already exists
				const existingMapping = this.plugin.settings.folderFileClassMappings.find(
					mapping => mapping.folderPattern === folderTemplate.folder
				);

				if (!existingMapping) {
					this.plugin.settings.folderFileClassMappings.push({
						folderPattern: folderTemplate.folder,
						fileClass: templateName,
						isRegex: false
					});
					importedCount++;
				}
			}

			await this.plugin.saveSettings();
			new Notice(`Imported ${importedCount} folder mappings from Templater`);

		} catch (error) {
			console.error('Error importing from Templater:', error);
			new Notice('Error importing folder mappings from Templater');
		}
	}

	private async autoPopulatePropertyScriptsFromMetadataMenu(): Promise<void> {
		try {
			if (!this.plugin.autoInserter.isMetadataMenuAvailable()) {
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
			const allFields: { [fieldName: string]: {
				fileClasses: string[],
			} } = {};

			// Collect all properties and which fileClasses use them
			fileClassesFields.forEach(
				(fields: {name:string}[], fileClass: string) => {
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
				const { fileClasses } = fieldData;
				// Check if script already exists
				const existingScript = this.plugin.settings.propertyDefaultValueScripts.find(
					script => script.propertyName === propertyName
				);

				if (!existingScript) {
					const fileClassesComment = `// Used by fileClasses: ${fileClasses.join(', ')}`;
					const defaultScript = `${fileClassesComment}\nreturn "";`;

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
			const mappingDiv = container.createEl('div', { cls: 'setting-item' });
			
			const mappingControl = mappingDiv.createEl('div', { cls: 'setting-item-control' });
			mappingControl.style.justifyContent = 'space-between';

			// Order controls
			const orderDiv = mappingControl.createEl('div', { cls: 'setting-item-order' });
			orderDiv.style.display = 'flex';
			orderDiv.style.alignItems = 'center';
			orderDiv.style.marginBottom = '5px';
			
			const upButton = orderDiv.createEl('button', { text: '↑' });
			upButton.style.marginRight = '5px';
			upButton.disabled = index === 0;
			
			const downButton = orderDiv.createEl('button', { text: '↓' });
			downButton.style.marginRight = '10px';
			downButton.disabled = index === this.plugin.settings.folderFileClassMappings.length - 1;
			
			orderDiv.createEl('span', { text: `Order: ${index + 1}` });
			
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
			
			const regexLabel = controlRow.createEl('label', { text: 'Regex' });
			
			// Delete button
			const deleteButton = controlRow.createEl('button', { text: 'Delete' });
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
			const scriptDiv = container.createEl('div', { cls: 'setting-item' });
			scriptDiv.style.border = '1px solid #ccc';
			scriptDiv.style.padding = '10px';
			scriptDiv.style.marginBottom = '10px';
			
			const controlDiv = scriptDiv.createEl('div', { cls: 'setting-item-control' });
			controlDiv.style.display = 'flex';
			controlDiv.style.flexDirection = 'column';
			controlDiv.style.width = '100%';
			controlDiv.style.textAlign = 'left';
			
			// propertyDiv containing propDiv and propertyInput
			const propertyDiv = controlDiv.createEl('div', { cls: 'setting-property' });
			propertyDiv.style.display = 'flex';
			propertyDiv.style.width = '100%';
			propertyDiv.style.alignItems = 'baseline';
			propertyDiv.style.gap = 'var(--size-4-2)';
			
			propertyDiv.createEl('label', { text: 'Property name:' });
			const propertyInput = propertyDiv.createEl('input', {
				type: 'text',
				placeholder: 'Property name (e.g., title, author)',
				value: script.propertyName
			});
			propertyInput.style.margin = '0 10px';
			propertyInput.style.flexGrow = '1';
			
			// Enabled toggle
			const enabledLabel = propertyDiv.createEl('label');
			const enabledToggle = enabledLabel.createEl('input', { type: 'checkbox' });
			enabledToggle.checked = script.enabled;
			enabledToggle.style.marginRight = '5px';
			enabledLabel.appendChild(document.createTextNode('Enabled'));
			
			// Order controls
			const orderDiv = propertyDiv.createEl('div', { cls: 'setting-item-order' });
			orderDiv.style.display = 'flex';
			orderDiv.style.alignItems = 'center';
			orderDiv.style.marginBottom = '10px';
			
			const upButton = orderDiv.createEl('button', { text: '↑' });
			upButton.style.marginRight = '5px';
			upButton.disabled = index === 0;
			
			const downButton = orderDiv.createEl('button', { text: '↓' });
			downButton.style.marginRight = '10px';
			downButton.disabled = index === this.plugin.settings.propertyDefaultValueScripts.length - 1;
			
			orderDiv.createEl('span', { text: `Order: ${index + 1}` });

			// Script textarea
			const scriptCodeDiv = controlDiv.createEl('div');
			scriptCodeDiv.style.width = '100%';
			scriptCodeDiv.style.paddingRight = '60px';
			
			let scriptCodeLabel = 'Script';
			if (script.fileClasses) {
				scriptCodeLabel += ` (this field is used by the fileClasses: ${script.fileClasses.join(', ')})`;
			}
			scriptCodeLabel += ':';
			scriptCodeDiv.createEl('label', { text: scriptCodeLabel });
			const scriptTextarea = scriptCodeDiv.createEl('textarea', {
				placeholder: 'return "default value";',
			});
			scriptTextarea.value = script.script;
			scriptTextarea.style.width = '100%';
			scriptTextarea.style.height = '100px';
			scriptTextarea.style.marginTop = '5px';
			scriptTextarea.style.fontFamily = 'monospace';
			
			// Button row
			const buttonRow = controlDiv.createEl('div');
			buttonRow.style.display = 'flex';
			buttonRow.style.gap = '10px';
			
			// Delete button
			const deleteButton = buttonRow.createEl('button', { text: 'Delete Script' });
			deleteButton.style.backgroundColor = '#e74c3c';
			deleteButton.style.color = 'white';
			deleteButton.style.border = 'none';
			deleteButton.style.padding = '5px 10px';
			deleteButton.style.cursor = 'pointer';
			
			// Event listeners
			upButton.addEventListener('click', async () => {
				if (index > 0) {
					const temp = this.plugin.settings.propertyDefaultValueScripts[index];
					this.plugin.settings.propertyDefaultValueScripts[index] = this.plugin.settings.propertyDefaultValueScripts[index - 1];
					this.plugin.settings.propertyDefaultValueScripts[index - 1] = temp;
					await this.plugin.saveSettings();
					this.displayPropertyScripts(container);
				}
			});
			
			downButton.addEventListener('click', async () => {
				if (index < this.plugin.settings.propertyDefaultValueScripts.length - 1) {
					const temp = this.plugin.settings.propertyDefaultValueScripts[index];
					this.plugin.settings.propertyDefaultValueScripts[index] = this.plugin.settings.propertyDefaultValueScripts[index + 1];
					this.plugin.settings.propertyDefaultValueScripts[index + 1] = temp;
					await this.plugin.saveSettings();
					this.displayPropertyScripts(container);
				}
			});
			
			propertyInput.addEventListener('input', async () => {
				script.propertyName = propertyInput.value;
				await this.plugin.saveSettings();
			});
			
			enabledToggle.addEventListener('change', async () => {
				script.enabled = enabledToggle.checked;
				await this.plugin.saveSettings();
			});
			
			scriptTextarea.addEventListener('input', async () => {
				script.script = scriptTextarea.value;
				await this.plugin.saveSettings();
			});
			
			deleteButton.addEventListener('click', async () => {
				this.plugin.settings.propertyDefaultValueScripts.splice(index, 1);
				await this.plugin.saveSettings();
				this.displayPropertyScripts(container);
			});
		});
	}
}
