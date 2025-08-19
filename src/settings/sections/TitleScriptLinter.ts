import * as acorn from 'acorn';

/**
 * ValidationResult interface for script validation feedback
 */
export interface ValidationResult {
  isValid: boolean;
  message: string;
  type: 'error' | 'warning' | 'success';
}

/**
 * TitleScriptLinter provides validation for JavaScript scripts used in note title generation
 * with user-friendly feedback messages and comprehensive AST-based analysis.
 */
export class TitleScriptLinter {

  /**
   * Validates a JavaScript script for note title generation
   * @param script The script string to validate
   * @returns ValidationResult with feedback
   */
  validateScript(script: string): ValidationResult {
    if (!script || script.trim() === '') {
      return {
        isValid: false,
        message: 'Script cannot be empty',
        type: 'error'
      };
    }

    // Check for return statement
    if (!this.hasReturnStatement(script)) {
      return {
        isValid: false,
        message: 'Script must contain a return statement',
        type: 'error'
      };
    }

    // Basic syntax validation
    const syntaxValidation = this.validateScriptSyntax(script);
    if (!syntaxValidation.isValid) {
      return syntaxValidation;
    }

    // Check for security issues
    const securityValidation = this.checkScriptSecurity(script);
    if (!securityValidation.isValid) {
      return securityValidation;
    }

    // Check for missing return statements in branches
    const branchValidation = this.validateAllBranchesReturn(script);
    if (!branchValidation.isValid) {
      return branchValidation;
    }

    // Check for best practices
    const warnings = this.checkScriptWarnings(script);
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
   * Checks if script contains a return statement using AST parsing
   */
  private hasReturnStatement(script: string): boolean {
    try {
      // Wrap script in function to make it valid for parsing
      const wrappedScript = `function temp() { ${script} }`;
      const ast = acorn.parse(wrappedScript, { ecmaVersion: 'latest' });
      return this.hasReturnInNode(ast);
    } catch (error) {
      // If parsing fails, fall back to regex as a last resort
      const cleaned = this.removeCommentsAndStrings(script);
      return /\breturn\b/.test(cleaned);
    }
  }

  /**
   * Recursively checks if a node or its children contain a return statement
   */
  private hasReturnInNode(node: any): boolean {
    if (!node || typeof node !== 'object') {
      return false;
    }

    if (node.type === 'ReturnStatement') {
      return true;
    }

    // Check all properties of the node
    for (const key in node) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (this.hasReturnInNode(item)) {
            return true;
          }
        }
      } else if (value && typeof value === 'object') {
        if (this.hasReturnInNode(value)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * JavaScript syntax validation using Acorn parser
   */
  private validateScriptSyntax(script: string): ValidationResult {
    try {
      // First try parsing as-is for complete programs
      try {
        acorn.parse(script, { ecmaVersion: 'latest' });
      } catch (error) {
        // If that fails, try wrapping in function (for script fragments)
        const wrappedScript = `function temp() { ${script} }`;
        acorn.parse(wrappedScript, { ecmaVersion: 'latest' });
      }

      return {
        isValid: true,
        message: '',
        type: 'success'
      };
    } catch (error) {
      let message = 'Unknown syntax error';

      if (error instanceof Error) {
        // Acorn provides more detailed error messages
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
  }

  /**
   * Checks for potential security issues in scripts using AST analysis
   */
  private checkScriptSecurity(script: string): ValidationResult {
    try {
      // Try parsing as-is first, then wrapped in function
      let ast;
      try {
        ast = acorn.parse(script, { ecmaVersion: 'latest' });
      } catch (error) {
        const wrappedScript = `function temp() { ${script} }`;
        ast = acorn.parse(wrappedScript, { ecmaVersion: 'latest' });
      }

      const securityIssue = this.findSecurityIssues(ast);

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
    } catch (error) {
      // If AST parsing fails, fall back to regex patterns
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
   * Validates that all execution paths return a string value
   */
  private validateAllBranchesReturn(script: string): ValidationResult {
    try {
      // Try parsing as-is first, then wrapped in function
      let ast;
      try {
        ast = acorn.parse(script, { ecmaVersion: 'latest' });
      } catch (error) {
        const wrappedScript = `function temp() { ${script} }`;
        ast = acorn.parse(wrappedScript, { ecmaVersion: 'latest' });
      }

      const analysis = this.analyzeExecutionPaths(ast);

      if (!analysis.allPathsReturn) {
        return {
          isValid: false,
          message: 'Not all execution paths return a value. Ensure every branch returns a string.',
          type: 'error'
        };
      }

      if (!analysis.allReturnsAreStrings) {
        return {
          isValid: false,
          message: 'Some return statements may not return strings. All returns should be string values.',
          type: 'error'
        };
      }

      return {
        isValid: true,
        message: '',
        type: 'success'
      };
    } catch (error) {
      // If AST parsing fails, we can't analyze paths, so we'll let it pass
      // The syntax validation would have already caught parsing errors
      return {
        isValid: true,
        message: '',
        type: 'success'
      };
    }
  }

  /**
   * Analyzes execution paths to ensure all paths return and all returns are strings
   */
  private analyzeExecutionPaths(node: any): { allPathsReturn: boolean; allReturnsAreStrings: boolean } {
    if (!node || typeof node !== 'object') {
      return { allPathsReturn: false, allReturnsAreStrings: true };
    }

    return this.analyzeNode(node);
  }

  /**
   * Recursively analyzes a node to check execution paths
   */
  private analyzeNode(node: any): { allPathsReturn: boolean; allReturnsAreStrings: boolean } {
    if (!node || typeof node !== 'object') {
      return { allPathsReturn: false, allReturnsAreStrings: true };
    }

    switch (node.type) {
      case 'Program':
      case 'BlockStatement':
        return this.analyzeBlock(node.body || []);

      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return this.analyzeNode(node.body);

      case 'ReturnStatement':
        return {
          allPathsReturn: true,
          allReturnsAreStrings: node.argument ? this.isLikelyStringExpression(node.argument) : false
        };

      case 'IfStatement':
        return this.analyzeIfStatement(node);

      case 'SwitchStatement':
        return this.analyzeSwitchStatement(node);

      case 'TryStatement':
        return this.analyzeTryStatement(node);

      case 'WhileStatement':
      case 'DoWhileStatement':
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
        // Loops don't guarantee execution, so they can't provide a return for all paths
        const loopAnalysis = this.analyzeNode(node.body);
        return { allPathsReturn: false, allReturnsAreStrings: loopAnalysis.allReturnsAreStrings };

      default:
        // For other statements, check if they contain any returns
        let hasReturn = false;
        let allReturnsAreStrings = true;

        for (const key in node) {
          const value = node[key];
          if (Array.isArray(value)) {
            for (const item of value) {
              const analysis = this.analyzeNode(item);
              if (analysis.allPathsReturn) hasReturn = true;
              if (!analysis.allReturnsAreStrings) allReturnsAreStrings = false;
            }
          } else if (value && typeof value === 'object') {
            const analysis = this.analyzeNode(value);
            if (analysis.allPathsReturn) hasReturn = true;
            if (!analysis.allReturnsAreStrings) allReturnsAreStrings = false;
          }
        }

        return { allPathsReturn: hasReturn, allReturnsAreStrings };
    }
  }

  /**
   * Analyzes a block of statements
   */
  private analyzeBlock(statements: any[]): { allPathsReturn: boolean; allReturnsAreStrings: boolean } {
    let allReturnsAreStrings = true;

    for (const stmt of statements) {
      const analysis = this.analyzeNode(stmt);

      if (!analysis.allReturnsAreStrings) {
        allReturnsAreStrings = false;
      }

      // If we find a return statement, this path returns
      if (analysis.allPathsReturn) {
        return { allPathsReturn: true, allReturnsAreStrings };
      }
    }

    return { allPathsReturn: false, allReturnsAreStrings };
  }

  /**
   * Analyzes an if statement to check all branches
   */
  private analyzeIfStatement(node: any): { allPathsReturn: boolean; allReturnsAreStrings: boolean } {
    const consequentAnalysis = this.analyzeNode(node.consequent);
    const alternateAnalysis = node.alternate ? this.analyzeNode(node.alternate) : { allPathsReturn: false, allReturnsAreStrings: true };

    return {
      allPathsReturn: consequentAnalysis.allPathsReturn && alternateAnalysis.allPathsReturn,
      allReturnsAreStrings: consequentAnalysis.allReturnsAreStrings && alternateAnalysis.allReturnsAreStrings
    };
  }

  /**
   * Analyzes a switch statement to check all cases
   */
  private analyzeSwitchStatement(node: any): { allPathsReturn: boolean; allReturnsAreStrings: boolean } {
    let hasDefault = false;
    let allCasesReturn = true;
    let allReturnsAreStrings = true;

    for (const caseNode of node.cases) {
      if (caseNode.test === null) { // default case
        hasDefault = true;
      }

      const caseAnalysis = this.analyzeBlock(caseNode.consequent);
      if (!caseAnalysis.allPathsReturn) {
        allCasesReturn = false;
      }
      if (!caseAnalysis.allReturnsAreStrings) {
        allReturnsAreStrings = false;
      }
    }

    return {
      allPathsReturn: hasDefault && allCasesReturn,
      allReturnsAreStrings
    };
  }

  /**
   * Analyzes a try-catch statement
   */
  private analyzeTryStatement(node: any): { allPathsReturn: boolean; allReturnsAreStrings: boolean } {
    const tryAnalysis = this.analyzeNode(node.block);
    const catchAnalysis = node.handler ? this.analyzeNode(node.handler.body) : { allPathsReturn: false, allReturnsAreStrings: true };
    const finallyAnalysis = node.finalizer ? this.analyzeNode(node.finalizer) : { allPathsReturn: false, allReturnsAreStrings: true };

    return {
      allPathsReturn: tryAnalysis.allPathsReturn && catchAnalysis.allPathsReturn,
      allReturnsAreStrings: tryAnalysis.allReturnsAreStrings && catchAnalysis.allReturnsAreStrings && finallyAnalysis.allReturnsAreStrings
    };
  }

  /**
   * Checks for script best practices using AST analysis
   */
  private checkScriptWarnings(script: string): string[] {
    const warnings: string[] = [];

    // Check for very long scripts
    if (script.length > 1000) {
      warnings.push('Script is very long, consider breaking it down');
    }

    try {
      // Try parsing as-is first, then wrapped in function
      let ast;
      try {
        ast = acorn.parse(script, { ecmaVersion: 'latest' });
      } catch (error) {
        const wrappedScript = `function temp() { ${script} }`;
        ast = acorn.parse(wrappedScript, { ecmaVersion: 'latest' });
      }

      // Check for console statements using AST
      if (this.hasConsoleStatements(ast)) {
        warnings.push('Remove console statements before deployment');
      }

      // Check if script returns string using AST analysis
      if (!this.returnsStringAST(ast)) {
        warnings.push('Script should return a string for the title');
      }
    } catch (error) {
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

  /**
   * Heuristic check if script likely returns a string
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
}
