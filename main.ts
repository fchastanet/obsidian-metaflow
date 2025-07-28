import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { MetadataSettings, DEFAULT_SETTINGS, sortMetadataInContent, sortProperties } from './metadata-sorter';

interface MetadataPropertiesSorterPluginSettings extends MetadataSettings {}

export default class MetadataPropertiesSorterPlugin extends Plugin {
	settings: MetadataPropertiesSorterPluginSettings;

	async onload() {
		await this.loadSettings();

		// Add command to sort metadata of current note
		this.addCommand({
			id: 'sort-metadata-properties',
			name: 'Sort metadata properties',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.sortMetadataInEditor(editor);
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
			const sortedContent = sortMetadataInContent(content, this.settings);
			
			if (sortedContent !== content) {
				// Prevent recursive calls by temporarily disabling auto-sort
				const originalAutoSort = this.settings.autoSortOnView;
				this.settings.autoSortOnView = false;
				
				await this.app.vault.modify(file, sortedContent);
				
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

		// Property order setting
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
		
		containerEl.createEl('p', {text: 'Properties will be sorted according to the order specified above. Unknown properties will be sorted alphabetically and placed at the end if the option is enabled.'});
	}
}
