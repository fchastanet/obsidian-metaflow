import type {SettingDefinitionGroup} from "obsidian";
import type {BooleanSettingKey, MetaFlowSettings} from "@metaflow/settings/types";
import {SettingsUtils} from "@metaflow/settings/SettingsUtils";

/**
 * Settings that only make sense when automatic metadata insertion is enabled
 */
const INSERTION_DEPENDENT_KEYS: BooleanSettingKey[] = ['autoSort', 'autoMoveNoteToRightFolder', 'autoRenameNote'];

/**
 * Metadata insertion behavior settings (declarative definitions)
 */
export class MetadataInsertionSection {
  constructor(private settings: MetaFlowSettings) { }

  getDefinition(): SettingDefinitionGroup {
    const insertionDisabled = () => !this.settings.autoMetadataInsertion;
    return {
      type: 'group',
      heading: 'Metadata insertion behavior',
      items: [
        SettingsUtils.toggleDefinition('autoMetadataInsertion',
          'Auto-insert missing metadata fields',
          'Automatically insert missing metadata fields based on fileClass definitions'),
        SettingsUtils.toggleDefinition('autoSort',
          'Auto-sort metadata properties',
          'Automatically sort metadata properties when updating metadata (requires auto-insert)',
          insertionDisabled),
        SettingsUtils.toggleDefinition('autoMoveNoteToRightFolder',
          'Auto-move note to the right folder (Bêta)',
          'Automatically move note to the correct folder based on Folder/FileClass mapping when updating metadata (requires auto-insert)',
          insertionDisabled),
        SettingsUtils.toggleDefinition('autoRenameNote',
          'Auto-rename note based on folder/fileClass mapping',
          'Automatically rename note based on the title template or script defined in Folder/FileClass mapping when updating metadata (requires auto-insert)',
          insertionDisabled),
        SettingsUtils.toggleDefinition('sortUnknownPropertiesLast',
          'Sort unknown properties alphabetically',
          'Sort properties not in the custom order alphabetically at the end'),
      ],
    };
  }

  /**
   * Apply side effects of a setting change.
   * @returns true when other settings were changed, so definitions have to be re-rendered
   */
  applyChange(key: string, value: unknown): boolean {
    if (key !== 'autoMetadataInsertion' || value) {
      return false;
    }
    INSERTION_DEPENDENT_KEYS.forEach(dependentKey => {
      this.settings[dependentKey] = false;
    });
    return true;
  }
}
