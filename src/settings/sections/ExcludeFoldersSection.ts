import type {SettingDefinitionList} from "obsidian";
import type {SettingsSectionContext} from "./SettingsSectionContext";

/**
 * Folders excluded from metadata update commands (declarative list definition)
 */
export class ExcludeFoldersSection {
  constructor(private context: SettingsSectionContext) { }

  private get excludeFolders(): string[] {
    this.context.settings.excludeFolders ??= [];
    return this.context.settings.excludeFolders;
  }

  getDefinition(): SettingDefinitionList {
    return {
      type: 'list',
      heading: 'Exclude folders',
      emptyState: 'No excluded folders. Folders listed here are skipped by metadata update commands.',
      items: this.excludeFolders.map((folder, idx) => ({
        name: folder || 'New excluded folder',
        aliases: ['exclude', 'ignore'],
        control: {type: 'folder', key: `excludeFolders.${idx}`, placeholder: 'Folder path'},
      })),
      onDelete: (idx: number) => this.updateFolders(folders => folders.splice(idx, 1)),
      onReorder: (oldIndex: number, newIndex: number) => this.updateFolders(folders => {
        const [moved] = folders.splice(oldIndex, 1);
        folders.splice(newIndex, 0, moved);
      }),
      addItem: {
        name: 'Add folder',
        action: () => this.updateFolders(folders => folders.push('')),
      },
    };
  }

  private updateFolders(mutate: (folders: string[]) => void): void {
    mutate(this.excludeFolders);
    void this.context.save().then(() => this.context.refresh());
  }
}
