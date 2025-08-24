import * as acorn from 'acorn';
import { ValidationResult } from './ValidationResult';
import { ScriptASTParser, ParsedScript } from './ScriptASTParser';

/**
 * ScriptSyntaxValidator handles JavaScript syntax validation
 */
export class ScriptSyntaxValidator {
  constructor(private astParser: ScriptASTParser) {}

  /**
   * Validates JavaScript syntax using AST parsing
   * @param script The script to validate
   * @returns ValidationResult with syntax validation feedback
   */
  validateSyntax(script: string): ValidationResult {
    if (!script || script.trim() === '') {
      return {
        isValid: false,
        message: 'Script cannot be empty',
        type: 'error'
      };
    }

    const parsed = this.astParser.parseScript(script);
    
    if (parsed) {
      return {
        isValid: true,
        message: '',
        type: 'success'
      };
    }

    // If parsing failed, try to get a more specific error message
    try {
      // Try parsing directly to get the actual error
      acorn.parse(script, { ecmaVersion: 'latest' });
    } catch (error) {
      let message = 'Unknown syntax error';

      if (error instanceof Error) {
        message = error.message;

        // Make error messages more user-friendly
        if (message.includes('Unexpected token')) {
          message = `Syntax error: ${message}`;
        } else if (message.includes('Unterminated')) {
          message = `Syntax error: ${message}`;
        } else {
          message = `Syntax error: ${message}`;
        }
      }

      return {
        isValid: false,
        message,
        type: 'error'
      };
    }

    return {
      isValid: false,
      message: 'Failed to parse script',
      type: 'error'
    };
  }
}
