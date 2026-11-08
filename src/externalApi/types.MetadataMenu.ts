
export interface MetadataMenuField {
  name: string;
  type: 'Input' | 'Select' | 'MultiSelect' | 'Boolean' | 'Number' | 'Date' | 'DateTime' | 'File' | 'MultiFile' | 'Lookup' | 'Media' | 'Canvas' | 'CanvasGroup' | 'CanvasGroupLink' | 'JSON' | 'Object' | 'ObjectList' | 'YAML';
  id: string;
  path: string;
  options?: {
    [key: string]: string | unknown;
  };
  isRequired?: boolean;
  defaultValue?: unknown;
  tooltip?: string;
}

export interface MetadataMenuApi {
  getFileClassByName(name: string): MetadataMenuField[];
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
  };
  fieldIndex?: {
    fileClassesFields?: Map<string, MetadataMenuField[]>;
    fileClassesAncestors?: Map<string, string[]> | {[key: string]: string[]};
  };
}
