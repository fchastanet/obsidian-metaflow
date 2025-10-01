import {TAbstractFile, TFile} from "obsidian";
import {FileValidationService} from "@metaflow/services/FileValidationService";
import {ObsidianAdapter} from "@metaflow/externalApi/ObsidianAdapter";
import {inject} from "inversify";
import {TYPES} from "@metaflow/di/types";

/**
 * Handles file filtering logic to determine which files should be processed
 */
export class FileFilter {
  constructor(
    @inject(TYPES.FileValidationService) private fileValidationService: FileValidationService,
    @inject(TYPES.ObsidianAdapter) private obsidianAdapter: ObsidianAdapter
  ) { }

  /**
   * Check if a file is applicable for processing
   */
  isApplicable(file: TAbstractFile | null | undefined): file is TFile {
    if (!file) return false;
    if (!(file instanceof TFile)) return false;
    if (!file?.basename || !file?.path) return false;
    if (file?.deleted) return false;
    //if (file.saving) return false;

    // Check if the file is a Markdown file
    if (file.extension !== 'md') return false;

    if (this.fileValidationService.ifFileExcluded(file)) return false;

    // Check if the file has a valid frontmatter
    const cache = this.obsidianAdapter.getCachedFile(file);
    if (!cache || !cache.frontmatter) return false;

    return true;
  }
}
