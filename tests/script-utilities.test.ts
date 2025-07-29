import { ScriptUtilities } from '../src/script-utilities';
import { DEFAULT_SETTINGS } from '../src/settings';

// Mock Obsidian modules
jest.mock('obsidian', () => ({
	TFile: jest.fn()
}));

describe('ScriptUtilities', () => {
	let mockApp: any;
	let scriptUtilities: ScriptUtilities;

	beforeEach(() => {
		// Setup mock app
		mockApp = {
			plugins: {
				plugins: {}
			},
			fileManager: {
				generateMarkdownLink: jest.fn((file, path) => `[[${file.name}]]`)
			}
		};

		scriptUtilities = new ScriptUtilities(mockApp, DEFAULT_SETTINGS);
	});

	describe('Language Detection', () => {
		test('should detect English text', () => {
			const englishText = "The quick brown fox jumps over the lazy dog and runs away";
			const result = scriptUtilities.detectLanguage(englishText);
			expect(result).toBe('en');
		});

		test('should detect French text', () => {
			const frenchText = "Le chat qui mange le poisson dans la maison avec les enfants et nous avons";
			const result = scriptUtilities.detectLanguage(frenchText);
			expect(result).toBe('fr');
		});

		test('should detect Spanish text', () => {
			const spanishText = "El gato que come el pescado en la casa con los niños";
			const result = scriptUtilities.detectLanguage(spanishText);
			expect(result).toBe('es');
		});

		test('should detect German text', () => {
			const germanText = "Der Hund läuft durch den Park und spielt mit den Kindern";
			const result = scriptUtilities.detectLanguage(germanText);
			expect(result).toBe('de');
		});

		test('should detect Italian text', () => {
			const italianText = "Il cane che corre nel parco e gioca con i bambini";
			const result = scriptUtilities.detectLanguage(italianText);
			expect(result).toBe('it');
		});

		test('should return unknown for empty text', () => {
			const result = scriptUtilities.detectLanguage('');
			expect(result).toBe('unknown');
		});

		test('should return unknown for ambiguous text', () => {
			const ambiguousText = "xyz abc def ghi jkl mno";
			const result = scriptUtilities.detectLanguage(ambiguousText);
			expect(result).toBe('unknown');
		});
	});

	describe('Templater Integration', () => {
		test('should detect Templater availability when plugin exists', () => {
			mockApp.plugins.plugins['templater-obsidian'] = {
				settings: {},
				templater: {}
			};
			
			const result = scriptUtilities.isTemplaterAvailable();
			expect(result).toBe(true);
		});

		test('should detect Templater unavailability when plugin missing', () => {
			const result = scriptUtilities.isTemplaterAvailable();
			expect(result).toBe(false);
		});

		test('should return null date function when Templater integration disabled', () => {
			const settings = { ...DEFAULT_SETTINGS, enableTemplaterIntegration: false };
			const utilities = new ScriptUtilities(mockApp, settings);
			
			const dateFunction = utilities.getTemplaterDateFunction();
			expect(dateFunction).toBeNull();
		});

		test('should return fallback date function when Templater not available', () => {
			const settings = { ...DEFAULT_SETTINGS, enableTemplaterIntegration: true };
			const utilities = new ScriptUtilities(mockApp, settings);
			
			const dateFunction = utilities.getTemplaterDateFunction();
			expect(dateFunction).toBeDefined();
			expect(dateFunction.now).toBeDefined();
			expect(dateFunction.tomorrow).toBeDefined();
			expect(dateFunction.yesterday).toBeDefined();
		});

		test('should format dates correctly with fallback date function', () => {
			const settings = { ...DEFAULT_SETTINGS, enableTemplaterIntegration: true };
			const utilities = new ScriptUtilities(mockApp, settings);
			
			const dateFunction = utilities.getTemplaterDateFunction();
			const formatted = dateFunction.now('YYYY-MM-DD');
			
			// Should match YYYY-MM-DD format
			expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});
	});

	describe('Markdown Link Generation', () => {
		test('should generate markdown link', () => {
			const mockFile = { name: 'target.md' };
			const mockSourceFile = { path: 'source.md' };
			
			const result = scriptUtilities.generateMarkdownLink(mockFile as any, mockSourceFile as any);
			expect(result).toBe('[[target.md]]');
			expect(mockApp.fileManager.generateMarkdownLink).toHaveBeenCalledWith(mockFile, 'source.md');
		});

		test('should generate markdown link without source file', () => {
			const mockFile = { name: 'target.md' };
			
			const result = scriptUtilities.generateMarkdownLink(mockFile as any);
			expect(result).toBe('[[target.md]]');
			expect(mockApp.fileManager.generateMarkdownLink).toHaveBeenCalledWith(mockFile, '');
		});
	});

	describe('Prompt Function', () => {
		test('should create prompt function', () => {
			const promptFunction = scriptUtilities.createPromptFunction();
			expect(typeof promptFunction).toBe('function');
		});
	});

	describe('Get All Utilities', () => {
		test('should return all utilities object', () => {
			const utilities = scriptUtilities.getAllUtilities();
			
			expect(utilities).toHaveProperty('date');
			expect(utilities).toHaveProperty('generateMarkdownLink');
			expect(utilities).toHaveProperty('detectLanguage');
			expect(utilities).toHaveProperty('prompt');
			expect(typeof utilities.generateMarkdownLink).toBe('function');
			expect(typeof utilities.detectLanguage).toBe('function');
			expect(typeof utilities.prompt).toBe('function');
		});
	});
});
