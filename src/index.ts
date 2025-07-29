import { App, Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { MetadataSettings, AutoMetadataSettings } from './types';
import { DEFAULT_SETTINGS } from './settings';
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

		// Add command to update metadata properties of current note
		this.addCommand({
			id: 'update-metadata-properties',
			name: 'Update metadata properties',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.updateMetadataPropertiesInEditor(editor, view);
			}
		});

		// Add command to mass-update metadata properties in all notes or folder
		this.addCommand({
			id: 'mass-update-metadata-properties',
			name: 'Mass-update metadata properties',
			callback: () => {
				this.massUpdateMetadataProperties();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MetadataPropertiesSorterSettingTab(this.app, this));
	}

	async updateMetadataPropertiesInEditor(editor: Editor, view: MarkdownView) {
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
				new Notice('Metadata properties updated');
			} else {
				new Notice('No changes needed');
			}
		} catch (error) {
			console.error('Error updating metadata properties:', error);
			new Notice('Error updating metadata properties');
		}
	}

	async massUpdateMetadataProperties() {
		const files = this.app.vault.getMarkdownFiles();
		let updatedCount = 0;
		let totalFiles = files.length;

		new Notice(`Starting mass update of ${totalFiles} files...`);

		for (const file of files) {
			try {
				const content = await this.app.vault.read(file);
				const processedContent = await this.autoInserter.processContent(content, file, this.settings as AutoMetadataSettings);
				
				if (processedContent !== content) {
					await this.app.vault.modify(file, processedContent);
					updatedCount++;
				}
			} catch (error) {
				console.error(`Error updating metadata in file ${file.path}:`, error);
			}
		}

		new Notice(`Mass update completed: ${updatedCount} files updated out of ${totalFiles} total files`);
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
