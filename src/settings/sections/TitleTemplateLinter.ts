/**
 * TitleTemplateLinter provides validation for title templates
 * with user-friendly feedback messages.
 */
export interface ValidationResult {
  isValid: boolean;
  message: string;
  type: 'error' | 'warning' | 'success';
}

export class TitleTemplateLinter {

  /**
   * Validates a title template string for common syntax errors
   * @param template The template string to validate
   * @returns ValidationResult with feedback
   */
  validateTemplate(template: string): ValidationResult {
    if (!template || template.trim() === '') {
      return {
        isValid: false,
        message: 'Template cannot be empty',
        type: 'error'
      };
    }

    // Check for balanced braces
    const braceBalance = this.checkBraceBalance(template);
    if (!braceBalance.isBalanced) {
      return {
        isValid: false,
        message: `Unbalanced braces: ${braceBalance.message}`,
        type: 'error'
      };
    }

    // Check for valid template variables
    const variableValidation = this.validateTemplateVariables(template);
    if (!variableValidation.isValid) {
      return variableValidation;
    }

    // Check for potential issues
    const warnings = this.checkTemplateWarnings(template);
    if (warnings.length > 0) {
      return {
        isValid: true,
        message: `Template is valid but has potential issues: ${warnings.join(', ')}`,
        type: 'warning'
      };
    }

    return {
      isValid: true,
      message: 'Template syntax is valid',
      type: 'success'
    };
  }

  /**
   * Checks if braces are balanced in the template
   */
  private checkBraceBalance(template: string): {isBalanced: boolean; message: string} {
    const stack: string[] = [];
    const pairs: Record<string, string> = {'{': '}', '(': ')', '[': ']'};
    const closing: Record<string, string> = {'}': '{', ')': '(', ']': '['};

    for (let i = 0; i < template.length; i++) {
      const char = template[i];

      if (pairs[char]) {
        stack.push(char);
      } else if (closing[char]) {
        if (stack.length === 0) {
          return {isBalanced: false, message: `Unexpected closing '${char}' at position ${i}`};
        }
        const last = stack.pop();
        if (last !== closing[char]) {
          return {isBalanced: false, message: `Mismatched braces: expected '${pairs[last!]}' but found '${char}' at position ${i}`};
        }
      }
    }

    if (stack.length > 0) {
      return {isBalanced: false, message: `Unclosed '${stack[stack.length - 1]}'`};
    }

    return {isBalanced: true, message: ''};
  }

  /**
   * Validates template variables for common patterns
   */
  private validateTemplateVariables(template: string): ValidationResult {
    // Extract variables from template (assuming {{variable}} format)
    const variablePattern = /\{\{([^}]*)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(template)) !== null) {
      variables.push(match[1].trim());
    }

    // Check for empty variables
    const emptyVariables = variables.filter(v => v === '');
    if (emptyVariables.length > 0) {
      return {
        isValid: false,
        message: 'Found empty template variables {{}}',
        type: 'error'
      };
    }

    // Check for invalid variable names
    const invalidVariables = variables.filter(v => !/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(v));
    if (invalidVariables.length > 0) {
      return {
        isValid: false,
        message: `Invalid variable names: ${invalidVariables.join(', ')}. Variables should contain only letters, numbers, underscores, and dots.`,
        type: 'error'
      };
    }

    return {
      isValid: true,
      message: '',
      type: 'success'
    };
  }

  /**
   * Checks for potential template issues
   */
  private checkTemplateWarnings(template: string): string[] {
    const warnings: string[] = [];

    // Check for very long templates
    if (template.length > 200) {
      warnings.push('Template is very long, consider simplifying');
    }

    // Check for special characters that might cause file system issues
    const problematicChars = /[<>:"/\\|?*]/g;
    if (problematicChars.test(template)) {
      warnings.push('Contains characters that may cause file system issues');
    }

    // Check for common typos in variable syntax - look for single braces not part of double braces
    // This is a simple check that looks for single braces that aren't immediately followed/preceded by another brace
    if (template.includes('{') || template.includes('}')) {
      // Remove all valid {{}} patterns first
      const withoutValidBraces = template.replace(/\{\{[^}]*\}\}/g, '');
      // If there are still braces left, they might be single braces
      if (withoutValidBraces.includes('{') || withoutValidBraces.includes('}')) {
        warnings.push('Single braces detected, did you mean double braces {{}}?');
      }
    }

    return warnings;
  }
}
