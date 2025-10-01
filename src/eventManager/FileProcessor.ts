import {TFile, CachedMetadata} from "obsidian";
import {FileClassDeductionService} from "@metaflow/services/FileClassDeductionService";
import {ObsidianAdapter} from "@metaflow/externalApi/ObsidianAdapter";
import type {MetaFlowSettings} from "@metaflow/settings/types";
import {Utils} from "@metaflow/utils/Utils";
import {inject} from "inversify";
import {TYPES} from "@metaflow/di";
import {FileState} from "./cache/types";
import {MetaFlowService} from "@metaflow/services/MetaFlowService";
import type {LogNoticeManagerInterface} from "@metaflow/managers/types";

/**
 * Handles file processing logic including checksum computation and file state creation
 */
export class FileProcessor {
  constructor(
    @inject(TYPES.FileClassDeductionService) private fileClassDeductionService: FileClassDeductionService,
    @inject(TYPES.ObsidianAdapter) private obsidianAdapter: ObsidianAdapter,
    @inject(TYPES.MetaFlowSettings) private settings: MetaFlowSettings,
    @inject(TYPES.MetaFlowService) private metaFlowService: MetaFlowService,
    @inject(TYPES.LogNoticeManagerInterface) private logNoticeManager: LogNoticeManagerInterface,
  ) { }

  async processFile(filePath: string, state: FileState): Promise<FileState> {
    const file = this.obsidianAdapter.getAbstractFileByPath(filePath);
    if (!file) {
      console.warn(`FileProcessor: File not found for path ${filePath}`);
      return state;
    }
    if (!(file instanceof TFile)) {
      console.warn(`FileProcessor: Path is not a file ${filePath}`);
      return state;
    }
    if (state?.fileMtime < file.stat.mtime) {
      // this state is obsolete
      return state;
    }
    const cache = this.obsidianAdapter.getCachedFile(file);
    const checksum = this.computeChecksum(file, cache);
    if (state.checksum === checksum) {
      console.info(`No changes detected for file: ${filePath}`);
      return state;
    }

    const newState = this.computeNewState(file, state, cache);

    if (this.settings.autoMetadataInsertion) {
      await this.metaFlowService.handleFileClassChanged(file, cache, newState.fileClass!);
    }

    return newState;
  }

  private computeNewState(file: TFile, state: FileState, cache: CachedMetadata | null): FileState {
    const fileClass = this.fileClassDeductionService.getFileClassFromMetadata(cache?.frontmatter) || '';

    // if fileClass changed or file renamed
    // it means the frontmatter changed, so we have to recompute checksum again
    const newState = structuredClone(state);
    newState.checksum = this.computeChecksum(file, cache);
    newState.fileClass = fileClass;

    return newState;
  }

  /**
   * Compute checksum from file title, frontmatter and relevant settings
   */
  private computeChecksum(file: TFile, cache: CachedMetadata | null): string {
    const content = {
      title: file.basename,
      frontmatter: cache?.frontmatter || {},
      folderFileClassMappings: this.settings.folderFileClassMappings,
      propertyDefaultValueScripts: this.settings.propertyDefaultValueScripts,
      excludeFolders: this.settings.excludeFolders,
    };
    const checksum = Utils.sha256(JSON.stringify(content));
    return checksum;
  }
}
