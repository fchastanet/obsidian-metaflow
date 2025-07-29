/**
 * Core types and interfaces for the metadata properties sorter plugin
 */

export interface FolderFileClassMapping {
	folderPattern: string;
	fileClass: string;
	isRegex?: boolean;
}

export interface PropertyDefaultValueScript {
	propertyName: string;
	script: string;
	enabled: boolean;
	order?: number;
	fileClasses?: string[]; // Optional array of file classes this script applies to
}

export interface ScriptContext {
	fileClass: string;
	file: any; // TFile
	metadata: { [key: string]: any };
	prompt: (message: string, defaultValue?: string) => Promise<string>;
	date: any; // Templater date function
	generateMarkdownLink: (file: any) => string;
	detectLanguage: (text: string) => string;
}

export interface MetadataSettings {
	propertyOrder: string[];
	autoSortOnView: boolean;
	sortUnknownPropertiesLast: boolean;
	enableAutoMetadataInsertion: boolean;
	insertMissingFieldsOnSort: boolean;
	useMetadataMenuDefaults: boolean;
	metadataMenuIntegration: boolean;
	folderFileClassMappings: FolderFileClassMapping[];
	propertyDefaultValueScripts: PropertyDefaultValueScript[];
	enableTemplaterIntegration: boolean;
}

export interface AutoMetadataSettings extends MetadataSettings {
	// AutoMetadataSettings inherits all properties from MetadataSettings
	// No additional properties needed as they're already included in the base interface
}

export interface MetadataMenuField {
	name: string;
	type: 'Input' | 'Select' | 'MultiSelect' | 'Boolean' | 'Number' | 'Date' | 'DateTime' | 'File' | 'MultiFile' | 'Lookup' | 'Media' | 'Canvas' | 'CanvasGroup' | 'CanvasGroupLink' | 'JSON' | 'Object' | 'ObjectList' | 'YAML';
	id: string;
	path: string;
	options?: {
		[key: string]: string | any;
	};
	isRequired?: boolean;
	defaultValue?: any;
}

export interface FileClassDefinition {
	name: string;
	extends?: string;
	excludes?: string[];
	mapWithTag?: boolean;
	tagNames?: string | string[];
	filePaths?: string | string[];
	bookmarkGroups?: string | string[];
	buttonIcon?: string;
	maxRecordsPerPage?: number;
	version?: number;
	fields: MetadataMenuField[];
}

export interface MetadataMenuPluginInterface {
	settings: {
		fileClassAlias: string;
		classFilesPath: string;
		globalFileClass?: string;
	};
	api: {
		getFileClass(file: any): Promise<FileClassDefinition | null>;
		getFileClassByName(name: string): Promise<FileClassDefinition | null>;
		getFieldsForFile(file: any): Promise<MetadataMenuField[]>;
		insertMissingFields(fileOrFilePath: string | any, lineNumber: number, asList: boolean, asBlockquote: boolean, fileClassName?: string, indexedPath?: string): Promise<void>;
	};
	fieldIndex?: {
		fileClassesAncestors?: Map<string, string[]> | { [key: string]: string[] };
	};
}
