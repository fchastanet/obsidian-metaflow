import * as yaml from 'js-yaml';

export interface MetadataSettings {
	propertyOrder: string[];
	autoSortOnView: boolean;
	sortUnknownPropertiesLast: boolean;
	enableAutoMetadataInsertion: boolean;
	insertMissingFieldsOnSort: boolean;
	useMetadataMenuDefaults: boolean;
	metadataMenuIntegration: boolean;
}

export const DEFAULT_SETTINGS: MetadataSettings = {
	propertyOrder: [
		'title',
		'date',
		'created',
		'updated',
		'status',
		'type',
		'tags',
		'moc',
		'parent',
		'source',
		'references',
		'noteLanguage'
	],
	autoSortOnView: true,
	sortUnknownPropertiesLast: true,
	enableAutoMetadataInsertion: false,
	insertMissingFieldsOnSort: true,
	useMetadataMenuDefaults: true,
	metadataMenuIntegration: false
};

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
	// Check if content starts with frontmatter
	if (!content.startsWith('---\n')) {
		return content;
	}

	// Find the end of frontmatter
	const secondDashIndex = content.indexOf('\n---\n', 4);
	if (secondDashIndex === -1) {
		return content;
	}

	const frontmatterText = content.slice(4, secondDashIndex);
	const restOfContent = content.slice(secondDashIndex + 5);

	try {
		// Parse YAML with custom options to preserve strings
		const metadata = yaml.load(frontmatterText, {
			schema: yaml.JSON_SCHEMA // Use JSON schema to avoid date parsing
		});
		
		if (!metadata || typeof metadata !== 'object') {
			return content;
		}

		// Sort the properties
		const sortedMetadata = sortProperties(metadata, settings);
		
		// Convert back to YAML
		const sortedYaml = yaml.dump(sortedMetadata, {
			lineWidth: -1,
			noRefs: true,
			quotingType: '"',
			forceQuotes: false,
			flowLevel: -1,
			sortKeys: false, // Don't sort keys, we handle sorting manually
			schema: yaml.JSON_SCHEMA, // Use JSON schema to avoid date formatting
			styles: {
				'!!null': 'empty' // Represent null as empty
			}
		});

		return `---\n${sortedYaml}---\n${restOfContent}`;
	} catch (error) {
		console.error('Error parsing YAML frontmatter:', error);
		return content;
	}
}
