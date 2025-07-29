import { MetadataMenuField } from './types';

/**
 * Utility functions for working with MetadataMenu fields
 */

/**
 * Generate default value for a field based on its type
 */
export function getDefaultValueForField(field: MetadataMenuField): any {
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
export function validateField(field: MetadataMenuField): boolean {
	return !!(field.name && field.type && field.id);
}
