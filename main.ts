import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { MetadataSettings, DEFAULT_SETTINGS, sortMetadataInContent, sortProperties } from './metadata-sorter';
import { MetadataAutoInserter, AutoMetadataSettings } from './metadata-auto-inserter';

interface MetadataPropertiesSorterPluginSettings extends MetadataSettings {}

export default class MetadataPropertiesSorterPlugin extends Plugin {
	settings: MetadataPropertiesSorterPluginSettings;
	autoInserter: MetadataAutoInserter;

	async onload() {
		await this.loadSettings();
		
		// Initialize the auto-inserter
		this.autoInserter = new MetadataAutoInserter(this.app);
		
		// Try to initialize MetadataMenu integration
		await this.autoInserter.initializeMetadataMenuIntegration();

		// Add command to sort metadata of current note
		this.addCommand({
			id: 'sort-metadata-properties',
			name: 'Sort metadata properties',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				// this.sortMetadataInEditor(editor);
			}
		});

		// Add command to sort all metadata properties in vault
		this.addCommand({
			id: 'sort-all-metadata-properties',
			name: 'Sort metadata properties in all notes',
			callback: () => {
				this.sortAllNotesMetadata();
			}
		});

		// Add command to insert missing metadata fields
		this.addCommand({
			id: 'insert-missing-metadata',
			name: 'Insert missing metadata fields',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.insertMissingMetadataInEditor(editor, view);
			}
		});

		// Add command to sort and insert missing metadata
		this.addCommand({
			id: 'sort-and-insert-metadata',
			name: 'Sort and insert missing metadata',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				debugger;
				this.sortAndInsertMetadataInEditor(editor, view);
			}
		});

		// Register event to auto-sort when a note is opened (if enabled)
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (this.settings.autoSortOnView && file && file.extension === 'md') {
					// Add a small delay to avoid constant rewriting
					setTimeout(() => {
						this.autoSortMetadata(file);
					}, 1000);
				}
			})
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MetadataPropertiesSorterSettingTab(this.app, this));
	}

	async autoSortMetadata(file: TFile) {
		try {
			const content = await this.app.vault.read(file);
			const processedContent = await this.autoInserter.processContent(content, file, this.settings as AutoMetadataSettings);
			
			if (processedContent !== content) {
				// Prevent recursive calls by temporarily disabling auto-sort
				const originalAutoSort = this.settings.autoSortOnView;
				this.settings.autoSortOnView = false;
				
				await this.app.vault.modify(file, processedContent);
				
				// Re-enable auto-sort after a short delay
				setTimeout(() => {
					this.settings.autoSortOnView = originalAutoSort;
				}, 500);
			}
		} catch (error) {
			console.error('Error auto-sorting metadata:', error);
		}
	}

	async sortAllNotesMetadata() {
		const files = this.app.vault.getMarkdownFiles();
		let sortedCount = 0;

		for (const file of files) {
			const content = await this.app.vault.read(file);
			const sortedContent = sortMetadataInContent(content, this.settings);
			
			if (sortedContent !== content) {
				await this.app.vault.modify(file, sortedContent);
				sortedCount++;
			}
		}

		new Notice(`Sorted metadata in ${sortedCount} notes`);
	}

	sortMetadataInEditor(editor: Editor) {
		const content = editor.getValue();
		const sortedContent = sortMetadataInContent(content, this.settings);
		
		if (sortedContent !== content) {
			editor.setValue(sortedContent);
			new Notice('Metadata properties sorted');
		} else {
			new Notice('No metadata to sort or already sorted');
		}
	}

	async insertMissingMetadataInEditor(editor: Editor, view: MarkdownView) {
		const content = editor.getValue();
		const file = view.file;
		
		if (!file) {
			new Notice('No active file');
			return;
		}

		try {
			const processedContent = await this.autoInserter.insertMissingMetadata(content, file, this.settings as AutoMetadataSettings);
			
			if (processedContent !== content) {
				editor.setValue(processedContent);
				new Notice('Missing metadata fields inserted');
			} else {
				new Notice('No missing metadata fields to insert');
			}
		} catch (error) {
			console.error('Error inserting missing metadata:', error);
			new Notice('Error inserting missing metadata fields');
		}
	}

	async sortAndInsertMetadataInEditor(editor: Editor, view: MarkdownView) {
		const content = editor.getValue();
		const file = view.file;
		
		if (!file) {
			new Notice('No active file');
			return;
		}

		try {
			const processedContent = await this.autoInserter.processContent(content, file, this.settings as AutoMetadataSettings);
			
			if (processedContent !== content) {
				editor.setValue(processedContent);
				new Notice('Metadata sorted and missing fields inserted');
			} else {
				new Notice('No changes needed');
			}
		} catch (error) {
			console.error('Error processing metadata:', error);
			new Notice('Error processing metadata');
		}
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MetadataPropertiesSorterSettingTab extends PluginSettingTab {
	plugin: MetadataPropertiesSorterPlugin;

	constructor(app: App, plugin: MetadataPropertiesSorterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Metadata Properties Sorter Settings'});

		// Auto-sort setting
		new Setting(containerEl)
			.setName('Auto-sort on file open')
			.setDesc('Automatically sort metadata properties when opening a note')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSortOnView)
				.onChange(async (value) => {
					this.plugin.settings.autoSortOnView = value;
					await this.plugin.saveSettings();
				}));

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

		// Insert missing fields on sort
		new Setting(containerEl)
			.setName('Insert missing fields when sorting')
			.setDesc('Insert missing metadata fields when sorting properties')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.insertMissingFieldsOnSort)
				.onChange(async (value) => {
					this.plugin.settings.insertMissingFieldsOnSort = value;
					await this.plugin.saveSettings();
				}));

		// Use MetadataMenu defaults
		new Setting(containerEl)
			.setName('Use MetadataMenu default values')
			.setDesc('Use default values defined in MetadataMenu fileClass when inserting missing fields')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useMetadataMenuDefaults)
				.onChange(async (value) => {
					this.plugin.settings.useMetadataMenuDefaults = value;
					await this.plugin.saveSettings();
				}));

		// Property order setting
		containerEl.createEl('h3', {text: 'Property Order'});
		
		new Setting(containerEl)
			.setName('Property order')
			.setDesc('Define the order of properties (one per line). Properties not listed will appear at the end.')
			.addTextArea(text => text
				.setPlaceholder('title\ndate\ncreated\nupdated\nstatus\ntype\ntags')
				.setValue(this.plugin.settings.propertyOrder.join('\n'))
				.onChange(async (value) => {
					this.plugin.settings.propertyOrder = value
						.split('\n')
						.map(line => line.trim())
						.filter(line => line.length > 0);
					await this.plugin.saveSettings();
				}));

		// Add some help text
		containerEl.createEl('h3', {text: 'Usage'});
		containerEl.createEl('p', {text: 'Use the command palette to:'});
		const list = containerEl.createEl('ul');
		list.createEl('li', {text: 'Sort metadata properties - Sort current note'});
		list.createEl('li', {text: 'Sort metadata properties in all notes - Sort entire vault'});
		list.createEl('li', {text: 'Insert missing metadata fields - Add missing fields from fileClass'});
		list.createEl('li', {text: 'Sort and insert missing metadata - Combined operation'});
		
		containerEl.createEl('p', {text: 'Properties will be sorted according to the order specified above. Unknown properties will be sorted alphabetically and placed at the end if the option is enabled.'});
		
		// MetadataMenu status
		if (this.plugin.autoInserter.isMetadataMenuAvailable()) {
			containerEl.createEl('p', {text: '✅ MetadataMenu plugin is available and ready for integration.'});
		} else {
			containerEl.createEl('p', {text: '❌ MetadataMenu plugin not found. Install and enable it to use fileClass-based field insertion.'});
		}
	}
}
