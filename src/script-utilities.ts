import { App, TFile } from 'obsidian';
import { MetadataSettings } from './types';

export class ScriptUtilities {
	private app: App;
	private settings: MetadataSettings;

	constructor(app: App, settings: MetadataSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Get Templater date function if available
	 */
	getTemplaterDateFunction(): any {
		if (!this.settings.enableTemplaterIntegration) {
			return null;
		}

		const templater = this.getTemplaterPlugin();
		if (templater?.templater?.functions_generator?.internal_functions?.modules?.date) {
			return templater.templater.functions_generator.internal_functions.modules.date;
		}

		// Fallback simple date function
		return {
			now: (format?: string) => {
				const now = new Date();
				if (format) {
					// Basic format support - you might want to use a proper date formatting library
					return format
						.replace('YYYY', now.getFullYear().toString())
						.replace('MM', (now.getMonth() + 1).toString().padStart(2, '0'))
						.replace('DD', now.getDate().toString().padStart(2, '0'))
						.replace('HH', now.getHours().toString().padStart(2, '0'))
						.replace('mm', now.getMinutes().toString().padStart(2, '0'))
						.replace('ss', now.getSeconds().toString().padStart(2, '0'));
				}
				return now.toISOString();
			},
			tomorrow: (format?: string) => {
				const tomorrow = new Date();
				tomorrow.setDate(tomorrow.getDate() + 1);
				if (format) {
					return format
						.replace('YYYY', tomorrow.getFullYear().toString())
						.replace('MM', (tomorrow.getMonth() + 1).toString().padStart(2, '0'))
						.replace('DD', tomorrow.getDate().toString().padStart(2, '0'))
						.replace('HH', tomorrow.getHours().toString().padStart(2, '0'))
						.replace('mm', tomorrow.getMinutes().toString().padStart(2, '0'))
						.replace('ss', tomorrow.getSeconds().toString().padStart(2, '0'));
				}
				return tomorrow.toISOString();
			},
			yesterday: (format?: string) => {
				const yesterday = new Date();
				yesterday.setDate(yesterday.getDate() - 1);
				if (format) {
					return format
						.replace('YYYY', yesterday.getFullYear().toString())
						.replace('MM', (yesterday.getMonth() + 1).toString().padStart(2, '0'))
						.replace('DD', yesterday.getDate().toString().padStart(2, '0'))
						.replace('HH', yesterday.getHours().toString().padStart(2, '0'))
						.replace('mm', yesterday.getMinutes().toString().padStart(2, '0'))
						.replace('ss', yesterday.getSeconds().toString().padStart(2, '0'));
				}
				return yesterday.toISOString();
			},
			weekday: (format?: string, weekday?: number, reference?: string) => {
				// Simple implementation - in a real scenario you might want more complex date calculations
				const date = new Date();
				if (format) {
					return format
						.replace('YYYY', date.getFullYear().toString())
						.replace('MM', (date.getMonth() + 1).toString().padStart(2, '0'))
						.replace('DD', date.getDate().toString().padStart(2, '0'));
				}
				return date.toISOString();
			}
		};
	}

	/**
	 * Generate a markdown link to a file
	 */
	generateMarkdownLink(targetFile: TFile, sourceFile?: TFile): string {
		const sourcePath = sourceFile ? sourceFile.path : '';
		return this.app.fileManager.generateMarkdownLink(targetFile, sourcePath);
	}

	/**
	 * Basic language detection
	 */
	detectLanguage(text: string): string {
		if (!text) return 'English';

		// Simple heuristic-based language detection
		const lowercaseText = text.toLowerCase();

		// Check for non-Latin scripts
		if (/[\u4e00-\u9fff]/.test(text)) return "Chinese";
		if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "Japanese";
		if (/[\u0400-\u04ff]/.test(text)) return "Russian";
		if (/[\u0590-\u05ff]/.test(text)) return "Hebrew";
		if (/[\u0600-\u06ff]/.test(text)) return "Arabic";

		// Common English words
		const englishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with', 'for', 'as', 'are', 'was', 'but', 'or'];
		// Common French words
		const frenchWords = ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'son', 'une', 'qui', 'sur', 'avec', 'ne', 'se', 'pas', 'tout', 'la', 'du', 'des', 'les', 'au', 'aux', 'je', 'tu', 'nous', 'vous', 'ils', 'elles'];
		// Common Spanish words
		const spanishWords = ['el', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por'];
		// Common German words
		const germanWords = ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'eine'];
		// Common Italian words
		const italianWords = ['il', 'di', 'che', 'e', 'la', 'a', 'un', 'in', 'per', 'è', 'con', 'da', 'del', 'le', 'si', 'non'];

		let englishCount = 0;
		let frenchCount = 0;
		let spanishCount = 0;
		let germanCount = 0;
		let italianCount = 0;

		const words = lowercaseText.split(/\s+/).slice(0, 150); // Check first 100 words

		for (const word of words) {
			if (englishWords.includes(word)) englishCount++;
			if (frenchWords.includes(word)) frenchCount++;
			if (spanishWords.includes(word)) spanishCount++;
			if (germanWords.includes(word)) germanCount++;
			if (italianWords.includes(word)) italianCount++;
		}

		// Find the language with the highest count
		const counts = [
			{ lang: 'English', count: englishCount },
			{ lang: 'French', count: frenchCount },
			{ lang: 'Spanish', count: spanishCount },
			{ lang: 'German', count: germanCount },
			{ lang: 'Italian', count: italianCount }
		];

		counts.sort((a, b) => b.count - a.count);

		// Return the language with highest count if it's significantly higher
		if (counts[0].count > counts[1].count && counts[0].count > 0) {
			return counts[0].lang;
		}

		return 'English';
	}

	/**
	 * Create a prompt function for scripts
	 */
	createPromptFunction() {
		return async (message: string, defaultValue: string = ''): Promise<string> => {
			return new Promise((resolve) => {
				// Simple implementation - in a real plugin you might want a proper modal
				const result = prompt(message, defaultValue);
				resolve(result || defaultValue);
			});
		};
	}

	/**
	 * Get Templater plugin instance
	 */
	getTemplaterPlugin(): any {
		return (this.app as any).plugins?.plugins?.['templater-obsidian'];
	}

	/**
	 * Check if Templater plugin is available
	 */
	isTemplaterAvailable(): boolean {
		return !!(this.app as any).plugins?.plugins?.['templater-obsidian'];
	}

	/**
	 * Get all available utility functions for script context
	 */
	getAllUtilities() {
		return {
			date: this.getTemplaterDateFunction(),
			generateMarkdownLink: this.generateMarkdownLink.bind(this),
			detectLanguage: this.detectLanguage.bind(this),
			prompt: this.createPromptFunction()
		};
	}
}
