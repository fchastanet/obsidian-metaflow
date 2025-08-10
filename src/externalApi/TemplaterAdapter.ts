import {App, TFile} from 'obsidian';
import {MetaFlowSettings} from 'src/settings/types';
import {ObsidianAdapter} from './ObsidianAdapter';

export interface FolderTemplate {
  folder: string;
  template: string;
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
  private obsidianAdapter: ObsidianAdapter;
  private TEMPLATER_PLUGIN_NAME = 'templater-obsidian';

  constructor(app: App, settings: MetaFlowSettings) {
    this.app = app;
    this.settings = settings;
    this.templater = this.app.plugins?.plugins?.[this.TEMPLATER_PLUGIN_NAME] || null;
    this.obsidianAdapter = new ObsidianAdapter(app, settings);
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

  getFolderTemplatesMapping(): FolderTemplate[] {
    if (!this.isTemplaterAvailable()) {
      return [];
    }

    return this.templater.settings.folder_templates || [];
  }

  isTemplaterAvailable(): boolean {
    return (this.app.plugins?.enabledPlugins?.has(this.TEMPLATER_PLUGIN_NAME) || false)
      && this.templater !== null
      && typeof this.templater === 'object';
  }

  /**
   * Check Templater configuration consistency
   */
  checkTemplaterConsistency(): {isConsistent: boolean; warnings: string[]} {
    const warnings: string[] = [];
    let isConsistent = true;

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
        const matchingTemplaterMapping = templaterSettings.folder_templates.find((ft: FolderTemplate) =>
          ft.folder === mapping.folder
        );

        if (!matchingTemplaterMapping) {
          warnings.push(`No matching Templater mapping found for folder pattern: ${mapping.folder}`);
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

  private formatDateFallback(date: Date, format?: string) {
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
   * format any javascript date using moment
   * if moment is not available fallback on minimal support
   */
  formatDate(date: Date, format?: string): any {
    const moment = window.moment;
    if (moment) {
      return format ? moment(date).format(format) : moment(date).toISOString();
    }

    // Fallback simple date function
    return this.formatDateFallback(date, format);
  }

  now(format?: string): string {
    const moment = window.moment;
    if (moment) {
      const now = moment();
      return format ? now.format(format) : now.toISOString();
    }

    // Fallback simple date function
    const now = new Date();
    return this.formatDateFallback(now, format);
  }

  tomorrow(format?: string): string {
    const moment = window.moment;
    if (moment) {
      const tomorrow = moment().add(1, 'days');
      return format ? tomorrow.format(format) : tomorrow.toISOString();
    }

    // Fallback simple date function
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.formatDateFallback(tomorrow, format);
  }

  yesterday(format?: string): string {
    const moment = window.moment;
    if (moment) {
      const yesterday = moment().subtract(1, 'days');
      return format ? yesterday.format(format) : yesterday.toISOString();
    }

    // Fallback simple date function
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.formatDateFallback(yesterday, format);
  }

  private isValidMdFile(file: any): file is TFile {
    return file instanceof TFile && file.extension === 'md';
  }

  /**
   * deduce parent file
   */
  getParentFile(currentFile: TFile): string | null {
    const lastActiveFile = this.app.workspace?.lastActiveFile;
    if (lastActiveFile && this.isValidMdFile(lastActiveFile) && lastActiveFile.path !== currentFile.path) {
      return lastActiveFile.path;
    }
    const activeFile = this.app.workspace.getActiveFile();
    let parentFile = null;
    if (currentFile?.path === activeFile?.path) {
      // currentFile is actually active file
      // deduce parent link from previous edited file
      const parentFilePath = this.app.workspace?.recentFileTracker?.lastOpenFiles?.[1];
      if (parentFilePath) {
        parentFile = this.obsidianAdapter.getAbstractFileByPath(parentFilePath);
        if (!parentFile || !(parentFile instanceof TFile)) {
          if (this.settings.debugMode) console.debug('Parent file not found in recent files, using active file as parent');
          parentFile = null;
        }
      }
    } else {
      parentFile = activeFile;
    }
    if (parentFile?.path === currentFile.path) {
      if (this.settings.debugMode) console.debug('Parent file is the same as current file, cannot deduce parent file');
      return null;
    }

    return parentFile?.path || null;
  }
}
