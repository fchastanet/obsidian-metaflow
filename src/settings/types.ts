export interface NoteTitleTemplate {
  template: string;
  enabled: boolean;
}

export interface NoteTitleScript {
  script: string;
  enabled: boolean;
}

export interface FolderFileClassMapping {
  folder: string;
  fileClass: string;
  moveToFolder: boolean;
  noteTitleTemplates: NoteTitleTemplate[];
  noteTitleScript: NoteTitleScript;
  templateMode: 'template' | 'script'; // Default to 'template' for backward compatibility
}

export interface PropertyDefaultValueScript {
  propertyName: string;
  script: string;
  enabled: boolean;
  order?: number;
  fileClasses?: string[]; // Optional array of file classes this script applies to
}

export interface MetaFlowSettings {
  hidePropertiesInEditor: boolean;
  autoSort: boolean;
  sortUnknownPropertiesLast: boolean;
  autoMetadataInsertion: boolean;
  insertMissingFieldsOnSort: boolean;
  folderFileClassMappings: FolderFileClassMapping[];
  propertyDefaultValueScripts: PropertyDefaultValueScript[];
  excludeFolders?: string[];
  autoMoveNoteToRightFolder: boolean;
  autoRenameNote: boolean;
  debugMode: boolean;
  frontmatterUpdateDelayMs: number;
}

