import {injectable} from 'inversify';
import {FrontMatterCache, stringifyYaml} from 'obsidian';
import {getFrontMatterInfo, parseYaml} from 'obsidian';


export interface FrontmatterParseResult {
  metadata: FrontMatterCache;
  content: string;
  restOfContent: string;
}

/**
 * Utility functions for parsing and serializing YAML frontmatter
 */
@injectable()
export class FrontMatterService {

  /**
   * Parse YAML frontmatter from content
   */
  parseFrontmatter(content: string): FrontmatterParseResult {
    const frontMatterInfo = getFrontMatterInfo(content);
    if (frontMatterInfo) {
      const {contentStart, exists, frontmatter, from, to} = frontMatterInfo;

      let metadata = {};
      if (exists && frontmatter) {
        metadata = this.parseRawFrontmatter(frontmatter) ?? {};
      }

      return {
        metadata,
        content: content.substring(from, to),
        restOfContent: content.substring(contentStart),
      };
    }
    return {
      metadata: {},
      content: "",
      restOfContent: content,
    };
  }

  parseRawFrontmatter(rawFrontMatter: string): object | null {
    try {
      const frontmatter = parseYaml(rawFrontMatter);
      if (frontmatter && typeof frontmatter === 'object') {
        return frontmatter;
      }
    } catch (error) {
      console.error('Error parsing YAML frontmatter:', error);
      throw error;
    }
    return {};
  }

  /**
   * Determine fileClass from file content
   */
  parseFileClassFromContent(content: string, fileClassAlias: string): string | null {
    const parseResult = this.parseFrontmatter(content);
    if (!parseResult) {
      return null;
    }

    return this.getFileClassFromMetadata(parseResult.metadata, fileClassAlias);
  }

  getFileClassFromMetadata(metadata: any, fileClassAlias: string): string | null {
    return metadata?.[fileClassAlias] || null;
  }

  /**
   * Serialize metadata back to YAML frontmatter format
   */
  serializeFrontmatter(metadata: any, restOfContent: string): string {
    try {
      // Convert back to YAML
      const sortedYaml = stringifyYaml(metadata);

      return `---\n${sortedYaml}---\n${restOfContent}`;
    } catch (error) {
      console.error('Error serializing YAML frontmatter:', error);
      throw error;
    }
  }
}
