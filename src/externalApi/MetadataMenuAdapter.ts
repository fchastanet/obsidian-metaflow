import {App, TFile} from 'obsidian';
import {MetaFlowSettings} from '../settings/types';
import {MetadataMenuField, MetadataMenuPluginInterface} from './types.MetadataMenu';
import {MetaFlowException} from '../MetaFlowException';

export interface FieldsFileClassAssociation {
  [fieldName: string]: {
    fileClasses: string[],
  }
};

export interface Frontmatter {
  [fieldName: string]: any;
};

export class MetadataMenuAdapter {
  private app: App;
  private metadataMenuPlugin: MetadataMenuPluginInterface;
  private METADATA_MENU_PLUGIN_NAME = 'metadata-menu';

  constructor(app: App) {
    this.app = app;
    this.metadataMenuPlugin = (this.app as any).plugins?.plugins?.[this.METADATA_MENU_PLUGIN_NAME];
  }

  /**
   * Check if MetadataMenu integration is available
   */
  isMetadataMenuAvailable(): boolean {
    const metadataMenuPlugin = (this.app as any).plugins?.plugins?.[this.METADATA_MENU_PLUGIN_NAME];
    if (
      (this.app as any)?.plugins?.enabledPlugins?.has(this.METADATA_MENU_PLUGIN_NAME) &&
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
      throw new MetaFlowException('MetadataMenu integration is not enabled or plugin is not available');
    }
    return (this.app as any).plugins.plugins[this.METADATA_MENU_PLUGIN_NAME];
  }

  getAllFieldsFileClassesAssociation(): FieldsFileClassAssociation {
    this.checkMetadataMenuAvailable();
    if (!this.metadataMenuPlugin.fieldIndex?.fileClassesFields ||
      typeof this.metadataMenuPlugin.fieldIndex.fileClassesFields === 'undefined'
    ) {
      throw new MetaFlowException('No fileClass definitions found in MetadataMenu');
    }

    const fileClassesFields = this.metadataMenuPlugin.fieldIndex.fileClassesFields;
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
   * Insert missing metadata fields
   * This method adds missing fields to the frontmatter variable
   * supports inserting fields from fileClass ancestors in the correct order:
   * 1. Most basic ancestor fields first (e.g., "default-basic")
   * 2. More specific ancestor fields (e.g., "default")
   * 3. Finally the main fileClass fields (e.g., "book")
   */
  insertMissingFields(frontmatter: Frontmatter, fileClassName: string): Frontmatter {
    if (!this.isMetadataMenuAvailable()) {
      throw new MetaFlowException('MetadataMenu integration is not enabled or plugin is not available');
    }

    try {
      // Get the ancestor chain for this fileClass
      const ancestorChain = this.getFileClassAncestorChain(fileClassName);

      // Insert fields from ancestors first, then the fileClass itself
      // The chain is already in the correct order (most basic ancestor first)
      for (const ancestorName of ancestorChain) {
        console.debug(`Inserting missing fields from ancestor: ${ancestorName}`);
        frontmatter = this.insertFileClassMissingFields(
          frontmatter,
          ancestorName, // Specific ancestor fileClass
        );
      }

      // Finally, insert fields from the main fileClass
      console.debug(`Inserting missing fields from main fileClass: ${fileClassName}`);
      frontmatter = this.insertFileClassMissingFields(
        frontmatter,
        fileClassName, // Main fileClass
      );

      return frontmatter;
    } catch (error) {
      console.error('Error inserting missing fields:', error);
      throw error; // Re-throw error so the caller can handle it
    }
  }

  insertFileClassMissingFields(frontmatter: Frontmatter, fileClassName: string): Frontmatter {
    if (!this.isMetadataMenuAvailable()) {
      throw new MetaFlowException('MetadataMenu integration is not enabled or plugin is not available');
    }
    // get metadataMenu fileClass fields configuration
    const fileClassFields = this.getFileClassFields(fileClassName);
    if (!fileClassFields || fileClassFields.length === 0) {
      throw new MetaFlowException(`No fields found for fileClass: ${fileClassName}`);
    }

    // Insert each field into the frontmatter
    for (const field of fileClassFields) {
      if (field.name && !frontmatter[field.name]) {
        frontmatter[field.name] = null;
      }
    }

    return frontmatter;
  }

  private checkMetadataMenuAvailable() {
    if (!this.isMetadataMenuAvailable()) {
      throw new MetaFlowException('MetadataMenu integration is not enabled or plugin is not available');
    }
  }

  private getFileClassFields(fileClass: string): MetadataMenuField[] {
    this.checkMetadataMenuAvailable();
    if (!this.metadataMenuPlugin.fieldIndex?.fileClassesFields ||
      typeof this.metadataMenuPlugin.fieldIndex.fileClassesFields === 'undefined'
    ) {
      throw new MetaFlowException('No fileClass definitions found in MetadataMenu');
    }
    return this.metadataMenuPlugin.fieldIndex.fileClassesFields.get(fileClass) || [];
  }

  /**
   * Get the ancestor chain for a fileClass in the correct order for field insertion
   * Returns ancestors from most basic to most specific (e.g., ["default-basic", "default"])
   */
  private getFileClassAncestorChain(fileClassName: string): string[] {
    try {
      // Access MetadataMenu's fieldIndex.fileClassesAncestors
      const fieldIndex = (this.metadataMenuPlugin as any)?.fieldIndex;
      if (!fieldIndex?.fileClassesAncestors) {
        console.log('MetadataMenu fieldIndex.fileClassesAncestors not available');
        return [];
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
      throw new MetaFlowException('MetadataMenu settings not available');
    }
    return settings.fileClassAlias || 'fileClass';
  }

  /**
   * Get fileClass by name
   */
  getFileClassByName(name: string): MetadataMenuField[] {
    const fileClassesFields = this.getMetadataMenuPlugin()?.fieldIndex?.fileClassesFields;

    if (!fileClassesFields || !(fileClassesFields instanceof Map)) {
      throw new MetaFlowException('MetadataMenu fileClassesFields settings not available');
    }

    if (fileClassesFields.has(name)) {
      return fileClassesFields.get(name) || [];
    }

    throw new MetaFlowException(`File class "${name}" not found in MetadataMenu`);
  }

}
