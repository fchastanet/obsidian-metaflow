import {TFile} from "obsidian";
import {MetaFlowSettings, FolderFileClassMapping} from "../settings/types";
import {ScriptContextService} from "./ScriptContextService";
import {LogManagerInterface} from "../managers/types";

export class NoteTitleService {
  private metaFlowSettings: MetaFlowSettings;
  private scriptContextService: ScriptContextService;

  constructor(
    metaFlowSettings: MetaFlowSettings,
    scriptContextService: ScriptContextService
  ) {
    this.metaFlowSettings = metaFlowSettings;
    this.scriptContextService = scriptContextService;
  }

  /**
   * Format note title based on FolderFileClassMappings configuration
   * @param file - The file to format title for
   * @param fileClass - The file class
   * @param metadata - The metadata object
   * @param logManager - Log manager for reporting
   * @returns Formatted title or "Untitled" if generation fails
   */
  formatNoteTitle(
    file: TFile,
    fileClass: string,
    metadata: {[key: string]: any},
    logManager: LogManagerInterface
  ): string {
    const DEFAULT_TITLE = "Untitled";

    try {
      // Find the folder mapping for this file class
      const mapping = this.metaFlowSettings.folderFileClassMappings.find(
        m => m.fileClass === fileClass
      );

      if (!mapping) {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: No folder mapping found for fileClass "${fileClass}"`);
        }
        return DEFAULT_TITLE;
      }

      if (mapping.templateMode === 'script') {
        return this.formatNoteTitleByScript(file, fileClass, metadata, mapping, logManager);
      } else {
        return this.formatNoteTitleByTemplate(file, fileClass, metadata, mapping, logManager);
      }
    } catch (error) {
      console.error(`MetaFlow: Error formatting note title: ${error.message}`);
      return DEFAULT_TITLE;
    }
  }

  /**
   * Format note title using script mode
   */
  private formatNoteTitleByScript(
    file: TFile,
    fileClass: string,
    metadata: {[key: string]: any},
    mapping: FolderFileClassMapping,
    logManager: LogManagerInterface
  ): string {
    const DEFAULT_TITLE = "Untitled";

    if (!mapping.noteTitleScript?.enabled || !mapping.noteTitleScript?.script) {
      if (this.metaFlowSettings.debugMode) {
        console.debug(`MetaFlow: Note title script is disabled or empty for fileClass "${fileClass}"`);
      }
      return DEFAULT_TITLE;
    }

    try {
      // Get script context
      const context = this.scriptContextService.getScriptContext(
        file,
        fileClass,
        metadata,
        logManager
      );

      // Execute script
      const executeScript = new Function(
        'context',
        `
        return ((context) => {
          const { ${Object.keys(context).join(', ')} } = context;
          ${mapping.noteTitleScript.script}
        })(context);
        `
      );

      const result = executeScript(context);

      // Validate result
      if (typeof result !== 'string') {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: Note title script returned non-string value (${typeof result}) for fileClass "${fileClass}"`);
        }
        return DEFAULT_TITLE;
      }

      if (!result.trim()) {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: Note title script returned empty string for fileClass "${fileClass}"`);
        }
        return DEFAULT_TITLE;
      }

      // Validate filename
      const sanitizedTitle = this.sanitizeFilename(result.trim());
      if (!sanitizedTitle) {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`MetaFlow: Note title script result "${result}" is not a valid filename for fileClass "${fileClass}"`);
        }
        return DEFAULT_TITLE;
      }

      return sanitizedTitle;
    } catch (error) {
      console.error(`MetaFlow: Error executing note title script for fileClass "${fileClass}": ${error.message}`);
      return DEFAULT_TITLE;
    }
  }

  /**
   * Format note title using template mode
   */
  private formatNoteTitleByTemplate(
    file: TFile,
    fileClass: string,
    metadata: {[key: string]: any},
    mapping: FolderFileClassMapping,
    logManager: LogManagerInterface
  ): string {
    const DEFAULT_TITLE = "Untitled";

    if (!mapping.noteTitleTemplates?.length) {
      if (this.metaFlowSettings.debugMode) {
        console.debug(`MetaFlow: No note title templates defined for fileClass "${fileClass}"`);
      }
      return DEFAULT_TITLE;
    }

    // Try each enabled template in order
    for (const template of mapping.noteTitleTemplates) {
      if (!template.enabled || !template.template?.trim()) {
        continue;
      }

      try {
        const result = this.processTemplate(template.template, metadata, fileClass);

        if (result) {
          const sanitizedTitle = this.sanitizeFilename(result);
          if (sanitizedTitle) {
            return sanitizedTitle;
          } else {
            if (this.metaFlowSettings.debugMode) {
              console.debug(`MetaFlow: Template result "${result}" is not a valid filename for fileClass "${fileClass}"`);
            }
          }
        } else {
          if (this.metaFlowSettings.debugMode) {
            console.debug(`MetaFlow: Template "${template.template}" could not be processed due to missing metadata for fileClass "${fileClass}"`);
          }
        }
      } catch (error) {
        console.error(`MetaFlow: Error processing template "${template.template}" for fileClass "${fileClass}": ${error.message}`);
      }
    }

    return DEFAULT_TITLE;
  }

  /**
   * Process a template string by replacing placeholders with metadata values
   * @param template - Template string with {{property}} placeholders
   * @param metadata - Metadata object
   * @param fileClass - File class for debug logging
   * @returns Processed template or null if required metadata is missing
   */
  private processTemplate(template: string, metadata: {[key: string]: any}, fileClass: string): string | null {
    // Find all placeholders in the template
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders = [];
    let match;

    while ((match = placeholderRegex.exec(template)) !== null) {
      placeholders.push(match[1].trim());
    }

    // Check if all required metadata is available
    for (const placeholder of placeholders) {
      const value = metadata?.[placeholder];
      if (value === undefined || value === null || value === '') {
        // Required metadata is missing
        return null;
      }
    }

    // Replace all placeholders with actual values
    let result = template;
    for (const placeholder of placeholders) {
      const value = metadata[placeholder];
      const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
      result = result.replace(new RegExp(`\\{\\{\\s*${placeholder}\\s*\\}\\}`, 'g'), stringValue);
    }

    return result.trim();
  }

  /**
   * Sanitize filename to be valid for Obsidian
   * @param filename - Original filename
   * @returns Sanitized filename or empty string if invalid
   */
  private sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return '';
    }

    // Remove or replace invalid characters for filesystem
    // Obsidian doesn't allow: \ / : * ? " < > |
    const sanitized = filename
      .replace(/[\\/:*?"<>|]/g, '')  // Remove forbidden characters
      .replace(/\s+/g, ' ')          // Collapse multiple spaces
      .trim();

    // Check for reserved names and empty strings
    if (!sanitized ||
      sanitized === '.' ||
      sanitized === '..' ||
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(sanitized)) {
      return '';
    }

    // Limit length to reasonable size (Obsidian has filesystem limits)
    return sanitized.substring(0, 255);
  }
}
