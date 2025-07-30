import { App, TFile, Notice } from 'obsidian';
import { MetadataSettings, PropertyDefaultValueScript, ScriptContext } from './types';
import { MetadataAutoInserter } from './metadata-auto-inserter';
import { parseFrontmatter, serializeFrontmatter } from './yaml-utils';
import { ScriptUtilities } from './script-utilities';

export class AutoUpdateCommand {
	private app: App;
	private settings: MetadataSettings;
	private autoInserter: MetadataAutoInserter;
	private scriptUtilities: ScriptUtilities;

	constructor(app: App, settings: MetadataSettings, autoInserter: MetadataAutoInserter) {
		this.app = app;
		this.settings = settings;
		this.autoInserter = autoInserter;
		this.scriptUtilities = new ScriptUtilities(app, settings);
	}

	/**
	 * Execute the auto update metadata fields command
	 */
	async execute(file: TFile): Promise<void> {
		try {
			// Step 1: Check if MetadataMenu plugin is available
			if (!this.autoInserter.isMetadataMenuAvailable()) {
				new Notice('Error: MetadataMenu plugin is not available. Please install and enable it.');
				throw new Error('MetadataMenu plugin not available');
			}

			// Step 2: Check if Templater plugin is available (if integration is enabled)
			if (this.settings.enableTemplaterIntegration && !this.scriptUtilities.isTemplaterAvailable()) {
				new Notice('Error: Templater plugin is not available. Please install and enable it or disable Templater integration.');
				throw new Error('Templater plugin not available');
			}

			// Step 3: Read file content and parse frontmatter
			const content = await this.app.vault.read(file);
			const parseResult = parseFrontmatter(content);
			
			let frontmatter: any = {};
			let bodyContent = content;
			
			if (parseResult) {
				frontmatter = parseResult.metadata || {};
				bodyContent = parseResult.restOfContent;
			}

			// Step 4: Determine or validate fileClass
			let fileClass = frontmatter?.fileClass || frontmatter?.file_class;
			
			if (!fileClass) {
				// Try to deduce fileClass from folder/fileClass mapping
				fileClass = this.deduceFileClassFromPath(file.path);
				if (!fileClass) {
					new Notice(`Error: No fileClass found for file "${file.name}" and no matching folder pattern.`);
					throw new Error('No fileClass determined');
				}
			}

			// Step 5: Validate fileClass exists in MetadataMenu
			const fileClassDefinition = await this.autoInserter.getFileClassByName(fileClass);
			if (!fileClassDefinition) {
				new Notice(`Error: FileClass "${fileClass}" does not exist in MetadataMenu settings.`);
				throw new Error(`FileClass "${fileClass}" not found`);
			}

			// Step 6: Validate fileClass matches folder mapping (if it was deduced)
			if (!frontmatter?.fileClass && !frontmatter?.file_class) {
				if (!this.validateFileClassAgainstMapping(file.path, fileClass)) {
					new Notice(`Error: FileClass "${fileClass}" does not match any folder/fileClass mapping.`);
					throw new Error('FileClass mapping validation failed');
				}
			}

			// Step 7: Insert missing metadata headers using MetadataAutoInserter
			await this.autoInserter.insertMissingFields(file, fileClass);

			// Step 8: Re-read the file content after MetadataMenu has inserted fields
			const updatedContent = await this.app.vault.read(file);
			const updatedParseResult = parseFrontmatter(updatedContent);
			
			let updatedFrontmatter: any = {};
			let updatedBodyContent = updatedContent;
			
			if (updatedParseResult) {
				updatedFrontmatter = updatedParseResult.metadata || {};
				updatedBodyContent = updatedParseResult.restOfContent;
			}

			/** @todo missing sort */

			// Step 9: Add default values to properties
			const enrichedFrontmatter = await this.addDefaultValuesToProperties(
				updatedFrontmatter || {},
				file,
				fileClass
			);

			// Step 10: Write the updated content back to the file
			const finalContent = serializeFrontmatter(enrichedFrontmatter, updatedBodyContent);
			await this.app.vault.modify(file, finalContent);

			new Notice(`Successfully updated metadata fields for "${file.name}"`);

		} catch (error) {
			console.error('Error in auto update metadata fields:', error);
			new Notice(`Error updating metadata fields: ${error.message}`);
		}
	}

	/**
	 * Deduce fileClass from folder path using the mapping settings
	 */
	private deduceFileClassFromPath(filePath: string): string | null {
		for (const mapping of this.settings.folderFileClassMappings) {
			if (this.matchesPattern(filePath, mapping.folderPattern, mapping.isRegex)) {
				return mapping.fileClass;
			}
		}
		return null;
	}

	/**
	 * Check if a file path matches a pattern
	 */
	private matchesPattern(filePath: string, pattern: string, isRegex: boolean = false): boolean {
		if (isRegex) {
			try {
				const regex = new RegExp(pattern);
				return regex.test(filePath);
			} catch (error) {
				console.error(`Invalid regex pattern: ${pattern}`, error);
				return false;
			}
		} else {
			// Simple glob-like matching
			const regexPattern = pattern
				.replace(/\./g, '\\.')
				.replace(/\*/g, '.*')
				.replace(/\?/g, '.');
			const regex = new RegExp(`^${regexPattern}$`);
			return regex.test(filePath);
		}
	}

	/**
	 * Validate that the determined fileClass matches the folder mapping
	 */
	private validateFileClassAgainstMapping(filePath: string, fileClass: string): boolean {
		const deducedFileClass = this.deduceFileClassFromPath(filePath);
		return deducedFileClass === fileClass;
	}

	/**
	 * Add default values to properties using the configured scripts
	 */
	private async addDefaultValuesToProperties(
		frontmatter: { [key: string]: any },
		file: TFile,
		fileClass: string
	): Promise<{ [key: string]: any }> {
		const enrichedFrontmatter = { ...frontmatter };

		// Ensure fileClass is set
		if (!enrichedFrontmatter.fileClass && !enrichedFrontmatter.file_class) {
			enrichedFrontmatter.fileClass = fileClass;
		}

		// Sort scripts by order (if specified) before processing
		const orderedScripts = [...this.settings.propertyDefaultValueScripts].sort((a, b) => {
			const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
			const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
			return orderA - orderB;
		});

		// Process each property default value script in order
		for (const script of orderedScripts) {
			if (!script.enabled) continue;

			// Skip if property already has a value
			if (enrichedFrontmatter[script.propertyName] !== undefined) {
				continue;
			}

			try {
				const defaultValue = await this.executePropertyScript(
					script,
					file,
					fileClass,
					enrichedFrontmatter
				);

				if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
					enrichedFrontmatter[script.propertyName] = defaultValue;
				}
			} catch (error) {
				console.error(`Error executing script for property "${script.propertyName}":`, error);
				new Notice(`Error setting default value for property "${script.propertyName}": ${error.message}`);
			}
		}

		return enrichedFrontmatter;
	}

	/**
	 * Execute a property default value script
	 */
	private async executePropertyScript(
		script: PropertyDefaultValueScript,
		file: TFile,
		fileClass: string,
		metadata: { [key: string]: any }
	): Promise<any> {
		// Get utilities from ScriptUtilities
		const utilities = this.scriptUtilities.getAllUtilities();
		
		// Create script context
		const context: ScriptContext = {
			fileClass,
			file,
			metadata,
			prompt: utilities.prompt,
			date: utilities.date,
			generateMarkdownLink: (targetFile: TFile) => utilities.generateMarkdownLink(targetFile, file),
			detectLanguage: utilities.detectLanguage
		};

		// Create a safe execution environment
		const executeScript = new Function(
			'context',
			`
			const { fileClass, file, metadata, prompt, date, generateMarkdownLink, detectLanguage } = context;
			return (async () => {
				${script.script}
			})();
			`
		);

		return await executeScript(context);
	}

	/**
	 * Check Templater configuration consistency
	 */
	async checkTemplaterConsistency(): Promise<{ isConsistent: boolean; warnings: string[] }> {
		const warnings: string[] = [];
		let isConsistent = true;

		if (!this.settings.enableTemplaterIntegration) {
			return { isConsistent: true, warnings: [] };
		}

		const templater = this.scriptUtilities.getTemplaterPlugin();
		if (!templater) {
			warnings.push('Templater plugin not found but integration is enabled');
			return { isConsistent: false, warnings };
		}

		// Check if Templater has folder template mappings that match our fileClass mappings
		// This is a simplified check - you might need to adapt based on Templater's actual structure
		try {
			const templaterSettings = templater.settings;
			if (templaterSettings?.folder_templates) {
				const templaterMappings = templaterSettings.folder_templates;
				
				// Compare with our mappings
				for (const mapping of this.settings.folderFileClassMappings) {
					const matchingTemplaterMapping = templaterMappings.find((tm: any) => 
						tm.folder === mapping.folderPattern
					);
					
					if (!matchingTemplaterMapping) {
						warnings.push(`No matching Templater mapping found for folder pattern: ${mapping.folderPattern}`);
						isConsistent = false;
					}
				}
			}
		} catch (error) {
			console.error('Error checking Templater consistency:', error);
			warnings.push('Error accessing Templater settings');
			isConsistent = false;
		}

		return { isConsistent, warnings };
	}
}
