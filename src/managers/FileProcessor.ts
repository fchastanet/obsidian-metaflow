import {TFile, CachedMetadata} from "obsidian";
import {FileState} from "./FileStateCache";
import {FileClassDeductionService} from "../services/FileClassDeductionService";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import {MetaFlowSettings} from "../settings/types";
import {Utils} from "../utils/Utils";

/**
 * Handles file processing logic including checksum computation and file state creation
 */
export class FileProcessor {
  constructor(
    private fileClassDeductionService: FileClassDeductionService,
    private obsidianAdapter: ObsidianAdapter,
    private settings: MetaFlowSettings
  ) { }

  /**
   * Compute the complete file state for a given file
   */
  computeFileState(file: TFile, cache?: CachedMetadata | null): FileState {
    if (!cache) {
      cache = this.obsidianAdapter.getCachedFile(file);
    }

    const checksum = this.computeChecksumFromTitleAndFrontmatter(file, cache);
    const fileClass = this.fileClassDeductionService.getFileClassFromMetadata(cache?.frontmatter) || '';
    const mtime = file.stat.mtime;

    return {checksum, fileClass, mtime};
  }

  /**
   * Compute checksum from file title and frontmatter
   */
  private computeChecksumFromTitleAndFrontmatter(file: TFile, cache: CachedMetadata | null): string {
    const frontmatter = cache?.frontmatter || {};
    const title = file.basename;
    return Utils.sha256(`${title}\n${JSON.stringify(frontmatter)}`);
  }
}
