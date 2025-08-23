import {TFile} from "obsidian";
import {MetaFlowSettings} from "../settings/types";
import {MetaFlowException} from "../MetaFlowException";
import {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import {TemplaterAdapter} from "../externalApi/TemplaterAdapter";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";

export class FileValidationService {
  private metaFlowSettings: MetaFlowSettings;
  private metadataMenuAdapter: MetadataMenuAdapter;
  private templaterAdapter: TemplaterAdapter;
  private obsidianAdapter: ObsidianAdapter;

  constructor(
    metaFlowSettings: MetaFlowSettings,
    metadataMenuAdapter: MetadataMenuAdapter,
    templaterAdapter: TemplaterAdapter,
    obsidianAdapter: ObsidianAdapter
  ) {
    this.metaFlowSettings = metaFlowSettings;
    this.metadataMenuAdapter = metadataMenuAdapter;
    this.templaterAdapter = templaterAdapter;
    this.obsidianAdapter = obsidianAdapter;
  }

  checkIfAutomaticMetadataInsertionEnabled(): void {
    if (!this.metaFlowSettings.autoMetadataInsertion) {
      throw new MetaFlowException('Auto metadata insertion is disabled', 'info');
    }
  }

  checkIfMetadataInsertionApplicable(file: TFile): void {
    this.checkIfValidFile(file);
    this.checkIfExcluded(file);

    // Check if MetadataMenu plugin is available
    if (!this.metadataMenuAdapter.isMetadataMenuAvailable()) {
      throw new MetaFlowException('MetadataMenu plugin not available', 'info');
    }

    // Check if Templater plugin is available (if integration is enabled)
    if (!this.templaterAdapter.isTemplaterAvailable()) {
      throw new MetaFlowException('Templater plugin not available', 'info');
    }
  }

  checkIfExcluded(file: TFile): void {
    // Exclude files in excluded folders
    const excludeFolders = (this.metaFlowSettings.excludeFolders || []);
    if (excludeFolders.some(folder => file.path.startsWith(this.obsidianAdapter.folderPrefix(folder)))) {
      throw new MetaFlowException(`File ${file.name} is in an excluded folder: ${file.path}`, 'info');
    }
  }

  checkIfAutoMoveNoteToRightFolderEnabled(): void {
    if (!this.metaFlowSettings.autoMoveNoteToRightFolder) {
      throw new MetaFlowException('Auto move note to right folder is disabled', 'info');
    }
  }

  checkIfValidFile(file: TFile): void {
    if (!file || !(file instanceof TFile)) {
      throw new MetaFlowException('Invalid file provided for class change', 'ignore');
    }
    if (file.extension !== 'md') {
      throw new MetaFlowException(`File ${file.name} is not a markdown file`, 'ignore');
    }
  }
}
