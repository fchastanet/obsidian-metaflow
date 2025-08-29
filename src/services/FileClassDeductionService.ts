import {injectable, inject} from 'inversify';
import type {MetaFlowSettings} from "../settings/types";
import type {ObsidianAdapter} from "../externalApi/ObsidianAdapter";
import type {MetadataMenuAdapter} from "../externalApi/MetadataMenuAdapter";
import type {FrontMatterService} from "./FrontMatterService";
import {TYPES} from '../di/types';
import {FrontMatterCache} from 'obsidian';

@injectable()
export class FileClassDeductionService {
  private metaFlowSettings: MetaFlowSettings;
  private obsidianAdapter: ObsidianAdapter;
  private metadataMenuAdapter: MetadataMenuAdapter;
  private frontMatterService: FrontMatterService;

  constructor(
    @inject(TYPES.MetaFlowSettings) metaFlowSettings: MetaFlowSettings,
    @inject(TYPES.ObsidianAdapter) obsidianAdapter: ObsidianAdapter,
    @inject(TYPES.MetadataMenuAdapter) metadataMenuAdapter: MetadataMenuAdapter,
    @inject(TYPES.FrontMatterService) frontMatterService: FrontMatterService
  ) {
    this.metaFlowSettings = metaFlowSettings;
    this.obsidianAdapter = obsidianAdapter;
    this.metadataMenuAdapter = metadataMenuAdapter;
    this.frontMatterService = frontMatterService;
  }

  /**
   * Deduce fileClass from folder path using the mapping settings
   */
  deduceFileClassFromPath(filePath: string): string | null {
    const cleanFilePath = this.obsidianAdapter.normalizePath(filePath);

    // Sort mappings by folder specificity (most specific first)
    const sortedMappings = [...this.metaFlowSettings.folderFileClassMappings].sort((a, b) => {
      if (a.folder === '/') return 1;  // Root always last
      if (b.folder === '/') return -1;
      return b.folder.length - a.folder.length; // Longer paths first
    });

    for (const mapping of sortedMappings) {
      const folderPrefix = this.obsidianAdapter.folderPrefix(mapping.folder);
      if (folderPrefix === '/' || cleanFilePath.startsWith(folderPrefix)) {
        return mapping.fileClass;
      }
    }
    return null;
  }

  /**
   * Validate that the determined fileClass matches the folder mapping
   */
  validateFileClassAgainstMapping(filePath: string, fileClass: string): boolean {
    const deducedFileClass = this.deduceFileClassFromPath(filePath);
    return deducedFileClass === fileClass;
  }

  getFileClassFromContent(content: string): string | null {
    const fileClassAlias = this.metadataMenuAdapter.getFileClassAlias();
    return this.frontMatterService.parseFileClassFromContent(content, fileClassAlias);
  }

  getFileClassFromMetadata(metadata?: FrontMatterCache): string | null {
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }
    const fileClassAlias = this.metadataMenuAdapter.getFileClassAlias();
    if (Array.isArray(metadata)) {
      return null; // Invalid metadata format
    }
    // Return the fileClass from metadata using the alias
    return metadata?.[fileClassAlias] || null;
  }
}
