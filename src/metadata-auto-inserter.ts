import { TFile, App } from 'obsidian';
import { AutoMetadataSettings, MetadataMenuField, FileClassDefinition, MetadataMenuPluginInterface } from './types';
import { sortMetadataInContent } from './metadata-sorter';
import { parseFileClassFromContent } from './yaml-utils';
import { getDefaultValueForField, validateField } from './field-utils';
import * as yaml from 'js-yaml';

export class MetadataAutoInserter {
	private app: App;
	private metadataMenuPlugin: MetadataMenuPluginInterface | null = null;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Initialize the MetadataMenu plugin integration
	 */
	async initializeMetadataMenuIntegration(): Promise<boolean> {
		try {
			// Try to get the MetadataMenu plugin
			const metadataMenuPlugin = (this.app as any).plugins?.plugins?.['metadata-menu'];
			
			if (metadataMenuPlugin) {
				console.log('MetadataMenu plugin found');
				
				// Debug: Log the plugin structure
				console.log('MetadataMenu plugin properties:', Object.keys(metadataMenuPlugin));
				
				// Check for API in different possible locations
				let api = null;
				if (metadataMenuPlugin.api) {
					api = metadataMenuPlugin.api;
					console.log('Found API at metadataMenuPlugin.api');
				} else if (metadataMenuPlugin.metadataMenuApi) {
					api = metadataMenuPlugin.metadataMenuApi;
					console.log('Found API at metadataMenuPlugin.metadataMenuApi');
				} else if (typeof metadataMenuPlugin.getAPI === 'function') {
					api = metadataMenuPlugin.getAPI();
					console.log('Found API through getAPI() method');
				}
				
				if (api && typeof api === 'object') {
					this.metadataMenuPlugin = {
						...metadataMenuPlugin,
						api: api
					};
					
					// Debug: Log available API methods
					console.log('MetadataMenu API methods:', Object.keys(api));
					
					// Check for fieldIndex availability
					if (metadataMenuPlugin.fieldIndex) {
						console.log('MetadataMenu fieldIndex found');
						// Debug: Log fieldIndex structure
						if (metadataMenuPlugin.fieldIndex.fileClassesAncestors) {
							console.log('fileClassesAncestors found in fieldIndex');
						}
					} else {
						console.log('MetadataMenu fieldIndex not found - ancestor support may be limited');
					}
					
					console.log('MetadataMenu plugin integration initialized successfully');
					return true;
				} else {
					console.log('MetadataMenu plugin found but no usable API structure');
					console.log('Available properties:', Object.keys(metadataMenuPlugin));
					return false;
				}
			}
			
			console.log('MetadataMenu plugin not found or not enabled');
			return false;
		} catch (error) {
			console.error('Error initializing MetadataMenu integration:', error);
			return false;
		}
	}

	/**
	 * Check if MetadataMenu integration is available
	 */
	isMetadataMenuAvailable(): boolean {
		return this.metadataMenuPlugin !== null;
	}

	/**
	 * Get the fileClass for a given file
	 */
	async getFileClass(file: TFile): Promise<FileClassDefinition | null> {
		if (!this.metadataMenuPlugin?.api) {
			return null;
		}

		try {
			// Check if the method exists before calling it
			if (typeof this.metadataMenuPlugin.api.getFileClass === 'function') {
				return await this.metadataMenuPlugin.api.getFileClass(file);
			} else {
				console.log('MetadataMenu API method getFileClass not available');
				return null;
			}
		} catch (error) {
			console.error('Error getting fileClass:', error);
			return null;
		}
	}

	/**
	 * Get fileClass by name
	 */
	async getFileClassByName(name: string): Promise<FileClassDefinition | null> {
		if (!this.metadataMenuPlugin?.api) {
			return null;
		}

		try {
			// Check if the method exists before calling it
			if (typeof this.metadataMenuPlugin.api.getFileClassByName === 'function') {
				return await this.metadataMenuPlugin.api.getFileClassByName(name);
			} else {
				console.log('MetadataMenu API method getFileClassByName not available');
				return null;
			}
		} catch (error) {
			console.error('Error getting fileClass by name:', error);
			return null;
		}
	}

	/**
	 * Get the ancestor chain for a fileClass in the correct order for field insertion
	 * Returns ancestors from most basic to most specific (e.g., ["default-basic", "default"])
	 */
	async getFileClassAncestorChain(fileClassName: string): Promise<string[]> {
		try {
			// Access MetadataMenu's fieldIndex.fileClassesAncestors
			const fieldIndex = (this.metadataMenuPlugin as any)?.fieldIndex;
			if (!fieldIndex?.fileClassesAncestors) {
				console.log('MetadataMenu fieldIndex.fileClassesAncestors not available');
				return [];
			}

			const fileClassesAncestors = fieldIndex.fileClassesAncestors;
			
			// Check if it's a Map or object
			let ancestors: string[] = [];
			if (fileClassesAncestors instanceof Map) {
				ancestors = fileClassesAncestors.get(fileClassName) || [];
			} else if (typeof fileClassesAncestors === 'object') {
				ancestors = fileClassesAncestors[fileClassName] || [];
			}

			// From the example: book -> ["default", "default-basic"]
			// We want to insert in order: "default-basic" (most basic) → "default" → "book" (most specific)
			// So we need to reverse the ancestors array to get most basic first
			const orderedAncestors = ancestors.slice().reverse();
			
			console.log(`FileClass "${fileClassName}" has ancestors:`, ancestors);
			console.log(`Insertion order will be:`, [...orderedAncestors, fileClassName]);
			
			return orderedAncestors;

		} catch (error) {
			console.error('Error getting fileClass ancestor chain:', error);
			return [];
		}
	}

	/**
	 * Insert missing metadata fields using MetadataMenu's insertMissingFields API
	 * This method adds missing fields directly to the frontmatter at the top of the file
	 * Now supports inserting fields from fileClass ancestors in the correct order:
	 * 1. Most basic ancestor fields first (e.g., "default-basic")
	 * 2. More specific ancestor fields (e.g., "default") 
	 * 3. Finally the main fileClass fields (e.g., "book")
	 */
	async insertMissingFields(file: TFile, fileClassName?: string): Promise<void> {
		if (!this.metadataMenuPlugin?.api) {
			console.log('MetadataMenu API not available for inserting missing fields');
			return;
		}

		try {
			// Check if the insertMissingFields method exists
			if (typeof this.metadataMenuPlugin.api.insertMissingFields === 'function') {
				if (fileClassName) {
					// Get the ancestor chain for this fileClass
					const ancestorChain = await this.getFileClassAncestorChain(fileClassName);
					
					// Insert fields from ancestors first, then the fileClass itself
					// The chain is already in the correct order (most basic ancestor first)
					for (const ancestorName of ancestorChain) {
						console.log(`Inserting missing fields from ancestor: ${ancestorName}`);
						await this.metadataMenuPlugin.api.insertMissingFields(
							file,
							-1, // Insert in frontmatter
							false, // Not as list
							false, // Not as blockquote
							ancestorName // Specific ancestor fileClass
						);
					}
					
					// Finally, insert fields from the main fileClass
					console.log(`Inserting missing fields from main fileClass: ${fileClassName}`);
					await this.metadataMenuPlugin.api.insertMissingFields(
						file,
						-1, // Insert in frontmatter
						false, // Not as list
						false, // Not as blockquote
						fileClassName // Main fileClass
					);
				} else {
					// No specific fileClass, use the generic approach
					await this.metadataMenuPlugin.api.insertMissingFields(
						file,
						-1, // Insert in frontmatter
						false, // Not as list
						false, // Not as blockquote
						fileClassName // Will be undefined
					);
				}
				
				console.log('Missing fields inserted successfully using MetadataMenu API');
			} else {
				console.log('MetadataMenu API method insertMissingFields not available');
			}
		} catch (error) {
			console.error('Error inserting missing fields:', error);
			throw error; // Re-throw error so the caller can handle it
		}
	}

	/**
	 * Determine fileClass from file content and metadata
	 */
	async determineFileClassFromContent(content: string, file: TFile): Promise<string | null> {
		// Get the fileClass alias from MetadataMenu settings
		const fileClassAlias = this.metadataMenuPlugin?.settings?.fileClassAlias || 'fileClass';
		
		// Use the new utility to parse fileClass from content
		const fileClassFromFrontmatter = parseFileClassFromContent(content, fileClassAlias);
		if (fileClassFromFrontmatter) {
			return fileClassFromFrontmatter;
		}

		// Check for tags that might map to fileClasses
		const tagMatches = content.match(/#[\w-]+/g);
		if (tagMatches) {
			for (const tag of tagMatches) {
				const tagName = tag.substring(1); // Remove #
				const fileClass = await this.getFileClassByName(tagName);
				if (fileClass?.mapWithTag) {
					return tagName;
				}
			}
		}

		// Check file path mapping (simplified implementation)
		// This would require accessing MetadataMenu's path mappings
		
		return null;
	}

	/**
	 * Insert missing metadata fields into content using MetadataMenu's API
	 * This replaces the old approach of manually detecting and inserting missing fields
	 */
	async insertMissingMetadata(content: string, file: TFile, settings: AutoMetadataSettings): Promise<string> {
		if (!settings.enableAutoMetadataInsertion || !this.isMetadataMenuAvailable()) {
			return content;
		}

		try {
			// First, determine the fileClass from the file's metadata
			const fileClassName = await this.determineFileClassFromContent(content, file);
			
			// Use MetadataMenu's insertMissingFields API to add missing fields to frontmatter
			// Pass the determined fileClass to ensure correct field insertion
			await this.insertMissingFields(file, fileClassName || undefined);
			
			// Read the updated content after MetadataMenu has inserted the missing fields
			const updatedContent = await this.app.vault.read(file);
			
			// Sort the metadata if requested
			if (settings.insertMissingFieldsOnSort) {
				return sortMetadataInContent(updatedContent, settings);
			}
			
			return updatedContent;
		} catch (error) {
			console.error('Error inserting missing metadata with MetadataMenu API:', error);
			return content;
		}
	}
	
	/**
	 * Process content with both sorting and missing field insertion
	 */
	async processContent(content: string, file: TFile, settings: AutoMetadataSettings): Promise<string> {
		let processedContent = content;

		// Always insert missing metadata when called explicitly
		processedContent = await this.insertMissingMetadata(processedContent, file, settings);

		// Then, sort the metadata
		processedContent = sortMetadataInContent(processedContent, settings);

		return processedContent;
	}

	/**
	 * Get fileClass definition from a fileClass file
	 */
	async parseFileClassDefinition(fileClassFile: TFile): Promise<FileClassDefinition | null> {
		try {
			const content = await this.app.vault.read(fileClassFile);
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			
			if (!frontmatterMatch) {
				return null;
			}

			const frontmatter = yaml.load(frontmatterMatch[1]) as any;
			
			if (!frontmatter || !frontmatter.fields) {
				return null;
			}

			return {
				name: fileClassFile.basename,
				extends: frontmatter.extends,
				excludes: frontmatter.excludes,
				mapWithTag: frontmatter.mapWithTag,
				tagNames: frontmatter.tagNames,
				filePaths: frontmatter.filePaths,
				bookmarkGroups: frontmatter.bookmarkGroups,
				buttonIcon: frontmatter.buttonIcon,
				maxRecordsPerPage: frontmatter.maxRecordsPerPage,
				version: frontmatter.version,
				fields: frontmatter.fields || []
			};
		} catch (error) {
			console.error('Error parsing fileClass definition:', error);
			return null;
		}
	}

	/**
	 * Get all available fileClasses
	 */
	async getAllFileClasses(): Promise<FileClassDefinition[]> {
		if (!this.metadataMenuPlugin?.settings?.classFilesPath) {
			return [];
		}

		const classFilesPath = this.metadataMenuPlugin.settings.classFilesPath;
		const classFolder = this.app.vault.getAbstractFileByPath(classFilesPath);
		
		if (!classFolder || !(classFolder instanceof TFile)) {
			return [];
		}

		const fileClasses: FileClassDefinition[] = [];
		const files = this.app.vault.getMarkdownFiles();
		
		for (const file of files) {
			if (file.path.startsWith(classFilesPath)) {
				const fileClass = await this.parseFileClassDefinition(file);
				if (fileClass) {
					fileClasses.push(fileClass);
				}
			}
		}

		return fileClasses;
	}

	/**
	 * @deprecated Use getDefaultValueForField from field-utils instead
	 */
	getDefaultValueForField(field: MetadataMenuField): any {
		return getDefaultValueForField(field);
	}

	/**
	 * @deprecated Use validateField from field-utils instead
	 */
	validateField(field: MetadataMenuField): boolean {
		return validateField(field);
	}
}
