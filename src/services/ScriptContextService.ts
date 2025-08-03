import {App, TFile} from 'obsidian';
import {TemplaterAdapter} from '../externalApi/TemplaterAdapter';
import {ObsidianAdapter} from '../externalApi/ObsidianAdapter';
import {MetaFlowSettings} from '../settings/types';


export interface ScriptContextInterface {
  fileClass: string;
  file: any; // TFile
  metadata: {[key: string]: any};
  prompt: (message: string, defaultValue?: string) => Promise<string>;
  formatDate: (date: Date, format?: string) => any; // Templater date function
  generateMarkdownLink: (file: any) => string;
  detectLanguage: (text: string) => string;
  now: () => string;
  tomorrow: () => string;
  yesterday: () => string;
  getParentFile: (file: TFile) => string;
}


export class ScriptContextService {
  private templaterAdapter: TemplaterAdapter;
  private obsidianAdapter: ObsidianAdapter;

  constructor(app: App, settings: MetaFlowSettings) {
    this.templaterAdapter = new TemplaterAdapter(app, settings);
    this.obsidianAdapter = new ObsidianAdapter(app, settings);
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
      {lang: 'English', count: englishCount},
      {lang: 'French', count: frenchCount},
      {lang: 'Spanish', count: spanishCount},
      {lang: 'German', count: germanCount},
      {lang: 'Italian', count: italianCount}
    ];

    counts.sort((a, b) => b.count - a.count);

    // Return the language with highest count if it's significantly higher
    if (counts[0].count > counts[1].count && counts[0].count > 0) {
      return counts[0].lang;
    }

    return 'English';
  }

  /**
   * Get all available utility functions for script context
   */
  getScriptContext(
    file: TFile,
    fileClass: string,
    metadata: {[key: string]: any}
  ): ScriptContextInterface {
    return {
      file,
      fileClass,
      metadata,
      now: this.templaterAdapter.now.bind(this.templaterAdapter),
      formatDate: this.templaterAdapter.formatDate.bind(this.templaterAdapter),
      tomorrow: this.templaterAdapter.tomorrow.bind(this.templaterAdapter),
      yesterday: this.templaterAdapter.yesterday.bind(this.templaterAdapter),
      generateMarkdownLink: this.obsidianAdapter.generateMarkdownLink.bind(this.obsidianAdapter),
      detectLanguage: this.detectLanguage.bind(this),
      prompt: this.templaterAdapter.prompt.bind(this.templaterAdapter),
      getParentFile: this.templaterAdapter.getParentFile.bind(this.templaterAdapter),
    };
  }
}
