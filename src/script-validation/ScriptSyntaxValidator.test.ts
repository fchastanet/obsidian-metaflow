import {ScriptSyntaxValidator} from './ScriptSyntaxValidator';
import {ScriptASTParser} from './ScriptASTParser';

describe('ScriptSyntaxValidator', () => {
  let validator: ScriptSyntaxValidator;
  let astParser: ScriptASTParser;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
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
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('return "hello";');

        expect(result.isValid).toBe(true);
        expect(result.message).toBe('');
        expect(result.type).toBe('success');
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        expect(spyError).not.toHaveBeenCalled();
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should accept complex expressions', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('return file.basename + " - " + metadata.title;');

        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        expect(spyError).not.toHaveBeenCalled();
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should accept conditional statements', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax(`
          if (metadata.title) {
            return metadata.title.toUpperCase();
          } else {
            return file.basename.replace(/\\.[^/.]+$/, "");
          }
        `);

        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (3:12)");
        expect(spyError).not.toHaveBeenCalled();
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should accept variable declarations', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax(`
          const title = metadata.title || file.basename;
          const cleanTitle = title.replace(/[^a-zA-Z0-9\\s]/g, '');
          return cleanTitle.trim();
        `);

        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (4:10)");
        expect(spyError).not.toHaveBeenCalled();
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should accept function declarations', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
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
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (7:10)");
        expect(spyError).not.toHaveBeenCalled();
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should accept arrow functions', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax(`
          const formatTitle = title => title.charAt(0).toUpperCase() + title.slice(1);
          return formatTitle(file.basename);
        `);

        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (3:10)");
        expect(spyError).not.toHaveBeenCalled();
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should accept template literals', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('return `Title: ${metadata.title || file.basename}`;');

        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        expect(spyError).not.toHaveBeenCalled();
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should accept regular expressions', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('return file.basename.replace(/\\.[^/.]+$/, "").replace(/[-_]/g, " ");');

        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        expect(spyError).not.toHaveBeenCalled();
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should accept try-catch blocks', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax(`
          try {
            return JSON.parse(metadata.custom).title;
          } catch (e) {
            return file.basename;
          }
        `);

        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (3:12)");
        expect(spyError).not.toHaveBeenCalled();
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should accept switch statements', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
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
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (4:14)");
        expect(spyError).not.toHaveBeenCalled();
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should accept loops', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
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
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (8:10)");
        expect(spyError).not.toHaveBeenCalled();
        spyWarn.mockRestore();
        spyError.mockRestore();
      });
    });

    describe('invalid syntax', () => {
      it('should reject unterminated string', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('return "unterminated string;');

        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
        // Note: Different JS parsers may give different specific error messages
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.anything());
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should reject unexpected token', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('return } invalid;');

        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.anything());
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should reject invalid function syntax', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('function ( { return "test"; }');

        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: Unexpected token (1:9)");
        expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.anything());
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should reject unmatched parentheses', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('return (metadata.title;');

        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.anything());
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should reject unmatched brackets', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('return [1, 2, 3;');

        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.anything());
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should reject unmatched braces', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('if (true) { return "test";');

        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:12)");
        expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.anything());
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should reject invalid arrow function syntax', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('const fn = => "test";');

        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: Unexpected token (1:11)");
        expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.anything());
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should reject truly invalid object literal syntax', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('return {,};'); // Invalid syntax

        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.anything());
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should reject invalid regex', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('return /[/;');

        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.anything());
        spyWarn.mockRestore();
        spyError.mockRestore();
      });

      it('should reject invalid template literal', () => {
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const result = validator.validateSyntax('return `unterminated ${;');

        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
        expect(result.message).toMatch(/Syntax error/);
        expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.anything());
        spyWarn.mockRestore();
        spyError.mockRestore();
      });
    });

    describe('edge cases', () => {
      it('should handle scripts with comments', () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const result = validator.validateSyntax(`
          // This is a valid comment
          /* Multi-line comment
             spanning multiple lines */
          return "hello"; // Inline comment
        `);

        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spy).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (5:10)");
        spy.mockRestore();
      });

      it('should handle scripts with complex string escaping', () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const result = validator.validateSyntax('return "He said \\"Hello\\" to me";');

        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spy).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        spy.mockRestore();
      });

      it('should handle scripts with unicode characters', () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const result = validator.validateSyntax('return "Hello 世界 🌍";');

        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spy).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        spy.mockRestore();
      });

      it('should handle scripts with numeric literals', () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const result = validator.validateSyntax('return 42 + 3.14 + 0xFF + 1e10;');

        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spy).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        spy.mockRestore();
      });

      it('should handle scripts with boolean and null literals', () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        const result = validator.validateSyntax('return true || false || null || undefined;');
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
        expect(spy).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
        spy.mockRestore();
      });
    });

    describe('caching integration', () => {
      it('should use cached AST results', () => {
        const script = 'return "test";';

        const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        // First validation should parse and cache
        const result1 = validator.validateSyntax(script);
        expect(result1.isValid).toBe(true);
        expect(astParser.getCacheSize()).toBe(1);
        expect(spy).toHaveBeenNthCalledWith(1, "error parsing script : SyntaxError: 'return' outside of function (1:0)");
        // Second validation should use cache
        const result2 = validator.validateSyntax(script);
        expect(result2.isValid).toBe(true);
        expect(astParser.getCacheSize()).toBe(1); // Still only one cache entry
        expect(spy).not.toHaveBeenNthCalledWith(2, "error parsing script : SyntaxError: 'return' outside of function (1:0)");
        spy.mockRestore();
      });

      it('should handle cache misses gracefully', () => {
        const script1 = 'return "test1";';
        const script2 = 'return "test2";';

        const spy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        validator.validateSyntax(script1);
        expect(spy).toHaveBeenNthCalledWith(1, "error parsing script : SyntaxError: 'return' outside of function (1:0)");
        validator.validateSyntax(script2);
        expect(spy).toHaveBeenNthCalledWith(2, "error parsing script : SyntaxError: 'return' outside of function (1:0)");
        spy.mockRestore();

        expect(astParser.getCacheSize()).toBe(2);
      });
    });
  });
});
