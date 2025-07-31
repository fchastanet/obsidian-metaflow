import {App} from 'obsidian';
import {MetaFlowSettings} from 'src/settings/types';

export interface FolderTemplate {
  fileClass: string;
  templatePath: string;
  isRegex: boolean;
}

export interface FileTemplate {
  regex: string;
  template: string;
}

export interface TemplaterSettingsInterface {
  folder_templates: FolderTemplate[];
  file_templates: FileTemplate[];
}

export class TemplaterAdapter {
  private app: App;
  private settings: MetaFlowSettings;
  private templater: {
    [x: string]: any;
    prompt(title: string): Promise<string>
  };
  private TEMPLATER_PLUGIN_NAME = 'templater-obsidian';

  constructor(app: App, settings: MetaFlowSettings) {
    this.app = app;
    this.settings = settings;
    this.templater = (this.app as any).plugins?.plugins?.[this.TEMPLATER_PLUGIN_NAME] || null;
  }

  getTemplaterSettings(): TemplaterSettingsInterface {
    if (!this.templater) {
      return {
        folder_templates: [],
        file_templates: [],
      };
    }
    return this.templater.settings;
  }

  isTemplaterAvailable(): boolean {
    return this.settings.enableTemplaterIntegration
      && (this.app as any)?.plugins?.enabledPlugins?.has(this.TEMPLATER_PLUGIN_NAME)
      && this.templater !== null
      && typeof this.templater === 'object';
  }

  /**
   * Check Templater configuration consistency
   */
  async checkTemplaterConsistency(): Promise<{isConsistent: boolean; warnings: string[]}> {
    const warnings: string[] = [];
    let isConsistent = true;

    if (!this.settings.enableTemplaterIntegration) {
      return {isConsistent: true, warnings: []};
    }

    if (!this.isTemplaterAvailable()) {
      warnings.push('Templater plugin not found but integration is enabled');
      return {isConsistent: false, warnings};
    }

    // Check if Templater has folder template mappings that match our fileClass mappings
    // This is a simplified check - you might need to adapt based on Templater's actual structure
    try {
      const templaterSettings = this.getTemplaterSettings();

      // Compare with our mappings
      for (const mapping of this.settings.folderFileClassMappings) {
        const matchingTemplaterMapping = templaterSettings.file_templates.find((ft: FileTemplate) =>
          ft.regex === mapping.folderPattern
        );

        if (!matchingTemplaterMapping) {
          warnings.push(`No matching Templater mapping found for folder pattern: ${mapping.folderPattern}`);
          isConsistent = false;
        }
      }
    } catch (error) {
      console.error('Error checking Templater consistency:', error);
      warnings.push('Error accessing Templater settings');
      isConsistent = false;
    }

    return {isConsistent, warnings};
  }

  /**
   * Create a prompt function for scripts
   */
  async prompt(message: string, defaultValue: string = ''): Promise<string> {
    if (!this.isTemplaterAvailable()) {
      return defaultValue;
    }
    return this.templater.prompt(message);
  }

  private dateFormatFallback(date: Date, format?: string) {
    if (!format) {
      return date.toISOString();
    }
    // Basic format support - you might want to use a proper date formatting library
    return format
      .replace('YYYY', date.getFullYear().toString())
      .replace('MM', (date.getMonth() + 1).toString().padStart(2, '0'))
      .replace('DD', date.getDate().toString().padStart(2, '0'))
      .replace('HH', date.getHours().toString().padStart(2, '0'))
      .replace('mm', date.getMinutes().toString().padStart(2, '0'))
      .replace('ss', date.getSeconds().toString().padStart(2, '0'));
  }

  /**
   * Get Templater date function if available
   */
  date(format?: string): any {
    if (this.isTemplaterAvailable() && this.templater?.functions_generator?.internal_functions?.modules?.date) {
      return this.templater.functions_generator.internal_functions.modules.date(format);
    }

    // Fallback simple date function
    const now = new Date();
    if (format) {
      return this.dateFormatFallback(now, format);
    }
    return now.toISOString();
  }

  now(format?: string): string {
    const now = new Date();
    return this.dateFormatFallback(now, format);
  }

  tomorrow(format?: string): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.dateFormatFallback(tomorrow, format);
  }

  yesterday(format?: string): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.dateFormatFallback(yesterday, format);
  }
}
