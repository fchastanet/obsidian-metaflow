import {injectable, inject} from 'inversify';
import type {App} from 'obsidian';
import {TFile} from 'obsidian';
import type {MetaFlowSettings} from '../settings/types';
import {MetadataMenuField, MetadataMenuPluginInterface} from './types.MetadataMenu';
import {MetaFlowException} from '../MetaFlowException';
import {LogManagerInterface} from 'src/managers/types';
import {TYPES} from '../di/types';

export interface FieldsFileClassAssociation {
  [fieldName: string]: {
    fileClasses: string[],
  }
};

export interface Frontmatter {
  [fieldName: string]: any;
};

@injectable()
export class MetadataMenuAdapter {
  private app: App;
  private settings: MetaFlowSettings
  private METADATA_MENU_PLUGIN_NAME = 'metadata-menu';

  constructor(
    @inject(TYPES.App) app: App,
    @inject(TYPES.MetaFlowSettings) settings: MetaFlowSettings
  ) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Check if MetadataMenu integration is available
   */
  isMetadataMenuAvailable(): boolean {
    const metadataMenuPlugin = this.app.plugins?.plugins?.[this.METADATA_MENU_PLUGIN_NAME];
    if (
      this.app.plugins?.enabledPlugins?.has(this.METADATA_MENU_PLUGIN_NAME) &&
      metadataMenuPlugin?.api &&
      typeof metadataMenuPlugin.api === 'object' &&
      metadataMenuPlugin?.settings &&
      typeof metadataMenuPlugin.settings === 'object'
    ) {
      return true;
    }
    return false;
  }

  /**
   * Initialize the MetadataMenu plugin integration
   */
  getMetadataMenuPlugin(): MetadataMenuPluginInterface {
    if (!this.isMetadataMenuAvailable()) {
      throw new MetaFlowException('MetadataMenu integration is not enabled or plugin is not available', 'info');
    }
    return this.app.plugins?.plugins?.[this.METADATA_MENU_PLUGIN_NAME];
  }

  getAllFieldsFileClassesAssociation(): FieldsFileClassAssociation {
    const metadataMenuPlugin = this.getMetadataMenuPlugin();
    if (!metadataMenuPlugin.fieldIndex?.fileClassesFields ||
      typeof metadataMenuPlugin.fieldIndex.fileClassesFields === 'undefined'
    ) {
      throw new MetaFlowException('No fileClass definitions found in MetadataMenu', 'warning');
    }

    const fileClassesFields = metadataMenuPlugin.fieldIndex.fileClassesFields;
    const allFields: FieldsFileClassAssociation = {};

    // Collect all properties and which fileClasses use them
    fileClassesFields.forEach(
      (fields: {name: string}[], fileClass: string) => {
        fields.forEach((field) => {
          if (!allFields[field.name]) {
            allFields[field.name] = {
              fileClasses: [],
            };
          }
          allFields[field.name].fileClasses.push(fileClass);
        });
      }
    );

    return allFields;
  }

  /**
   * sync metadata fields
   * This method adds missing fields and remove obsolete empty fields to the frontmatter variable
   * supports inserting fields from fileClass ancestors in the correct order:
   * 1. Most basic ancestor fields first (e.g., "default-basic")
   * 2. More specific ancestor fields (e.g., "default")
   * 3. Finally the main fileClass fields (e.g., "book")
   */
  syncFields(frontmatter: Frontmatter, fileClassName: string, logManager: LogManagerInterface): Frontmatter {
    if (!this.isMetadataMenuAvailable()) {
      throw new MetaFlowException('MetadataMenu integration is not enabled or plugin is not available', 'info');
    }

    try {
      const allFields = this.getFileClassAndAncestorsFields(fileClassName, logManager);

      // Step 2: Remove empty properties that are not part of the new fileClass
      const fieldsToRemove = Object.keys(frontmatter).filter(key => {
        // Check if the field is not in the new fileClass fields
        return !allFields.some(field => field.name === key) && (
          frontmatter[key] === undefined || frontmatter[key] === null || frontmatter[key] === ''
        );
      });
      for (const fieldToRemove of fieldsToRemove) {
        delete frontmatter[fieldToRemove];
      }

      // Step 3: Add missing fields from the ancestor chain
      for (const field of allFields) {
        if (!(field.name in frontmatter)) {
          frontmatter[field.name] = null; // Initialize missing fields with undefined
        }
      }

      return frontmatter;
    } catch (error) {
      console.error('Error inserting missing fields:', error);
      throw error; // Re-throw error so the caller can handle it
    }
  }

  public getFileClassAndAncestorsFields(fileClass: string, logManager: LogManagerInterface): MetadataMenuField[] {
    // Get the ancestor chain for this fileClass
    const ancestorChain = this.getFileClassAncestorChain(fileClass, logManager);
    const allFields: MetadataMenuField[] = [];

    // Step 1: Get all fields for the fileClass and its ancestors
    // The chain is already in the correct order (most basic ancestor first)
    for (const ancestorName of ancestorChain) {
      if (this.settings.debugMode) console.debug(`Inserting missing fields from ancestor: ${ancestorName}`);
      // get metadataMenu fileClass fields configuration
      const fileClassFields = this.getFileClassFields(ancestorName);
      allFields.push(...fileClassFields);
    }

    return allFields;
  }

  private getFileClassFields(fileClass: string): MetadataMenuField[] {
    const metadataMenuPlugin = this.getMetadataMenuPlugin();
    if (!metadataMenuPlugin.fieldIndex?.fileClassesFields ||
      typeof metadataMenuPlugin.fieldIndex.fileClassesFields === 'undefined'
    ) {
      throw new MetaFlowException('No fileClass definitions found in MetadataMenu', 'warning');
    }
    return metadataMenuPlugin.fieldIndex.fileClassesFields.get(fileClass) || [];
  }

  getAllFields(): Map<string, MetadataMenuField & {fileClasses?: string[]}> {
    const metadataMenuPlugin = this.getMetadataMenuPlugin();
    if (!metadataMenuPlugin.fieldIndex?.fileClassesFields ||
      typeof metadataMenuPlugin.fieldIndex.fileClassesFields === 'undefined'
    ) {
      throw new MetaFlowException('No fileClass definitions found in MetadataMenu', 'warning');
    }
    let allFields: Map<string, MetadataMenuField & {fileClasses?: string[]}> = new Map();
    metadataMenuPlugin.fieldIndex.fileClassesFields.forEach(
      (fields: MetadataMenuField[], fc: string) => {
        fields.forEach((field) => {
          if (!allFields.has(field.name)) {
            allFields.set(field.name, {...field, fileClasses: [fc]});
          } else {
            allFields.get(field.name)!.fileClasses!.push(fc);
          }
        });
      }
    );
    return allFields;
  }

  /**
   * Get the ancestor chain for a fileClass in the correct order for field insertion
   * Returns ancestors from most basic to most specific (e.g., ["default-basic", "default"])
   */
  private getFileClassAncestorChain(fileClassName: string, logManager: LogManagerInterface): string[] {
    try {
      const metadataMenuPlugin = this.getMetadataMenuPlugin();
      // Access MetadataMenu's fieldIndex.fileClassesAncestors
      const fieldIndex = metadataMenuPlugin.fieldIndex;
      if (!fieldIndex?.fileClassesAncestors) {
        logManager.addWarning('MetadataMenu fieldIndex.fileClassesAncestors not available');
        return [fileClassName];
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
      orderedAncestors.push(fileClassName); // Add the main fileClass at the end

      return orderedAncestors;

    } catch (error) {
      console.error('Error getting fileClass ancestor chain:', error);
      return [];
    }
  }

  /**
   * Get fileClass from metadata based on MetadataMenu fileClass alias
   */
  getFileClassFromMetadata(metadata: any): string | null {
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }
    const fileClassAlias = this.getFileClassAlias();
    return metadata[fileClassAlias] || null;
  }

  getFileClassAlias(): string {
    const settings = this.getMetadataMenuPlugin()?.settings;
    if (!settings || typeof settings !== 'object') {
      throw new MetaFlowException('MetadataMenu settings not available', 'error');
    }
    return settings.fileClassAlias || 'fileClass';
  }

  /**
   * Get fileClass by name
   */
  getFileClassByName(name: string): MetadataMenuField[] {
    const fileClassesFields = this.getMetadataMenuPlugin()?.fieldIndex?.fileClassesFields;

    if (!fileClassesFields || !(fileClassesFields instanceof Map)) {
      throw new MetaFlowException('MetadataMenu fileClassesFields settings not available', 'error');
    }

    if (fileClassesFields.has(name)) {
      return fileClassesFields.get(name) || [];
    }

    throw new MetaFlowException(`File class "${name}" not found in MetadataMenu`, 'warning');
  }

}
