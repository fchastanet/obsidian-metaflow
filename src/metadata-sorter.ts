import { MetadataSettings } from './types';
import { parseFrontmatter, serializeFrontmatter } from './yaml-utils';

// Re-export for backward compatibility
export type { MetadataSettings } from './types';
export { DEFAULT_SETTINGS } from './settings';

export function sortProperties(metadata: any, settings: MetadataSettings): any {
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

export function sortMetadataInContent(content: string, settings: MetadataSettings): string {
	const parseResult = parseFrontmatter(content);
	if (!parseResult) {
		return content;
	}

	// Sort the properties
	const sortedMetadata = sortProperties(parseResult.metadata, settings);
	
	// Convert back to YAML
	return serializeFrontmatter(sortedMetadata, parseResult.restOfContent);
}
