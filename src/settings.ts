import { MetadataSettings } from './types';

/**
 * Default settings for the metadata properties sorter plugin
 */
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
	autoSortOnView: false,
	sortUnknownPropertiesLast: true,
	enableAutoMetadataInsertion: false,
	insertMissingFieldsOnSort: false,
	useMetadataMenuDefaults: false,
	metadataMenuIntegration: false,
	folderFileClassMappings: [
		{
			folderPattern: '.*',
			fileClass: 'default',
			isRegex: true
		}
	],
	propertyDefaultValueScripts: [],
	enableTemplaterIntegration: false
};
