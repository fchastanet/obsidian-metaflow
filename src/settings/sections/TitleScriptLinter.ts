import type { ValidationResult } from './script-validation';
import {
  ScriptASTParser,
  ScriptSyntaxValidator,
  ScriptSecurityAnalyzer,
  ScriptReturnAnalyzer,
  ScriptBestPracticesChecker
} from './script-validation';

export type { ValidationResult };

/**
 * TitleScriptLinter provides validation for JavaScript scripts used in note title generation
 * with user-friendly feedback messages and comprehensive AST-based analysis.
 * 
 * This is the main coordinator class that orchestrates various validation components.
 */
export class TitleScriptLinter {
  private astParser: ScriptASTParser;
  private syntaxValidator: ScriptSyntaxValidator;
  private securityAnalyzer: ScriptSecurityAnalyzer;
  private returnAnalyzer: ScriptReturnAnalyzer;
  private bestPracticesChecker: ScriptBestPracticesChecker;

  constructor() {
    this.astParser = new ScriptASTParser();
    this.syntaxValidator = new ScriptSyntaxValidator(this.astParser);
    this.securityAnalyzer = new ScriptSecurityAnalyzer(this.astParser);
    this.returnAnalyzer = new ScriptReturnAnalyzer(this.astParser);
    this.bestPracticesChecker = new ScriptBestPracticesChecker(this.astParser);
  }

  /**
   * Validates a JavaScript script for note title generation
   * @param script The script string to validate
   * @returns ValidationResult with feedback
   */
  validateScript(script: string): ValidationResult {
    // Basic syntax validation
    const syntaxValidation = this.syntaxValidator.validateSyntax(script);
    if (!syntaxValidation.isValid) {
      return syntaxValidation;
    }

    // Check for return statement
    if (!this.returnAnalyzer.hasReturnStatement(script)) {
      return {
        isValid: false,
        message: 'Script must contain a return statement',
        type: 'error'
      };
    }

    // Check for security issues
    const securityValidation = this.securityAnalyzer.checkSecurity(script);
    if (!securityValidation.isValid) {
      return securityValidation;
    }

    // Check for missing return statements in branches
    const branchValidation = this.returnAnalyzer.validateAllBranchesReturn(script);
    if (!branchValidation.isValid) {
      return branchValidation;
    }

    // Check for best practices
    const warnings = this.bestPracticesChecker.checkBestPractices(script);
    if (warnings.length > 0) {
      return {
        isValid: true,
        message: `Script is valid but consider: ${warnings.join(', ')}`,
        type: 'warning'
      };
    }

    return {
      isValid: true,
      message: 'Script syntax is valid',
      type: 'success'
    };
  }

  /**
   * Clears the internal AST cache to free memory
   */
  clearCache(): void {
    this.astParser.clearCache();
  }

  /**
   * Gets the current cache size for monitoring purposes
   */
  getCacheSize(): number {
    return this.astParser.getCacheSize();
  }
}
