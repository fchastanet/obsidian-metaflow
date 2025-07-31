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

export interface MetaFlowSettings {
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

