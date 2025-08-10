
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
  tooltip?: string;
}

export interface MetaMenuSettings {
  fileClassAlias: string;
  classFilesPath: string;
  globalFileClass?: string;
}

export interface MetadataMenuPluginInterface {
  settings: MetaMenuSettings;
  api: {
    getFileClassByName(name: string): MetadataMenuField[];
    getFieldsForFile(file: any): Promise<MetadataMenuField[]>;
    insertMissingFields(fileOrFilePath: string | any, lineNumber: number, asList: boolean, asBlockquote: boolean, fileClassName?: string, indexedPath?: string): Promise<void>;
  };
  fieldIndex?: {
    fileClassesFields?: Map<string, MetadataMenuField[]>;
    fileClassesAncestors?: Map<string, string[]> | {[key: string]: string[]};
  };
}

