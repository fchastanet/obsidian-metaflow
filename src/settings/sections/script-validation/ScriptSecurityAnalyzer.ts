import { ValidationResult } from './ValidationResult';
import { ScriptASTParser, ParsedScript } from './ScriptASTParser';

/**
 * ScriptSecurityAnalyzer handles security validation for scripts
 */
export class ScriptSecurityAnalyzer {
  constructor(private astParser: ScriptASTParser) {}

  /**
   * Checks for potential security issues in scripts
   * @param script The script to analyze
   * @returns ValidationResult with security analysis
   */
  checkSecurity(script: string): ValidationResult {
    const parsed = this.astParser.parseScript(script);

    if (parsed) {
      const securityIssue = this.findSecurityIssues(parsed.ast);

      if (securityIssue) {
        return {
          isValid: false,
          message: `Security concern: ${securityIssue}`,
          type: 'error'
        };
      }

      return {
        isValid: true,
        message: '',
        type: 'success'
      };
    }

    // If AST parsing fails, fall back to regex patterns
    return this.checkSecurityWithRegex(script);
  }

  /**
   * Recursively searches AST for security issues
   */
  private findSecurityIssues(node: any): string | null {
    if (!node || typeof node !== 'object') {
      return null;
    }

    // Check for dangerous function calls
    if (node.type === 'CallExpression') {
      const callee = node.callee;

      // Check for eval()
      if (callee.type === 'Identifier' && callee.name === 'eval') {
        return 'eval() is potentially dangerous';
      }

      // Check for Function() constructor
      if (callee.type === 'Identifier' && callee.name === 'Function') {
        return 'Dynamic function creation may be unsafe';
      }

      // Check for setTimeout/setInterval
      if (callee.type === 'Identifier' && (callee.name === 'setTimeout' || callee.name === 'setInterval')) {
        return 'Timer functions may cause performance issues';
      }

      // Check for require()
      if (callee.type === 'Identifier' && callee.name === 'require') {
        return 'require() may access system resources';
      }

      // Check for dynamic imports
      if (callee.type === 'Import') {
        return 'Dynamic imports may access external resources';
      }
    }

    // Check for new Function()
    if (node.type === 'NewExpression' && node.callee.type === 'Identifier' && node.callee.name === 'Function') {
      return 'Dynamic function creation may be unsafe';
    }

    // Recursively check all child nodes
    for (const key in node) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          const issue = this.findSecurityIssues(item);
          if (issue) return issue;
        }
      } else if (value && typeof value === 'object') {
        const issue = this.findSecurityIssues(value);
        if (issue) return issue;
      }
    }

    return null;
  }

  /**
   * Fallback security check using regex patterns when AST parsing fails
   */
  private checkSecurityWithRegex(script: string): ValidationResult {
    const dangerousPatterns = [
      { pattern: /\beval\b/, message: 'eval() is potentially dangerous' },
      { pattern: /\bFunction\b\s*\(/, message: 'Dynamic function creation may be unsafe' },
      { pattern: /\bsetTimeout\b|\bsetInterval\b/, message: 'Timer functions may cause performance issues' },
      { pattern: /\brequire\b\s*\(/, message: 'require() may access system resources' },
      { pattern: /\bimport\b\s*\(/, message: 'Dynamic imports may access external resources' }
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(script)) {
        return {
          isValid: false,
          message: `Security concern: ${message}`,
          type: 'error'
        };
      }
    }

    return {
      isValid: true,
      message: '',
      type: 'success'
    };
  }
}
