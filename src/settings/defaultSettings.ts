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
      noteTitleScript: {
        script: 'return "";',
        enabled: true
      },
      templateMode: 'template' as const,
    }
  ],
  propertyDefaultValueScripts: [],
  excludeFolders: [],
  autoMoveNoteToRightFolder: false, // disabled by default to avoid unexpected behavior
  autoRenameNote: true,
  debugMode: false,
  frontmatterUpdateDelayMs: 500,
  fileClassStateCacheFilename: 'fileClassStateCache.json',
  fileClassStateCacheSaveIntervalMs: 15000, // 15 seconds
  fileClassStateCacheEvictionThresholdMs: 86400000, // 24 hours
  eventCronIntervalMs: 3000, // 3 seconds
  massUpdateBatchSize: 5, // Number of files to process in parallel during mass update
};
