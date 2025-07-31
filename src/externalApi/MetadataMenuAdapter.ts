import {App, TFile} from 'obsidian';
import {MetaFlowSettings} from '../settings/types';
import {MetadataMenuField, MetadataMenuPluginInterface} from './types.MetadataMenu';
import {MetaFlowException} from '../MetaFlowException';

export class MetadataMenuAdapter {
  private app: App;
  private metaFlowSettings: MetaFlowSettings;
  private metadataMenuPlugin: MetadataMenuPluginInterface | null = null;
  private METADATA_MENU_PLUGIN_NAME = 'metadata-menu';

  constructor(app: App, metaFlowSettings: MetaFlowSettings) {
    this.app = app;
    this.metaFlowSettings = metaFlowSettings;
  }

  /**
   * Check if MetadataMenu integration is available
   */
  isMetadataMenuAvailable(): boolean {
    const metadataMenuPlugin = (this.app as any).plugins?.plugins?.[this.METADATA_MENU_PLUGIN_NAME];
    if (
      this.metaFlowSettings.metadataMenuIntegration &&
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


  /**
   * Insert missing metadata fields using MetadataMenu's insertMissingFields API
   * This method adds missing fields directly to the frontmatter at the top of the file
   * Now supports inserting fields from fileClass ancestors in the correct order:
   * 1. Most basic ancestor fields first (e.g., "default-basic")
   * 2. More specific ancestor fields (e.g., "default")
   * 3. Finally the main fileClass fields (e.g., "book")
   */
  async insertMissingFields(file: TFile, fileClassName?: string): Promise<void> {
    if (!this.metadataMenuPlugin?.api) {
      console.log('MetadataMenu API not available for inserting missing fields');
      return;
    }

    try {
      // Check if the insertMissingFields method exists
      if (typeof this.metadataMenuPlugin.api.insertMissingFields === 'function') {
        if (fileClassName) {
          // Get the ancestor chain for this fileClass
          const ancestorChain = await this.getFileClassAncestorChain(fileClassName);

          // Insert fields from ancestors first, then the fileClass itself
          // The chain is already in the correct order (most basic ancestor first)
          for (const ancestorName of ancestorChain) {
            console.log(`Inserting missing fields from ancestor: ${ancestorName}`);
            await this.metadataMenuPlugin.api.insertMissingFields(
              file,
              -1, // Insert in frontmatter
              false, // Not as list
              false, // Not as blockquote
              ancestorName // Specific ancestor fileClass
            );
          }

          // Finally, insert fields from the main fileClass
          console.log(`Inserting missing fields from main fileClass: ${fileClassName}`);
          await this.metadataMenuPlugin.api.insertMissingFields(
            file,
            -1, // Insert in frontmatter
            false, // Not as list
            false, // Not as blockquote
            fileClassName // Main fileClass
          );
        } else {
          // No specific fileClass, use the generic approach
          await this.metadataMenuPlugin.api.insertMissingFields(
            file,
            -1, // Insert in frontmatter
            false, // Not as list
            false, // Not as blockquote
            fileClassName // Will be undefined
          );
        }

        console.log('Missing fields inserted successfully using MetadataMenu API');
      } else {
        console.log('MetadataMenu API method insertMissingFields not available');
      }
    } catch (error) {
      console.error('Error inserting missing fields:', error);
      throw error; // Re-throw error so the caller can handle it
    }
  }


  /**
   * Get the ancestor chain for a fileClass in the correct order for field insertion
   * Returns ancestors from most basic to most specific (e.g., ["default-basic", "default"])
   */
  async getFileClassAncestorChain(fileClassName: string): Promise<string[]> {
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

      console.log(`FileClass "${fileClassName}" has ancestors:`, ancestors);
      console.log(`Insertion order will be:`, [...orderedAncestors, fileClassName]);

      return orderedAncestors;

    } catch (error) {
      console.error('Error getting fileClass ancestor chain:', error);
      return [];
    }
  }

  /**
   * Generate default value for a field based on its type
   */
  getDefaultValueForField(field: MetadataMenuField): any {
    if (field.defaultValue !== undefined) {
      return field.defaultValue;
    }

    switch (field.type) {
      case 'Input':
        return '';
      case 'Number':
        return 0;
      case 'Boolean':
        return false;
      case 'Date':
      case 'DateTime':
        return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      case 'Select':
        // Return first option if available
        if (field.options && Object.keys(field.options).length > 0) {
          const firstKey = Object.keys(field.options)[0];
          return field.options[firstKey];
        }
        return '';
      case 'MultiSelect':
      case 'MultiFile':
        return [];
      case 'File':
        return '';
      case 'JSON':
      case 'Object':
        return {};
      case 'ObjectList':
      case 'YAML':
        return [];
      default:
        return '';
    }
  }

  /**
   * Validate field configuration
   */
  validateField(field: MetadataMenuField): boolean {
    return !!(field.name && field.type && field.id);
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
