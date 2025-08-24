import { ValidationResult } from './ValidationResult';
import { ScriptASTParser, ParsedScript } from './ScriptASTParser';

/**
 * ScriptReturnAnalyzer handles analysis of return statements and execution paths
 */
export class ScriptReturnAnalyzer {
  constructor(private astParser: ScriptASTParser) {}

  /**
   * Checks if script contains a return statement
   * @param script The script to check
   * @returns true if the script has a return statement
   */
  hasReturnStatement(script: string): boolean {
    const parsed = this.astParser.parseScript(script);
    
    if (parsed) {
      return this.hasReturnInNode(parsed.ast);
    }

    // Fall back to regex if AST parsing fails
    const cleaned = this.removeCommentsAndStrings(script);
    return /\breturn\b/.test(cleaned);
  }

  /**
   * Validates that all execution paths return a value
   * @param script The script to validate
   * @returns ValidationResult with execution path analysis
   */
  validateAllBranchesReturn(script: string): ValidationResult {
    const parsed = this.astParser.parseScript(script);

    if (parsed) {
      const analysis = this.analyzeExecutionPaths(parsed.ast);

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
    }

    // If AST parsing fails, we can't analyze paths, so we'll let it pass
    // The syntax validation would have already caught parsing errors
    return {
      isValid: true,
      message: '',
      type: 'success'
    };
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
}
