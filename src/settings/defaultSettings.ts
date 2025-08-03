import {MetaFlowSettings} from "./types";


/**
 * Default settings for the metadata properties sorter plugin
 */
export const DEFAULT_SETTINGS: MetaFlowSettings = {
  autoSort: true,
  sortUnknownPropertiesLast: true,
  enableAutoMetadataInsertion: false,
  insertMissingFieldsOnSort: false,
  useMetadataMenuDefaults: false,
  hidePropertiesInEditor: false,
  folderFileClassMappings: [
    {
      folderPattern: '.*',
      fileClass: 'default',
      isRegex: true
    }
  ],
  propertyDefaultValueScripts: [],
  excludeFolders: [],
};
