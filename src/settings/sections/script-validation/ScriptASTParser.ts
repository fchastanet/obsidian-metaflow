import * as acorn from 'acorn';

/**
 * Parsed script result containing AST and metadata
 */
export interface ParsedScript {
  ast: acorn.Node;
  isWrapped: boolean;
  originalScript: string;
}

/**
 * ScriptASTParser handles parsing JavaScript scripts into AST
 * and caches the result to avoid multiple parsing operations
 */
export class ScriptASTParser {
  private parseCache = new Map<string, ParsedScript | null>();

  /**
   * Parses a script into an AST, with caching to avoid repeated parsing
   * @param script The script to parse
   * @returns ParsedScript with AST and metadata, or null if parsing fails
   */
  parseScript(script: string): ParsedScript | null {
    // Check cache first
    if (this.parseCache.has(script)) {
      return this.parseCache.get(script)!;
    }

    try {
      // First try parsing as-is for complete programs
      try {
        const ast = acorn.parse(script, {ecmaVersion: 'latest'});
        const result: ParsedScript = {
          ast,
          isWrapped: false,
          originalScript: script
        };
        this.parseCache.set(script, result);
        return result;
      } catch (error) {
        // If that fails, try wrapping in function (for script fragments)
        const wrappedScript = `function temp() { ${script} }`;
        const ast = acorn.parse(wrappedScript, {ecmaVersion: 'latest'});
        const result: ParsedScript = {
          ast,
          isWrapped: true,
          originalScript: script
        };
        this.parseCache.set(script, result);
        return result;
      }
    } catch (error) {
      // Cache null result to avoid repeated parsing attempts
      this.parseCache.set(script, null);
      return null;
    }
  }

  /**
   * Checks if a script can be parsed successfully
   * @param script The script to check
   * @returns true if the script can be parsed
   */
  canParse(script: string): boolean {
    return this.parseScript(script) !== null;
  }

  /**
   * Clears the parse cache
   */
  clearCache(): void {
    this.parseCache.clear();
  }

  /**
   * Gets the current cache size
   */
  getCacheSize(): number {
    return this.parseCache.size;
  }
}
