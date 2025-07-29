// Mock metadata-sorter module first
const mockSortMetadataInContent = jest.fn((content, settings) => content);
const mockSortProperties = jest.fn((metadata, settings) => metadata);

jest.mock('../src/metadata-sorter', () => ({
	sortMetadataInContent: mockSortMetadataInContent,
	sortProperties: mockSortProperties
}));

import { MetadataAutoInserter } from '../src/metadata-auto-inserter';
import { MetadataMenuField, FileClassDefinition, MetadataMenuPluginInterface, AutoMetadataSettings } from '../src/types';

// Mock Obsidian types
interface MockVault {
	read: jest.Mock;
	modify: jest.Mock;
	getMarkdownFiles: jest.Mock;
	getAbstractFileByPath: jest.Mock;
}

interface MockApp {
	vault: MockVault;
	plugins: {
		plugins: Record<string, any>;
	};
}

interface MockTFile {
	basename: string;
	extension: string;
	path: string;
}

// Create mock constructors
const createMockApp = (): MockApp => ({
	vault: {
		read: jest.fn(),
		modify: jest.fn(),
		getMarkdownFiles: jest.fn(),
		getAbstractFileByPath: jest.fn()
	},
	plugins: {
		plugins: {}
	}
});

const createMockFile = (basename: string = 'test-file', extension: string = 'md'): MockTFile => ({
	basename,
	extension,
	path: `${basename}.${extension}`
});

describe('MetadataAutoInserter', () => {
	let autoInserter: MetadataAutoInserter;
	let mockApp: MockApp;
	let mockFile: MockTFile;
	let mockMetadataMenuPlugin: {
		settings: {
			fileClassAlias: string;
			classFilesPath: string;
			globalFileClass?: string;
		};
		api: {
			getFileClass: jest.Mock;
			getFileClassByName: jest.Mock;
			getFieldsForFile: jest.Mock;
			insertMissingFields: jest.Mock;
		};
	};

	const defaultSettings: AutoMetadataSettings = {
		propertyOrder: ['title', 'date', 'status', 'type'],
		autoSortOnView: true,
		sortUnknownPropertiesLast: true,
		enableAutoMetadataInsertion: true,
		insertMissingFieldsOnSort: true,
		useMetadataMenuDefaults: true,
		metadataMenuIntegration: true
	};

	const sampleFields: MetadataMenuField[] = [
		{
			name: 'title',
			type: 'Input',
			id: 'field-1',
			path: 'title',
			defaultValue: 'Untitled'
		},
		{
			name: 'status',
			type: 'Select',
			id: 'field-2',
			path: 'status',
			options: {
				'0': 'draft',
				'1': 'review',
				'2': 'published'
			}
		},
		{
			name: 'tags',
			type: 'MultiSelect',
			id: 'field-3',
			path: 'tags'
		},
		{
			name: 'created',
			type: 'DateTime',
			id: 'field-4',
			path: 'created'
		}
	];

	const sampleFileClass: FileClassDefinition = {
		name: 'article',
		mapWithTag: true,
		tagNames: ['article'],
		fields: sampleFields
	};

	beforeEach(() => {
		// Create fresh mocks
		mockApp = createMockApp();
		mockFile = createMockFile();

		// Mock MetadataMenu Plugin
		mockMetadataMenuPlugin = {
			settings: {
				fileClassAlias: 'fileClass',
				classFilesPath: 'fileClasses',
				globalFileClass: undefined
			},
			api: {
				getFileClass: jest.fn(),
				getFileClassByName: jest.fn(),
				getFieldsForFile: jest.fn(),
				insertMissingFields: jest.fn()
			}
		};

		// Create autoInserter with mocked app
		autoInserter = new MetadataAutoInserter(mockApp as any);
	});

	describe('initialization', () => {
		test('should initialize without MetadataMenu plugin', () => {
			expect(autoInserter.isMetadataMenuAvailable()).toBe(false);
		});

		test('should initialize with MetadataMenu plugin', async () => {
			mockApp.plugins.plugins['metadata-menu'] = mockMetadataMenuPlugin;
			
			const success = await autoInserter.initializeMetadataMenuIntegration();
			
			expect(success).toBe(true);
			expect(autoInserter.isMetadataMenuAvailable()).toBe(true);
		});

		test('should handle missing MetadataMenu plugin', async () => {
			const success = await autoInserter.initializeMetadataMenuIntegration();
			
			expect(success).toBe(false);
			expect(autoInserter.isMetadataMenuAvailable()).toBe(false);
		});
	});

	describe('fileClass operations', () => {
		beforeEach(async () => {
			mockApp.plugins.plugins['metadata-menu'] = mockMetadataMenuPlugin;
			await autoInserter.initializeMetadataMenuIntegration();
		});

		test('should get fileClass for file', async () => {
			mockMetadataMenuPlugin.api.getFileClass.mockResolvedValue(sampleFileClass);
			
			const result = await autoInserter.getFileClass(mockFile as any);
			
			expect(result).toEqual(sampleFileClass);
			expect(mockMetadataMenuPlugin.api.getFileClass).toHaveBeenCalledWith(mockFile);
		});

		test('should get fileClass by name', async () => {
			mockMetadataMenuPlugin.api.getFileClassByName.mockResolvedValue(sampleFileClass);
			
			const result = await autoInserter.getFileClassByName('article');
			
			expect(result).toEqual(sampleFileClass);
			expect(mockMetadataMenuPlugin.api.getFileClassByName).toHaveBeenCalledWith('article');
		});

		test('should insert missing fields using MetadataMenu API', async () => {
			mockMetadataMenuPlugin.api.insertMissingFields.mockResolvedValue(undefined);
			
			await autoInserter.insertMissingFields(mockFile as any);
			
			expect(mockMetadataMenuPlugin.api.insertMissingFields).toHaveBeenCalledWith(
				mockFile,
				-1, // Insert in frontmatter
				false, // Not as list
				false, // Not as blockquote
				undefined // No specific fileClass
			);
		});

		test('should handle API errors gracefully', async () => {
			mockMetadataMenuPlugin.api.getFileClass.mockRejectedValue(new Error('API Error'));
			
			const result = await autoInserter.getFileClass(mockFile as any);
			
			expect(result).toBeNull();
		});
	});

	describe('fileClass determination from content', () => {
		beforeEach(async () => {
			mockApp.plugins.plugins['metadata-menu'] = mockMetadataMenuPlugin;
			await autoInserter.initializeMetadataMenuIntegration();
		});

		test('should determine fileClass from frontmatter', async () => {
			const content = `---
fileClass: article
title: Test Article
---

Content here`;
			
			const result = await autoInserter.determineFileClassFromContent(content, mockFile as any);
			
			expect(result).toBe('article');
		});

		test('should determine fileClass from array in frontmatter', async () => {
			const content = `---
fileClass:
  - article
  - blog
title: Test Article
---

Content here`;
			
			const result = await autoInserter.determineFileClassFromContent(content, mockFile as any);
			
			expect(result).toBe('article');
		});

		test('should determine fileClass from tags', async () => {
			const content = `---
title: Test Article
---

#article

Content here`;
			
			mockMetadataMenuPlugin.api.getFileClassByName.mockResolvedValue(sampleFileClass);
			
			const result = await autoInserter.determineFileClassFromContent(content, mockFile as any);
			
			expect(result).toBe('article');
		});

		test('should return null when no fileClass found', async () => {
			const content = `---
title: Test Article
---

Content here`;
			
			const result = await autoInserter.determineFileClassFromContent(content, mockFile as any);
			
			expect(result).toBeNull();
		});
	});

	describe('default value generation', () => {
		test('should generate correct default values for different field types', () => {
			const testCases = [
				{ type: 'Input', expected: '' },
				{ type: 'Number', expected: 0 },
				{ type: 'Boolean', expected: false },
				{ type: 'Date', expected: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
				{ type: 'DateTime', expected: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
				{ type: 'MultiSelect', expected: [] },
				{ type: 'MultiFile', expected: [] },
				{ type: 'File', expected: '' },
				{ type: 'JSON', expected: {} },
				{ type: 'Object', expected: {} },
				{ type: 'ObjectList', expected: [] },
				{ type: 'YAML', expected: [] }
			] as const;

			testCases.forEach(({ type, expected }) => {
				const field: MetadataMenuField = {
					name: 'test',
					type: type,
					id: 'test-id',
					path: 'test'
				};
				
				const result = autoInserter.getDefaultValueForField(field);
				expect(result).toEqual(expected);
			});
		});

		test('should use field default value when provided', () => {
			const field: MetadataMenuField = {
				name: 'test',
				type: 'Input',
				id: 'test-id',
				path: 'test',
				defaultValue: 'Custom Default'
			};
			
			const result = autoInserter.getDefaultValueForField(field);
			expect(result).toBe('Custom Default');
		});

		test('should use first option for Select fields', () => {
			const field: MetadataMenuField = {
				name: 'status',
				type: 'Select',
				id: 'status-id',
				path: 'status',
				options: {
					'0': 'draft',
					'1': 'published'
				}
			};
			
			const result = autoInserter.getDefaultValueForField(field);
			expect(result).toBe('draft');
		});
	});

	describe('MetadataMenu API integration', () => {
		beforeEach(async () => {
			mockApp.plugins.plugins['metadata-menu'] = mockMetadataMenuPlugin;
			await autoInserter.initializeMetadataMenuIntegration();
		});

		test('should use MetadataMenu API to insert missing fields', async () => {
			// Setup mocks
			mockMetadataMenuPlugin.api.insertMissingFields.mockResolvedValue(undefined);
			mockApp.vault.read.mockResolvedValue(`---
title: Test Title
status: draft
tags: [tag1, tag2]
created: 2023-01-01
---

Content here`);

			const content = `---
title: Existing Title
---

Content here`;
			
			const result = await autoInserter.insertMissingMetadata(content, mockFile as any, defaultSettings);
			
			// Should call MetadataMenu's insertMissingFields API with no specific fileClass
			// since the content doesn't have a fileClass property
			expect(mockMetadataMenuPlugin.api.insertMissingFields).toHaveBeenCalledWith(
				mockFile,
				-1, // Insert in frontmatter
				false, // Not as list
				false, // Not as blockquote
				undefined // No fileClass detected in content
			);
			
			// Should return the updated content read from the file
			expect(result).toContain('status: draft');
			expect(result).toContain('tags: [tag1, tag2]');
			expect(result).toContain('created: 2023-01-01');
		});

		test('should detect and pass fileClass when present in content', async () => {
			// Setup mocks
			mockMetadataMenuPlugin.api.insertMissingFields.mockResolvedValue(undefined);
			mockApp.vault.read.mockResolvedValue(`---
title: Test Title
fileClass: article
status: draft
tags: [tag1, tag2]
---

Content here`);

			const content = `---
title: Existing Title
fileClass: article
---

Content here`;
			
			const result = await autoInserter.insertMissingMetadata(content, mockFile as any, defaultSettings);
			
			// Should call MetadataMenu's insertMissingFields API with the detected fileClass
			expect(mockMetadataMenuPlugin.api.insertMissingFields).toHaveBeenCalledWith(
				mockFile,
				-1, // Insert in frontmatter
				false, // Not as list
				false, // Not as blockquote
				'article' // FileClass detected from content
			);
			
			// Should return the updated content
			expect(result).toContain('fileClass: article');
		});

		test('should use custom fileClass alias when configured', async () => {
			// Configure custom fileClass alias
			mockMetadataMenuPlugin.settings.fileClassAlias = 'template';
			
			// Setup mocks
			mockMetadataMenuPlugin.api.insertMissingFields.mockResolvedValue(undefined);
			mockApp.vault.read.mockResolvedValue(`---
title: Test Title
template: blog-post
status: draft
---

Content here`);

			const content = `---
title: Existing Title
template: blog-post
---

Content here`;
			
			const result = await autoInserter.insertMissingMetadata(content, mockFile as any, defaultSettings);
			
			// Should call MetadataMenu's insertMissingFields API with the fileClass detected using custom alias
			expect(mockMetadataMenuPlugin.api.insertMissingFields).toHaveBeenCalledWith(
				mockFile,
				-1, // Insert in frontmatter
				false, // Not as list
				false, // Not as blockquote
				'blog-post' // FileClass detected using custom alias 'template'
			);
			
			// Should return the updated content
			expect(result).toContain('template: blog-post');
			
			// Reset alias for other tests
			mockMetadataMenuPlugin.settings.fileClassAlias = 'fileClass';
		});

		test('should handle when MetadataMenu API fails gracefully', async () => {
			const content = `---
title: Existing Title
---

Content here`;
			
			// Make API call fail
			mockMetadataMenuPlugin.api.insertMissingFields.mockRejectedValue(new Error('API Error'));
			
			const result = await autoInserter.insertMissingMetadata(content, mockFile as any, defaultSettings);
			
			// Should return original content when API fails
			expect(result).toBe(content);
		});

		test('should not call API when auto insertion is disabled', async () => {
			const content = `---
title: Existing Title
---

Content here`;
			
			const settings = { ...defaultSettings, enableAutoMetadataInsertion: false };
			
			const result = await autoInserter.insertMissingMetadata(content, mockFile as any, settings);
			
			// Should not call the API
			expect(mockMetadataMenuPlugin.api.insertMissingFields).not.toHaveBeenCalled();
			
			// Should return original content
			expect(result).toBe(content);
		});
	});

	describe('metadata insertion with MetadataMenu API', () => {
		beforeEach(async () => {
			mockApp.plugins.plugins['metadata-menu'] = mockMetadataMenuPlugin;
			await autoInserter.initializeMetadataMenuIntegration();
		});

		test('should use MetadataMenu API and return updated content', async () => {
			const content = `---
title: Existing Title
---

Content here`;
			
			// Mock the API call and updated file content
			mockMetadataMenuPlugin.api.insertMissingFields.mockResolvedValue(undefined);
			mockApp.vault.read.mockResolvedValue(`---
title: Existing Title
status: draft
tags: []
created: 2023-01-01
---

Content here`);
			
			const result = await autoInserter.insertMissingMetadata(content, mockFile as any, defaultSettings);
			
			// Should call MetadataMenu's API
			expect(mockMetadataMenuPlugin.api.insertMissingFields).toHaveBeenCalledWith(
				mockFile,
				-1, // Insert in frontmatter
				false, // Not as list
				false, // Not as blockquote
				undefined // No specific fileClass
			);
			
			// Should return the updated content from the file
			expect(result).toContain('status: draft');
			expect(result).toContain('tags: []');
			expect(result).toContain('created: 2023-01-01');
		});

		test('should sort metadata when insertMissingFieldsOnSort is enabled', async () => {
			const content = `---
title: Existing Title
---

Content here`;
			
			const updatedContent = `---
title: Existing Title
status: draft
tags: []
---

Content here`;
			
			// Mock the API call and updated file content
			mockMetadataMenuPlugin.api.insertMissingFields.mockResolvedValue(undefined);
			mockApp.vault.read.mockResolvedValue(updatedContent);
			mockSortMetadataInContent.mockReturnValue('sorted content');
			
			const result = await autoInserter.insertMissingMetadata(content, mockFile as any, defaultSettings);
			
			// Should call MetadataMenu's API first with fileClass detection
			expect(mockMetadataMenuPlugin.api.insertMissingFields).toHaveBeenCalledWith(
				mockFile,
				-1, // Insert in frontmatter
				false, // Not as list
				false, // Not as blockquote
				undefined // No fileClass in content
			);
			
			// Should then sort the content
			expect(mockSortMetadataInContent).toHaveBeenCalledWith(updatedContent, defaultSettings);
			expect(result).toBe('sorted content');
		});

		test('should handle content without frontmatter', async () => {
			const content = `Content without frontmatter`;
			
			const updatedContent = `---
title: Untitled
status: draft
---

Content without frontmatter`;
			
			// Disable sorting for this test to check the raw inserted content
			const settings = { ...defaultSettings, insertMissingFieldsOnSort: false };
			
			// Mock the API call and updated file content
			mockMetadataMenuPlugin.api.insertMissingFields.mockResolvedValue(undefined);
			mockApp.vault.read.mockResolvedValue(updatedContent);
			
			const result = await autoInserter.insertMissingMetadata(content, mockFile as any, settings);
			
			expect(result).toContain('---\n');
			expect(result).toContain('title: Untitled');
			expect(result).toContain('status: draft');
			expect(result).toContain('---\n\nContent without frontmatter');
		});

		test('should not insert when auto insertion is disabled', async () => {
			const content = `---
title: Existing Title
---

Content here`;
			
			const settings = { ...defaultSettings, enableAutoMetadataInsertion: false };
			
			const result = await autoInserter.insertMissingMetadata(content, mockFile as any, settings);
			
			// Should not call the API
			expect(mockMetadataMenuPlugin.api.insertMissingFields).not.toHaveBeenCalled();
			expect(result).toBe(content);
		});

		test('should not insert when MetadataMenu is not available', async () => {
			const content = `---
title: Existing Title
---

Content here`;
			
			// Don't initialize MetadataMenu
			const uninitializedInserter = new MetadataAutoInserter(mockApp as any);
			
			const result = await uninitializedInserter.insertMissingMetadata(content, mockFile as any, defaultSettings);
			
			expect(result).toBe(content);
		});
	});

	describe('field validation', () => {
		test('should validate valid fields', () => {
			const validField: MetadataMenuField = {
				name: 'title',
				type: 'Input',
				id: 'field-1',
				path: 'title'
			};
			
			expect(autoInserter.validateField(validField)).toBe(true);
		});

		test('should reject invalid fields', () => {
			const invalidFields = [
				{ name: '', type: 'Input', id: 'field-1', path: 'title' },
				{ name: 'title', type: '', id: 'field-1', path: 'title' },
				{ name: 'title', type: 'Input', id: '', path: 'title' }
			] as MetadataMenuField[];
			
			invalidFields.forEach(field => {
				expect(autoInserter.validateField(field)).toBe(false);
			});
		});
	});

	describe('fileClass definition parsing', () => {
		test('should parse fileClass definition from file', async () => {
			const fileClassContent = `---
extends: base
mapWithTag: true
tagNames: [article, blog]
fields:
  - name: title
    type: Input
    id: field-1
    path: title
  - name: status
    type: Select
    id: field-2
    path: status
    options:
      "0": draft
      "1": published
---

This is a fileClass definition file.`;
			
			const mockFileClassFile = {
				basename: 'article'
			} as MockTFile;
			
			mockApp.vault.read.mockResolvedValue(fileClassContent);
			
			const result = await autoInserter.parseFileClassDefinition(mockFileClassFile as any);
			
			expect(result).not.toBeNull();
			expect(result?.name).toBe('article');
			expect(result?.extends).toBe('base');
			expect(result?.mapWithTag).toBe(true);
			expect(result?.tagNames).toEqual(['article', 'blog']);
			expect(result?.fields).toHaveLength(2);
		});

		test('should handle malformed fileClass definition', async () => {
			const invalidContent = `---
invalid yaml content
---`;
			
			const mockFileClassFile = {
				basename: 'invalid'
			} as MockTFile;
			
			mockApp.vault.read.mockResolvedValue(invalidContent);
			
			const result = await autoInserter.parseFileClassDefinition(mockFileClassFile as any);
			
			expect(result).toBeNull();
		});
	});

	describe('integration with metadata sorting', () => {
		beforeEach(async () => {
			mockApp.plugins.plugins['metadata-menu'] = mockMetadataMenuPlugin;
			await autoInserter.initializeMetadataMenuIntegration();
		});

		test('should process content with both insertion and sorting', async () => {
			const content = `---
title: Test
---

Content`;
			
			mockSortMetadataInContent.mockReturnValue('sorted content');
			
			jest.spyOn(autoInserter, 'insertMissingMetadata').mockResolvedValue('inserted content');
			
			const result = await autoInserter.processContent(content, mockFile as any, defaultSettings);
			
			expect(result).toBe('sorted content');
			expect(autoInserter.insertMissingMetadata).toHaveBeenCalledWith(content, mockFile, defaultSettings);
			expect(mockSortMetadataInContent).toHaveBeenCalledWith('inserted content', defaultSettings);
		});

		test('should only sort when insertion is disabled', async () => {
			const content = `---
title: Test
---

Content`;
			
			const settings = { ...defaultSettings, enableAutoMetadataInsertion: false };
			mockSortMetadataInContent.mockReturnValue('sorted content');
			
			const result = await autoInserter.processContent(content, mockFile as any, settings);
			
			expect(result).toBe('sorted content');
			expect(mockSortMetadataInContent).toHaveBeenCalledWith(content, settings);
		});
	});

	describe('fileClass ancestor chain handling', () => {
		let mockMetadataMenuPluginWithAncestors: any;

		beforeEach(async () => {
			// Create a mock plugin with fieldIndex
			mockMetadataMenuPluginWithAncestors = {
				...mockMetadataMenuPlugin,
				fieldIndex: {
					fileClassesAncestors: new Map([
						['reference', ['default-basic']],
						['moc', ['default', 'default-basic']],
						['note', ['default', 'default-basic']],
						['default', ['default-basic']],
						['default-basic', []],
						['book', ['default', 'default-basic']]
					])
				}
			};
			
			mockApp.plugins.plugins['metadata-menu'] = mockMetadataMenuPluginWithAncestors;
			await autoInserter.initializeMetadataMenuIntegration();
		});

		test('should get correct ancestor chain for fileClass with ancestors', async () => {
			const ancestors = await autoInserter.getFileClassAncestorChain('book');
			
			// For 'book', ancestors are ['default', 'default-basic']
			// We want to insert in order: default-basic -> default -> book
			// So getFileClassAncestorChain should return ['default-basic', 'default']
			expect(ancestors).toEqual(['default-basic', 'default']);
		});

		test('should get empty array for fileClass with no ancestors', async () => {
			const ancestors = await autoInserter.getFileClassAncestorChain('default-basic');
			
			expect(ancestors).toEqual([]);
		});

		test('should get single ancestor for fileClass with one ancestor', async () => {
			const ancestors = await autoInserter.getFileClassAncestorChain('reference');
			
			expect(ancestors).toEqual(['default-basic']);
		});

		test('should handle non-existent fileClass', async () => {
			const ancestors = await autoInserter.getFileClassAncestorChain('non-existent');
			
			expect(ancestors).toEqual([]);
		});

		test('should insert fields from ancestors in correct order', async () => {
			mockMetadataMenuPluginWithAncestors.api.insertMissingFields.mockResolvedValue(undefined);
			
			await autoInserter.insertMissingFields(mockFile as any, 'book');
			
			// Should call insertMissingFields for each ancestor first, then the main fileClass
			expect(mockMetadataMenuPluginWithAncestors.api.insertMissingFields).toHaveBeenCalledTimes(3);
			
			// First call: most basic ancestor
			expect(mockMetadataMenuPluginWithAncestors.api.insertMissingFields).toHaveBeenNthCalledWith(1,
				mockFile, -1, false, false, 'default-basic'
			);
			
			// Second call: intermediate ancestor
			expect(mockMetadataMenuPluginWithAncestors.api.insertMissingFields).toHaveBeenNthCalledWith(2,
				mockFile, -1, false, false, 'default'
			);
			
			// Third call: main fileClass
			expect(mockMetadataMenuPluginWithAncestors.api.insertMissingFields).toHaveBeenNthCalledWith(3,
				mockFile, -1, false, false, 'book'
			);
		});

		test('should handle fieldIndex as object instead of Map', async () => {
			// Test with object-based fieldIndex instead of Map
			mockMetadataMenuPluginWithAncestors.fieldIndex.fileClassesAncestors = {
				'book': ['default', 'default-basic'],
				'default-basic': []
			};
			
			const ancestors = await autoInserter.getFileClassAncestorChain('book');
			
			expect(ancestors).toEqual(['default-basic', 'default']);
		});

		test('should handle missing fieldIndex gracefully', async () => {
			// Create a plugin without fieldIndex
			const pluginWithoutFieldIndex = {
				...mockMetadataMenuPlugin
			};
			
			mockApp.plugins.plugins['metadata-menu'] = pluginWithoutFieldIndex;
			await autoInserter.initializeMetadataMenuIntegration();
			
			const ancestors = await autoInserter.getFileClassAncestorChain('book');
			
			expect(ancestors).toEqual([]);
		});
	});
});
