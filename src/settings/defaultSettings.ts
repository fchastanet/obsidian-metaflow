import {MetaFlowSettings} from "./types";


/**
 * Default settings for the metadata properties sorter plugin
 */
export const DEFAULT_SETTINGS: MetaFlowSettings = {
  autoSort: true,
  sortUnknownPropertiesLast: true,
  autoMetadataInsertion: true,
  insertMissingFieldsOnSort: true,
  hidePropertiesInEditor: false,
  folderFileClassMappings: [
    {
      folder: '/',
      fileClass: 'default',
      moveToFolder: false,
      noteTitleTemplates: [],
    }
  ],
  propertyDefaultValueScripts: [],
  excludeFolders: [],
  autoMoveNoteToRightFolder: true,
  debugMode: false,
  frontmatterUpdateDelayMs: 500
};
