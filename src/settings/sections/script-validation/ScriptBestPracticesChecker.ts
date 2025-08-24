import { ScriptASTParser, ParsedScript } from './ScriptASTParser';

/**
 * ScriptBestPracticesChecker handles warnings and best practice validation
 */
export class ScriptBestPracticesChecker {
  constructor(private astParser: ScriptASTParser) {}

  /**
   * Checks for script best practices and returns warnings
   * @param script The script to check
   * @returns Array of warning messages
   */
  checkBestPractices(script: string): string[] {
    const warnings: string[] = [];

    // Check for very long scripts
    if (script.length > 1000) {
      warnings.push('Script is very long, consider breaking it down');
    }

    const parsed = this.astParser.parseScript(script);

    if (parsed) {
      // Check for console statements using AST
      if (this.hasConsoleStatements(parsed.ast)) {
        warnings.push('Remove console statements before deployment');
      }

      // Check if script returns string using AST analysis
      if (!this.returnsStringAST(parsed.ast)) {
        warnings.push('Script should return a string for the title');
      }
    } else {
      // Fall back to regex if AST parsing fails
      if (/\bconsole\.\w+\s*\(/.test(script)) {
        warnings.push('Remove console statements before deployment');
      }

      if (!this.returnsString(script)) {
        warnings.push('Script should return a string for the title');
      }
    }

    return warnings;
  }

  /**
   * Checks if AST contains console statements
   */
  private hasConsoleStatements(node: any): boolean {
    if (!node || typeof node !== 'object') {
      return false;
    }

    // Check for console.* calls
    if (node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'console') {
      return true;
    }

    // Recursively check all child nodes
    for (const key in node) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (this.hasConsoleStatements(item)) {
            return true;
          }
        }
      } else if (value && typeof value === 'object') {
        if (this.hasConsoleStatements(value)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Analyzes return statements using AST to determine if they likely return strings
   */
  private returnsStringAST(node: any): boolean {
    if (!node || typeof node !== 'object') {
      return false;
    }

    if (node.type === 'ReturnStatement' && node.argument) {
      return this.isLikelyStringExpression(node.argument);
    }

    // Recursively check all child nodes
    for (const key in node) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (this.returnsStringAST(item)) {
            return true;
          }
        }
      } else if (value && typeof value === 'object') {
        if (this.returnsStringAST(value)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Determines if an AST expression is likely to produce a string
   */
  private isLikelyStringExpression(node: any): boolean {
    if (!node || typeof node !== 'object') {
      return false;
    }

    switch (node.type) {
      case 'Literal':
        return typeof node.value === 'string';

      case 'TemplateLiteral':
        return true;

      case 'BinaryExpression':
        // Check for string concatenation with +
        if (node.operator === '+') {
          return this.isLikelyStringExpression(node.left) ||
            this.isLikelyStringExpression(node.right);
        }
        return false;

      case 'CallExpression':
        // Check for string methods
        if (node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier') {
          const methodName = node.callee.property.name;
          const stringMethods = ['toString', 'join', 'replace', 'substring', 'substr', 'slice', 'trim', 'toLowerCase', 'toUpperCase'];
          return stringMethods.includes(methodName);
        }
        return false;

      case 'ConditionalExpression':
        // Check if both consequent and alternate return strings
        return this.isLikelyStringExpression(node.consequent) &&
          this.isLikelyStringExpression(node.alternate);

      case 'Identifier':
        // Assume identifiers that look string-like might be strings
        // This is a heuristic - in real use, these would be variables like file.basename, metadata.title
        return true; // We'll assume variables might contain strings

      case 'MemberExpression':
        // Assume member expressions like file.basename, metadata.title might be strings
        return true;

      default:
        return false;
    }
  }

  /**
   * Heuristic check if script likely returns a string (fallback when AST fails)
   */
  private returnsString(script: string): boolean {
    const cleaned = this.removeCommentsAndStrings(script);

    // Look for return statements with string-like patterns
    const returnPattern = /\breturn\s+([^;]+)/g;
    let match;
    let hasStringReturn = false;

    while ((match = returnPattern.exec(cleaned)) !== null) {
      const returnValue = match[1].trim();

      // Check for string literals
      if (/^["'`]/.test(returnValue)) {
        hasStringReturn = true;
        continue;
      }

      // Check for string operations
      if (/\+|\$\{/.test(returnValue)) {
        hasStringReturn = true;
        continue;
      }

      // Check for common string methods
      if (/\.(toString|join|replace|substring|substr|slice)\s*\(/.test(returnValue)) {
        hasStringReturn = true;
        continue;
      }

      // Check for conditional expressions that return strings in both branches
      if (/\?\s*["'`].*:\s*["'`]/.test(returnValue)) {
        hasStringReturn = true;
        continue;
      }
    }

    return hasStringReturn;
  }

  /**
   * Removes comments and string literals to avoid false positives in validation
   */
  private removeCommentsAndStrings(script: string): string {
    // This is a simplified approach - a full parser would be more robust
    return script
      .replace(/\/\*[\s\S]*?\*\//g, ' ') // Remove /* */ comments
      .replace(/\/\/.*$/gm, ' ') // Remove // comments
      .replace(/"(?:[^"\\]|\\.)*"/g, '""') // Remove double-quoted strings
      .replace(/'(?:[^'\\]|\\.)*'/g, "''") // Remove single-quoted strings
      .replace(/`(?:[^`\\]|\\.)*`/g, '``'); // Remove template literals
  }
}
