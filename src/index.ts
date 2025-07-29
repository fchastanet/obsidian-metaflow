import { App, Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { MetadataSettings, AutoMetadataSettings } from './types';
import { DEFAULT_SETTINGS } from './settings';
import { sortMetadataInContent } from './metadata-sorter';
import { MetadataAutoInserter } from './metadata-auto-inserter';
import { AutoUpdateCommand } from './auto-update-command';
import { MetadataPropertiesSorterSettingTab } from './settings-tab';

interface MetadataPropertiesSorterPluginSettings extends MetadataSettings {}

export default class MetadataPropertiesSorterPlugin extends Plugin {
	settings: MetadataPropertiesSorterPluginSettings;
	autoInserter: MetadataAutoInserter;
	autoUpdateCommand: AutoUpdateCommand;

	async onload() {
		await this.loadSettings();
		
		// Initialize the auto-inserter
		this.autoInserter = new MetadataAutoInserter(this.app);
		
		// Initialize the auto-update command
		this.autoUpdateCommand = new AutoUpdateCommand(this.app, this.settings, this.autoInserter);
		
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

		// Add command for auto update metadata fields
		this.addCommand({
			id: 'auto-update-metadata-fields',
			name: 'Auto Update metadata fields',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (view.file) {
					this.autoUpdateCommand.execute(view.file);
				} else {
					new Notice('No active file found');
				}
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
		
		// Ensure property scripts have order values for backwards compatibility
		this.settings.propertyDefaultValueScripts.forEach((script, index) => {
			if (script.order === undefined) {
				script.order = index;
			}
		});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
