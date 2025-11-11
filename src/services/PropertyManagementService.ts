import {injectable, inject} from 'inversify';
import {FrontMatterCache, TFile} from "obsidian";
import type {MetaFlowSettings, PropertyDefaultValueScript} from "@metaflow/settings/types";
import {MetaFlowException} from "@metaflow/MetaFlowException";
import type {MetadataMenuAdapter} from "@metaflow/externalApi/MetadataMenuAdapter";
import type {ScriptContextService} from "./ScriptContextService";
import type {LogNoticeManagerInterface} from "@metaflow/managers/types";
import {MetadataMenuField} from "@metaflow/externalApi/types.MetadataMenu";
import {TYPES} from '@metaflow/di/types';

@injectable()
export class PropertyManagementService {
  constructor(
    @inject(TYPES.MetaFlowSettings) private metaFlowSettings: MetaFlowSettings,
    @inject(TYPES.MetadataMenuAdapter) private metadataMenuAdapter: MetadataMenuAdapter,
    @inject(TYPES.ScriptContextService) private scriptContextService: ScriptContextService,
    @inject(TYPES.LogNoticeManagerInterface) private logNoticeManager: LogNoticeManagerInterface
  ) {
  }

  /**
   * Add default values to properties using the configured scripts
   */
  addDefaultValuesToProperties(
    frontmatter: FrontMatterCache,
    file: TFile,
    fileClass: string,
    addedFields: string[]
  ): FrontMatterCache {
    const enrichedFrontmatter = {...frontmatter};

    // Ensure fileClass is set
    const fileClassAlias = this.metadataMenuAdapter.getFileClassAlias();
    enrichedFrontmatter[fileClassAlias] = fileClass;

    // Sort scripts by order (if specified) before processing
    const orderedScripts = [...this.metaFlowSettings.propertyDefaultValueScripts].sort((a, b) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

    // Get only the fields associated to fileClass and ancestors
    //convert array to map
    const allFieldsMap = new Map<string, MetadataMenuField>();
    this.metadataMenuAdapter.getFileClassAndAncestorsFields(fileClass).forEach(field => {
      allFieldsMap.set(field.name, field);
    });

    // Process each property default value script in order
    for (const script of orderedScripts) {
      if (!script.enabled) {
        if (this.metaFlowSettings.debugMode) {
          console.debug(`PropertyManagementService: Skipping disabled script for property "${script.propertyName}"`);
        }
        continue;
      }
      // Skip if property already has a value (not null, undefined, or empty string)
      if (!this.isNewField(enrichedFrontmatter, allFieldsMap, script, addedFields)) {
        continue;
      }

      try {
        const defaultValue = this.executePropertyScript(
          script,
          file,
          fileClass,
          enrichedFrontmatter
        );

        if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
          enrichedFrontmatter[script.propertyName] = defaultValue;
        }
      } catch (error) {
        throw new MetaFlowException(`Error executing script for property "${script.propertyName}": ${error.message}`, 'error');
      }
    }

    return enrichedFrontmatter;
  }

  private isNewField(
    enrichedFrontmatter: FrontMatterCache,
    allFieldsMap: Map<string, MetadataMenuField>,
    script: PropertyDefaultValueScript,
    addedFields: string[]
  ): boolean {
    if (!allFieldsMap.has(script.propertyName)) {
      if (this.metaFlowSettings.debugMode) {
        console.debug(`PropertyManagementService: Skipping script for unknown property "${script.propertyName}"`);
      }
      return false;
    }
    if (
      enrichedFrontmatter[script.propertyName] !== undefined &&
      enrichedFrontmatter[script.propertyName] !== null &&
      enrichedFrontmatter[script.propertyName] !== ''
    ) {
      return false;
    }
    if (!addedFields.includes(script.propertyName)) {
      if (this.metaFlowSettings.debugMode) {
        console.debug(`PropertyManagementService: Skipping script for property "${script.propertyName}" not recently added`);
      }
      return false;
    }


    return true;
  }

  /**
   * Sort properties based on the order defined in propertyDefaultValueScripts
   */
  sortProperties(frontmatter: FrontMatterCache, sortUnknownPropertiesLast: boolean): FrontMatterCache {
    if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
      return frontmatter;
    }

    // Create a map of property names to their order from propertyDefaultValueScripts
    const propertyOrderMap = new Map<string, number>();

    // Sort scripts by order (if specified) to get the correct sequence
    const orderedScripts = [...this.metaFlowSettings.propertyDefaultValueScripts].sort((a, b) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

    // Build the property order map
    orderedScripts.forEach((script, index) => {
      propertyOrderMap.set(script.propertyName, script?.order || Number.MAX_SAFE_INTEGER);
    });

    // Get all property keys and sort them
    const sortedKeys = Object.keys(frontmatter).sort((a, b) => {
      const orderA = propertyOrderMap.get(a);
      const orderB = propertyOrderMap.get(b);

      // Both properties have defined order
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }

      // Only property A has defined order
      if (orderA !== undefined && orderB === undefined) {
        return sortUnknownPropertiesLast ? -1 : 1;
      }

      // Only property B has defined order
      if (orderA === undefined && orderB !== undefined) {
        return sortUnknownPropertiesLast ? 1 : -1;
      }

      // Neither property has defined order - sort alphabetically
      return a.localeCompare(b);
    });

    // Build the sorted frontmatter object
    return sortedKeys.reduce(function (result: Record<string, unknown>, key) {
      result[key] = frontmatter[key];
      return result;
    }, {});
  }

  /**
   * Execute a property default value script
   */
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  private executePropertyScript(
    script: PropertyDefaultValueScript,
    file: TFile,
    fileClass: string,
    metadata: FrontMatterCache
  ): unknown {
    // Get utilities from ScriptContextService
    const context = this.scriptContextService.getScriptContext(
      file,
      fileClass,
      metadata
    );

    // Create a safe execution environment
    const executeScript = new Function(
      'context',
      `
			return ((context) => {
				const { ${Object.keys(context).join(', ')} } = context;
				${script.script}
			})(context);
			`
    );

    return executeScript(context);
  }
}
