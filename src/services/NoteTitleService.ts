import {injectable, inject} from 'inversify';
import {FrontMatterCache, TFile} from "obsidian";
import type {MetaFlowSettings, FolderFileClassMapping} from "@metaflow/settings/types";
import type {ScriptContextService} from "./ScriptContextService";
import type {LogNoticeManagerInterface} from "@metaflow/managers/types";
import {TYPES} from '@metaflow/di/types';
import {ObsidianAdapter} from '@metaflow/externalApi/ObsidianAdapter';

@injectable()
export class NoteTitleService {
  constructor(
    @inject(TYPES.MetaFlowSettings) private settings: MetaFlowSettings,
    @inject(TYPES.ScriptContextService) private scriptContextService: ScriptContextService,
    @inject(TYPES.LogNoticeManagerInterface) private logNoticeManager: LogNoticeManagerInterface,
    @inject(TYPES.ObsidianAdapter) private obsidianAdapter: ObsidianAdapter,
  ) { }

  /**
   * Format note title based on FolderFileClassMappings configuration
   * @param file - The file to format title for
   * @param fileClass - The file class
   * @param metadata - The metadata object
   * @param logNoticeManager - Log manager for reporting
   * @returns Formatted title or "Untitled" if generation fails
   */
  formatNoteTitle(
    file: TFile,
    fileClass: string,
    metadata: FrontMatterCache
  ): string {
    const DEFAULT_TITLE = "Untitled";

    try {
      // Find the folder mapping for this file class
      const mapping = this.settings.folderFileClassMappings.find(
        m => m.fileClass === fileClass
      );

      if (!mapping) {
        (this.settings.debugMode) && console.debug(`MetaFlow: No folder mapping found for fileClass "${fileClass}"`);
        return DEFAULT_TITLE;
      }

      if (mapping.templateMode === 'script') {
        return this.formatNoteTitleByScript(file, fileClass, metadata, mapping);
      } else {
        return this.formatNoteTitleByTemplate(file, fileClass, metadata, mapping);
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
    metadata: FrontMatterCache,
    mapping: FolderFileClassMapping
  ): string {
    const DEFAULT_TITLE = "Untitled";

    if (!mapping.noteTitleScript?.enabled || !mapping.noteTitleScript?.script) {
      (this.settings.debugMode) && console.debug(`MetaFlow: Note title script is disabled or empty for fileClass "${fileClass}"`);
      return DEFAULT_TITLE;
    }

    try {
      // Get script context
      const context = this.scriptContextService.getScriptContext(
        file,
        fileClass,
        metadata
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
        (this.settings.debugMode) && console.debug(`MetaFlow: Note title script returned non-string value (${typeof result}) for fileClass "${fileClass}"`);
        return DEFAULT_TITLE;
      }

      if (!result.trim()) {
        (this.settings.debugMode) && console.debug(`MetaFlow: Note title script returned empty string for fileClass "${fileClass}"`);
        return DEFAULT_TITLE;
      }

      // Validate filename
      const sanitizedTitle = this.obsidianAdapter.normalizePath(result.trim());
      if (!sanitizedTitle) {
        (this.settings.debugMode) && console.debug(`MetaFlow: Note title script result "${result}" is not a valid filename for fileClass "${fileClass}"`);
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
    metadata: FrontMatterCache,
    mapping: FolderFileClassMapping
  ): string {
    const DEFAULT_TITLE = "Untitled";

    if (!mapping.noteTitleTemplates?.length) {
      (this.settings.debugMode) && console.debug(`MetaFlow: No note title templates defined for fileClass "${fileClass}"`);
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
          const sanitizedTitle = this.obsidianAdapter.normalizePath(result);
          if (sanitizedTitle) {
            return sanitizedTitle;
          } else {
            (this.settings.debugMode) && console.debug(`MetaFlow: Template result "${result}" is not a valid filename for fileClass "${fileClass}"`);
          }
        } else {
          (this.settings.debugMode) && console.debug(`MetaFlow: Template "${template.template}" could not be processed due to missing metadata for fileClass "${fileClass}"`);
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
  private processTemplate(template: string, metadata: FrontMatterCache, fileClass: string): string | null {
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
}
