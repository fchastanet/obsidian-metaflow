import { ScriptSyntaxValidator } from './ScriptSyntaxValidator';
import { ScriptASTParser } from './ScriptASTParser';

describe('ScriptSyntaxValidator', () => {
  let validator: ScriptSyntaxValidator;
  let astParser: ScriptASTParser;

  beforeEach(() => {
    astParser = new ScriptASTParser();
    validator = new ScriptSyntaxValidator(astParser);
  });

  afterEach(() => {
    astParser.clearCache();
  });

  describe('validateSyntax', () => {
    describe('empty scripts', () => {
      it('should reject empty script', () => {
        const result = validator.validateSyntax('');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Script cannot be empty');
        expect(result.type).toBe('error');
      });

      it('should reject whitespace-only script', () => {
        const result = validator.validateSyntax('   \n  \t  ');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Script cannot be empty');
        expect(result.type).toBe('error');
      });

      it('should reject null script', () => {
        const result = validator.validateSyntax(null as any);
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Script cannot be empty');
        expect(result.type).toBe('error');
      });

      it('should reject undefined script', () => {
        const result = validator.validateSyntax(undefined as any);
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Script cannot be empty');
        expect(result.type).toBe('error');
      });
    });

    describe('valid syntax', () => {
      it('should accept simple return statement', () => {
        const result = validator.validateSyntax('return "hello";');
        
        expect(result.isValid).toBe(true);
        expect(result.message).toBe('');
        expect(result.type).toBe('success');
      });

      it('should accept complex expressions', () => {
        const result = validator.validateSyntax('return file.basename + " - " + metadata.title;');
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept conditional statements', () => {
        const result = validator.validateSyntax(`
          if (metadata.title) {
            return metadata.title.toUpperCase();
          } else {
            return file.basename.replace(/\\.[^/.]+$/, "");
          }
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept variable declarations', () => {
        const result = validator.validateSyntax(`
          const title = metadata.title || file.basename;
          const cleanTitle = title.replace(/[^a-zA-Z0-9\\s]/g, '');
          return cleanTitle.trim();
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept function declarations', () => {
        const result = validator.validateSyntax(`
          function formatTitle(title) {
            return title.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
          }
          return formatTitle(metadata.title || file.basename);
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept arrow functions', () => {
        const result = validator.validateSyntax(`
          const formatTitle = title => title.charAt(0).toUpperCase() + title.slice(1);
          return formatTitle(file.basename);
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept template literals', () => {
        const result = validator.validateSyntax('return `Title: ${metadata.title || file.basename}`;');
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept regular expressions', () => {
        const result = validator.validateSyntax('return file.basename.replace(/\\.[^/.]+$/, "").replace(/[-_]/g, " ");');
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept try-catch blocks', () => {
        const result = validator.validateSyntax(`
          try {
            return JSON.parse(metadata.custom).title;
          } catch (e) {
            return file.basename;
          }
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept switch statements', () => {
        const result = validator.validateSyntax(`
          switch (metadata.type) {
            case 'article':
              return 'Article: ' + metadata.title;
            case 'note':
              return 'Note: ' + metadata.title;
            default:
              return file.basename;
          }
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept loops', () => {
        const result = validator.validateSyntax(`
          let title = file.basename;
          for (let i = 0; i < title.length; i++) {
            if (title[i] === '_') {
              title = title.substring(0, i) + ' ' + title.substring(i + 1);
            }
          }
          return title;
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });
    });

    describe('invalid syntax', () => {
      it('should reject unterminated string', () => {
        const result = validator.validateSyntax('return "unterminated string;');
        
        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
        // Note: Different JS parsers may give different specific error messages
      });

      it('should reject unexpected token', () => {
        const result = validator.validateSyntax('return } invalid;');
        
        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
      });

      it('should reject invalid function syntax', () => {
        const result = validator.validateSyntax('function ( { return "test"; }');
        
        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
      });

      it('should reject unmatched parentheses', () => {
        const result = validator.validateSyntax('return (metadata.title;');
        
        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
      });

      it('should reject unmatched brackets', () => {
        const result = validator.validateSyntax('return [1, 2, 3;');
        
        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
      });

      it('should reject unmatched braces', () => {
        const result = validator.validateSyntax('if (true) { return "test";');
        
        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
      });

      it('should reject invalid arrow function syntax', () => {
        const result = validator.validateSyntax('const fn = => "test";');
        
        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
      });

      it('should reject truly invalid object literal syntax', () => {
        const result = validator.validateSyntax('return {,};'); // Invalid syntax
        
        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
      });

      it('should reject invalid regex', () => {
        const result = validator.validateSyntax('return /[/;');
        
        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
      });

      it('should reject invalid template literal', () => {
        const result = validator.validateSyntax('return `unterminated ${;');
        
        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
      });
    });

    describe('edge cases', () => {
      it('should handle scripts with comments', () => {
        const result = validator.validateSyntax(`
          // This is a valid comment
          /* Multi-line comment
             spanning multiple lines */
          return "hello"; // Inline comment
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should handle scripts with complex string escaping', () => {
        const result = validator.validateSyntax('return "He said \\"Hello\\" to me";');
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should handle scripts with unicode characters', () => {
        const result = validator.validateSyntax('return "Hello 世界 🌍";');
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should handle scripts with numeric literals', () => {
        const result = validator.validateSyntax('return 42 + 3.14 + 0xFF + 1e10;');
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should handle scripts with boolean and null literals', () => {
        const result = validator.validateSyntax('return true || false || null || undefined;');
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });
    });

    describe('caching integration', () => {
      it('should use cached AST results', () => {
        const script = 'return "test";';
        
        // First validation should parse and cache
        const result1 = validator.validateSyntax(script);
        expect(result1.isValid).toBe(true);
        expect(astParser.getCacheSize()).toBe(1);
        
        // Second validation should use cache
        const result2 = validator.validateSyntax(script);
        expect(result2.isValid).toBe(true);
        expect(astParser.getCacheSize()).toBe(1); // Still only one cache entry
      });

      it('should handle cache misses gracefully', () => {
        const script1 = 'return "test1";';
        const script2 = 'return "test2";';
        
        validator.validateSyntax(script1);
        validator.validateSyntax(script2);
        
        expect(astParser.getCacheSize()).toBe(2);
      });
    });
  });
});
