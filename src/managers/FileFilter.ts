import {TAbstractFile, TFile} from "obsidian";
import {FileValidationService} from "../services/FileValidationService";
import {ObsidianAdapter} from "../externalApi/ObsidianAdapter";

/**
 * Handles file filtering logic to determine which files should be processed
 */
export class FileFilter {
  constructor(
    private fileValidationService: FileValidationService,
    private obsidianAdapter: ObsidianAdapter
  ) { }

  /**
   * Check if a file is applicable for processing
   */
  isApplicable(file: TAbstractFile | null | undefined): file is TFile {
    if (!file) return false;
    if (!(file instanceof TFile)) return false;
    if (!file?.basename || !file?.path) return false;
    if (file.saving) return false;

    // Check if the file is a Markdown file
    if (file.extension !== 'md') return false;

    if (this.fileValidationService.ifFileExcluded(file)) return false;

    // Check if the file has a valid frontmatter
    const cache = this.obsidianAdapter.getCachedFile(file);
    if (!cache || !cache.frontmatter) return false;

    return true;
  }
}
