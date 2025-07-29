import { MetadataPropertiesSorterSettingTab } from '../src/settings-tab';
import { DEFAULT_SETTINGS } from '../src/settings';

// Mock Obsidian modules
jest.mock('obsidian', () => ({
	PluginSettingTab: class MockPluginSettingTab {
		app: any;
		plugin: any;
		constructor(app: any, plugin: any) {
			this.app = app;
			this.plugin = plugin;
		}
	},
	Setting: jest.fn().mockImplementation(() => ({
		setName: jest.fn().mockReturnThis(),
		setDesc: jest.fn().mockReturnThis(),
		addToggle: jest.fn().mockReturnThis(),
		addButton: jest.fn().mockReturnThis(),
		addTextArea: jest.fn().mockReturnThis()
	})),
	Notice: jest.fn()
}));

describe('MetadataPropertiesSorterSettingTab', () => {
	let mockApp: any;
	let mockPlugin: any;
	let settingTab: MetadataPropertiesSorterSettingTab;

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks();

		// Create mock app with proper structure
		mockApp = {
			plugins: {
				plugins: {
					'templater-obsidian': {
						templater: {
							settings: {
								folder_templates: [
									{ folder: 'Books', template: 'book-template.md' },
									{ folder: 'Projects/*', template: 'project-template.md' },
									{ folder: 'Notes', template: 'note-template.md' }
								]
							}
						}
					},
					'metadata-menu': {
						settings: {
							fileClassAlias: {
								'book-template': {
									attributes: {
										title: { input: 'text', isCycle: false, values: '', valuesListNotePath: '', command: false },
										author: { input: 'text', isCycle: false, values: '', valuesListNotePath: '', command: false },
										rating: { input: 'number', isCycle: false, values: '', valuesListNotePath: '', command: false }
									}
								},
								'project-template': {
									attributes: {
										title: { input: 'text', isCycle: false, values: '', valuesListNotePath: '', command: false },
										status: { input: 'select', isCycle: false, values: 'Not Started,In Progress,Completed', valuesListNotePath: '', command: false }
									}
								}
							}
						}
					}
				}
			}
		} as any;

		// Create mock plugin
		mockPlugin = {
			app: mockApp,
			settings: {
				folderFileClassMappings: [],
				propertyDefaultValueScripts: [],
				propertiesOrder: []
			},
			saveSettings: jest.fn(),
			autoInserter: {
				isMetadataMenuAvailable: jest.fn().mockReturnValue(true)
			}
		} as any;

		// Create settings tab instance
		settingTab = new MetadataPropertiesSorterSettingTab(mockApp, mockPlugin);
	});	describe('Auto-populate from Templater', () => {
		test('should import folder mappings from Templater settings', async () => {
			// Setup Templater plugin mock
			mockApp.plugins.plugins['templater-obsidian'] = {
				settings: {
					folder_templates: [
						{ folder: 'Books/*', template: 'book-template.md' },
						{ folder: 'Articles/*', template: 'article-template.md' },
						{ folder: 'Notes/*', template: 'note-template.md' }
					]
				}
			};

			// Clear existing mappings
			mockPlugin.settings.folderFileClassMappings = [];

			await settingTab['autoPopulateFolderMappingsFromTemplater']();

			expect(mockPlugin.settings.folderFileClassMappings).toHaveLength(3);
			expect(mockPlugin.settings.folderFileClassMappings[0]).toEqual({
				folderPattern: 'Books/*',
				fileClass: 'book-template',
				isRegex: false
			});
			expect(mockPlugin.settings.folderFileClassMappings[1]).toEqual({
				folderPattern: 'Articles/*',
				fileClass: 'article-template',
				isRegex: false
			});
			expect(mockPlugin.saveSettings).toHaveBeenCalled();
		});

		test('should not duplicate existing mappings', async () => {
			// Setup Templater plugin mock
			mockApp.plugins.plugins['templater-obsidian'] = {
				settings: {
					folder_templates: [
						{ folder: 'Books/*', template: 'book-template.md' }
					]
				}
			};

			// Add existing mapping
			mockPlugin.settings.folderFileClassMappings = [
				{ folderPattern: 'Books/*', fileClass: 'existing-book', isRegex: false }
			];

			await settingTab['autoPopulateFolderMappingsFromTemplater']();

			// Should still have only one mapping (the existing one)
			expect(mockPlugin.settings.folderFileClassMappings).toHaveLength(1);
			expect(mockPlugin.settings.folderFileClassMappings[0].fileClass).toBe('existing-book');
		});

		test('should handle missing Templater plugin gracefully', async () => {
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

			await settingTab['autoPopulateFolderMappingsFromTemplater']();

			// Should not throw error
			expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe('Auto-populate from MetadataMenu', () => {
		test('should import property scripts from MetadataMenu settings', async () => {
			// Setup MetadataMenu plugin mock
			mockApp.plugins.plugins['metadata-menu'] = {
				settings: {
					fileClassesFields: {
						'book': [
							{ name: 'title' },
							{ name: 'author' },
							{ name: 'isbn' }
						],
						'article': [
							{ name: 'title' },
							{ name: 'publication' },
							{ name: 'date' }
						]
					}
				}
			};

			// Clear existing scripts
			mockPlugin.settings.propertyDefaultValueScripts = [];

			await settingTab['autoPopulatePropertyScriptsFromMetadataMenu']();

			// Should have imported unique properties
			expect(mockPlugin.settings.propertyDefaultValueScripts.length).toBeGreaterThan(0);
			
			// Check that title script exists (used by both fileClasses)
			const titleScript = mockPlugin.settings.propertyDefaultValueScripts.find(
				(script: any) => script.propertyName === 'title'
			);
			expect(titleScript).toBeDefined();
			expect(titleScript?.script).toContain('// Used by fileClasses: book, article');
			expect(titleScript?.enabled).toBe(false);

			// Check that author script exists (used by book only)
			const authorScript = mockPlugin.settings.propertyDefaultValueScripts.find(
				(script: any) => script.propertyName === 'author'
			);
			expect(authorScript).toBeDefined();
			expect(authorScript?.script).toContain('// Used by fileClasses: book');

			expect(mockPlugin.saveSettings).toHaveBeenCalled();
		});

		test('should not duplicate existing property scripts', async () => {
			// Setup MetadataMenu plugin mock
			mockApp.plugins.plugins['metadata-menu'] = {
				settings: {
					fileClassesFields: {
						'book': [
							{ name: 'title' }
						]
					}
				}
			};

			// Add existing script
			mockPlugin.settings.propertyDefaultValueScripts = [
				{ propertyName: 'title', script: 'return "existing";', enabled: true, order: 0 }
			];

			await settingTab['autoPopulatePropertyScriptsFromMetadataMenu']();

			// Should still have only one script (the existing one)
			expect(mockPlugin.settings.propertyDefaultValueScripts).toHaveLength(1);
			expect(mockPlugin.settings.propertyDefaultValueScripts[0].script).toBe('return "existing";');
		});

		test('should handle missing MetadataMenu plugin gracefully', async () => {
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
			mockPlugin.autoInserter.isMetadataMenuAvailable.mockReturnValue(false);

			await settingTab['autoPopulatePropertyScriptsFromMetadataMenu']();

			// Should not throw error
			expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe('Display Methods', () => {
		test('should handle empty folder mappings list', () => {
			const mockContainer = {
				empty: jest.fn(),
				createEl: jest.fn().mockReturnValue({
					createEl: jest.fn().mockReturnValue({
						style: {},
						addEventListener: jest.fn(),
						disabled: false,
						checked: false,
						value: ''
					}),
					style: {}
				})
			};

			mockPlugin.settings.folderFileClassMappings = [];

			// Should not throw error
			expect(() => {
				settingTab['displayFolderMappings'](mockContainer as any);
			}).not.toThrow();

			expect(mockContainer.empty).toHaveBeenCalled();
		});

		test('should handle empty property scripts list', () => {
			const mockContainer = {
				empty: jest.fn(),
				createEl: jest.fn().mockReturnValue({
					createEl: jest.fn().mockReturnValue({
						style: {},
						addEventListener: jest.fn(),
						disabled: false,
						checked: false,
						value: ''
					}),
					style: {}
				})
			};

			mockPlugin.settings.propertyDefaultValueScripts = [];

			// Should not throw error
			expect(() => {
				settingTab['displayPropertyScripts'](mockContainer as any);
			}).not.toThrow();

			expect(mockContainer.empty).toHaveBeenCalled();
		});
	});
});
