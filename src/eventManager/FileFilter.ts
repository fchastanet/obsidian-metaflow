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
    @inject(TYPES.ObsidianAdapter) private obsidianAdapter: ObsidianAdapter,
    @inject(TYPES.MetaFlowSettings) private settings: import("src/settings/types").MetaFlowSettings,
    private launchTime: number = Date.now(),
  ) { }

  /**
   * Check if a file is applicable for processing
   */
  isApplicable(file: TAbstractFile | null | undefined): file is TFile {
    if (!file) {
      if (this.settings.debugMode) console.debug('FileClassStateManager: isApplicable - file is null or undefined');
      return false;
    }
    if (!(file instanceof TFile)) {
      if (this.settings.debugMode) console.debug('FileClassStateManager: isApplicable - file is not a TFile', file);
      return false;
    }
    if (file.stat.mtime < this.launchTime) {
      if (this.settings.debugMode) console.debug('FileClassStateManager: isApplicable - file is outdated', file);
      return false;
    }
    if (!file?.basename || !file?.path) {
      if (this.settings.debugMode) console.debug('FileClassStateManager: isApplicable - file is missing basename or path', file);
      return false;
    }
    if (file?.deleted) {
      if (this.settings.debugMode) console.debug('FileClassStateManager: isApplicable - file is deleted', file);
      return false;
    }
    if (file.saving) {
      if (this.settings.debugMode) console.debug('FileClassStateManager: isApplicable - file is currently being saved', file);
    }

    // Check if the file is a Markdown file
    if (file.extension !== 'md') {
      if (this.settings.debugMode) console.debug('FileClassStateManager: isApplicable - file is not a Markdown file', file);
      return false;
    }

    if (this.fileValidationService.ifFileExcluded(file)) {
      if (this.settings.debugMode) console.debug('FileClassStateManager: isApplicable - file is excluded', file);
      return false;
    }

    return true;
  }
}
