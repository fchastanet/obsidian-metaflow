import {TFile} from "obsidian";
import {MetaFlowSettings, PropertyDefaultValueScript} from "../settings/types";
import {MetaFlowException} from "../MetaFlowException";
import {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import {ScriptContextService} from "./ScriptContextService";
import {LogManagerInterface} from "../managers/types";
import {MetadataMenuField} from "../externalApi/types.MetadataMenu";

export class PropertyManagementService {
  private metaFlowSettings: MetaFlowSettings;
  private metadataMenuAdapter: MetadataMenuAdapter;
  private scriptContextService: ScriptContextService;

  constructor(
    metaFlowSettings: MetaFlowSettings,
    metadataMenuAdapter: MetadataMenuAdapter,
    scriptContextService: ScriptContextService
  ) {
    this.metaFlowSettings = metaFlowSettings;
    this.metadataMenuAdapter = metadataMenuAdapter;
    this.scriptContextService = scriptContextService;
  }

  /**
   * Add default values to properties using the configured scripts
   */
  addDefaultValuesToProperties(
    frontmatter: {[key: string]: any},
    file: TFile,
    fileClass: string,
    logManager: LogManagerInterface
  ): {[key: string]: any} {
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
    this.metadataMenuAdapter.getFileClassAndAncestorsFields(fileClass, logManager).forEach(field => {
      allFieldsMap.set(field.name, field);
    });

    // Process each property default value script in order
    for (const script of orderedScripts) {
      // Skip if property already has a value (not null, undefined, or empty string)
      if (
        !allFieldsMap.has(script.propertyName) || (
          enrichedFrontmatter[script.propertyName] !== undefined &&
          enrichedFrontmatter[script.propertyName] !== null &&
          enrichedFrontmatter[script.propertyName] !== ''
        )
      ) {
        continue;
      }
      if (!script.enabled) continue;

      try {
        const defaultValue = this.executePropertyScript(
          script,
          file,
          fileClass,
          enrichedFrontmatter,
          logManager
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

  /**
   * Sort properties based on the order defined in propertyDefaultValueScripts
   */
  sortProperties(frontmatter: {[key: string]: any}, sortUnknownPropertiesLast: boolean): {[key: string]: any} {
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
    return sortedKeys.reduce(function (result: any, key) {
      result[key] = frontmatter[key];
      return result;
    }, {});
  }

  /**
   * Execute a property default value script
   */
  private executePropertyScript(
    script: PropertyDefaultValueScript,
    file: TFile,
    fileClass: string,
    metadata: {[key: string]: any},
    logManager: LogManagerInterface
  ): any {
    // Get utilities from ScriptContextService
    const context = this.scriptContextService.getScriptContext(
      file,
      fileClass,
      metadata,
      logManager
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
