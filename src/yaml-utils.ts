import * as yaml from 'js-yaml';

/**
 * Utility functions for parsing and serializing YAML frontmatter
 */

export interface FrontmatterParseResult {
	metadata: any;
	content: string;
	restOfContent: string;
}

/**
 * Parse YAML frontmatter from content
 */
export function parseFrontmatter(content: string): FrontmatterParseResult | null {
	// Check if content starts with frontmatter
	if (!content.startsWith('---\n')) {
		return null;
	}

	// Find the end of frontmatter
	const secondDashIndex = content.indexOf('\n---\n', 4);
	if (secondDashIndex === -1) {
		return null;
	}

	const frontmatterText = content.slice(4, secondDashIndex);
	const restOfContent = content.slice(secondDashIndex + 5);

	try {
		// Parse YAML with custom options to preserve strings
		const metadata = yaml.load(frontmatterText, {
			schema: yaml.JSON_SCHEMA // Use JSON schema to avoid date parsing
		});
		
		if (!metadata || typeof metadata !== 'object') {
			return null;
		}

		return {
			metadata,
			content: frontmatterText,
			restOfContent
		};
	} catch (error) {
		console.error('Error parsing YAML frontmatter:', error);
		return null;
	}
}

/**
 * Serialize metadata back to YAML frontmatter format
 */
export function serializeFrontmatter(metadata: any, restOfContent: string): string {
	try {
		// Convert back to YAML
		const sortedYaml = yaml.dump(metadata, {
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
		console.error('Error serializing YAML frontmatter:', error);
		throw error;
	}
}

/**
 * Determine fileClass from file content
 */
export function parseFileClassFromContent(content: string, fileClassAlias: string = 'fileClass'): string | null {
	const parseResult = parseFrontmatter(content);
	if (!parseResult) {
		return null;
	}

	const frontmatter = parseResult.metadata;
	if (frontmatter?.[fileClassAlias]) {
		const fileClassValue = frontmatter[fileClassAlias];
		if (Array.isArray(fileClassValue)) {
			return fileClassValue[0]; // Return first fileClass
		}
		return fileClassValue;
	}

	return null;
}
