import * as yaml from 'js-yaml';


export interface FrontmatterParseResult {
  metadata: any;
  content: string;
  restOfContent: string;
}

/**
 * Utility functions for parsing and serializing YAML frontmatter
 */
export class FrontMatterService {

  /**
   * Parse YAML frontmatter from content
   */
  parseFrontmatter(content: string): FrontmatterParseResult {
    let frontmatterText = "";
    let restOfContent = content;

    // parse frontmatter
    const delimiterRegexp: RegExp = /^---$/gm;
    let match: RegExpExecArray | null = delimiterRegexp.exec(content);
    // Check if content starts with frontmatter
    if (match && match.index === 0) {
      // Find the end of frontmatter
      let match2: RegExpExecArray | null = delimiterRegexp.exec(content);
      if (match2 && match2.index > match.index) {
        frontmatterText = content.slice(4, match2.index);
        restOfContent = content.slice(match2.index + 4);
      }
    }

    if (frontmatterText.match(/^\s*$/)) {
      return {
        metadata: {},
        content: "",
        restOfContent
      };
    } else {
      const metadata = this.parseRawFrontmatter(frontmatterText);
      if (metadata) {
        return {
          metadata,
          content: frontmatterText,
          restOfContent
        };
      }
    }

    // invalid or empty frontmatter
    return {
      metadata: {},
      content: "",
      restOfContent: content,
    };
  }

  parseRawFrontmatter(rawFrontMatter: string): object | null {
    try {
      // Parse YAML with custom options to preserve strings
      const metadata = yaml.load(rawFrontMatter, {
        schema: yaml.JSON_SCHEMA // Use JSON schema to avoid date parsing
      });

      if (metadata && typeof metadata === 'object') {
        return metadata;
      }
    } catch (error) {
      console.error('Error parsing YAML frontmatter:', error);
      return null;
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
      const sortedYaml = yaml.dump(metadata, {
        lineWidth: -1,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false,
        flowLevel: -1,
        sortKeys: false, // Don't sort keys, we handle sorting manually
        schema: yaml.JSON_SCHEMA, // Use JSON schema to avoid date formatting
        styles: {
          '!!null': 'empty' // Represent null as empty
        }
      });

      return `---\n${sortedYaml}---\n${restOfContent}`;
    } catch (error) {
      console.error('Error serializing YAML frontmatter:', error);
      throw error;
    }
  }
}
