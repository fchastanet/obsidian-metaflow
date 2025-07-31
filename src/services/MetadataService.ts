import {MetaFlowSettings} from "src/settings/types";
import {FrontMatterService} from "./FrontMatterService";

export class MetadataService {

  private frontMatterService: FrontMatterService;

  constructor() {
    this.frontMatterService = new FrontMatterService();
  }

  sortMetadataInContent(content: string, settings: MetaFlowSettings): string {
    const parseResult = this.frontMatterService.parseFrontmatter(content);
    if (!parseResult) {
      return content;
    }

    // Sort the properties
    const sortedMetadata = this.sortProperties(parseResult.metadata, settings);

    // Convert back to YAML
    return this.frontMatterService.serializeFrontmatter(sortedMetadata, parseResult.restOfContent);
  }

  private sortProperties(metadata: any, settings: MetaFlowSettings): any {
    const sorted: any = {};
    const usedKeys = new Set<string>();

    // Get remaining properties that are not in the order
    const remainingKeys = Object.keys(metadata).filter(key => !settings.propertyOrder.includes(key));

    // If unknown properties should come first, add them first
    if (!settings.sortUnknownPropertiesLast) {
      // Sort unknown properties alphabetically
      remainingKeys.sort();
      for (const key of remainingKeys) {
        sorted[key] = metadata[key];
        usedKeys.add(key);
      }
    }

    // Then add properties in the specified order
    for (const key of settings.propertyOrder) {
      if (metadata.hasOwnProperty(key)) {
        sorted[key] = metadata[key];
        usedKeys.add(key);
      }
    }

    // If unknown properties should come last, add them last
    if (settings.sortUnknownPropertiesLast) {
      // Sort unknown properties alphabetically
      remainingKeys.sort();
      for (const key of remainingKeys) {
        sorted[key] = metadata[key];
      }
    }

    return sorted;
  }
}
