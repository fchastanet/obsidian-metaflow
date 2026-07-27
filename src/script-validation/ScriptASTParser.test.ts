import {ScriptASTParser} from './ScriptASTParser';

describe('ScriptASTParser', () => {
  let parser: ScriptASTParser;
  let spyWarn: jest.SpyInstance;
  let spyError: jest.SpyInstance;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    parser = new ScriptASTParser();
    spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
    spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    parser.clearCache();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  describe('parseScript', () => {
    it('should parse valid complete script', () => {
      const script = 'const x = 5; return x.toString();';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(true);
      expect(result?.originalScript).toBe(script);
      expect(result?.ast).toBeDefined();
      expect(result?.ast.type).toBe('Program');
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:13)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should parse valid standalone statements', () => {
      const script = 'return "hello world";';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(true);
      expect(result?.originalScript).toBe(script);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should parse complete program without wrapping', () => {
      const script = 'function test() { return "hello"; } test();';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(false);
      expect(result?.originalScript).toBe(script);
      expect(spyWarn).not.toHaveBeenCalled();
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should return null for invalid syntax', () => {
      const script = 'return "unterminated string;';
      const result = parser.parseScript(script);

      expect(result).toBeNull();
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.any(SyntaxError));
    });

    it('should return null for completely malformed script', () => {
      const script = '}{invalid syntax here}{';
      const result = parser.parseScript(script);

      expect(result).toBeNull();
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: Unexpected token (1:0)");
      expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.any(SyntaxError));
    });

    it('should handle empty script', () => {
      const script = '';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      // Empty script can be parsed, check the actual wrapper status
      expect(typeof result?.isWrapped).toBe('boolean');
      expect(spyWarn).not.toHaveBeenCalled();
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only script', () => {
      const script = '   \n  \t  ';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      // Whitespace script can be parsed, check the actual wrapper status
      expect(typeof result?.isWrapped).toBe('boolean');
      expect(spyWarn).not.toHaveBeenCalled();
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should parse complex expressions', () => {
      const script = 'return file.basename + " - " + (metadata.title || "Untitled");';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(true);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should parse conditional statements', () => {
      const script = 'if (metadata.title) { return metadata.title; } else { return file.basename; }';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(true);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:22)");
      expect(spyError).not.toHaveBeenCalled();
    });
  });

  describe('caching', () => {
    it('should cache parsed results', () => {
      const script = 'return "hello";';
      const result1 = parser.parseScript(script);
      const result2 = parser.parseScript(script);

      expect(result1).toBe(result2); // Same object reference
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should cache null results for invalid scripts', () => {
      const script = 'return "invalid;';
      const result1 = parser.parseScript(script);
      const result2 = parser.parseScript(script);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(parser.getCacheSize()).toBe(1);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.any(SyntaxError));
    });

    it('should maintain separate cache entries for different scripts', () => {
      const script1 = 'return "hello";';
      const script2 = 'return "world";';

      parser.parseScript(script1);
      parser.parseScript(script2);

      expect(parser.getCacheSize()).toBe(2);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should clear cache correctly', () => {
      parser.parseScript('return "test1";');
      parser.parseScript('return "test2";');

      expect(parser.getCacheSize()).toBe(2);

      parser.clearCache();

      expect(parser.getCacheSize()).toBe(0);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should rebuild cache after clearing', () => {
      const script = 'return "hello";';
      const result1 = parser.parseScript(script);

      parser.clearCache();

      const result2 = parser.parseScript(script);

      expect(result1).not.toBe(result2); // Different object references
      expect(result1?.originalScript).toBe(result2?.originalScript);
      expect(parser.getCacheSize()).toBe(1);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });
  });

  describe('canParse', () => {
    it('should return true for valid scripts', () => {
      expect(parser.canParse('return "hello";')).toBe(true);
      expect(parser.canParse('const x = 5; return x;')).toBe(true);
      expect(parser.canParse('if (true) return "yes"; else return "no";')).toBe(true);
      expect(spyWarn).toHaveBeenCalledTimes(3);
      expect(spyWarn).toHaveBeenNthCalledWith(1, "error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyWarn).toHaveBeenNthCalledWith(2, "error parsing script : SyntaxError: 'return' outside of function (1:13)");
      expect(spyWarn).toHaveBeenNthCalledWith(3, "error parsing script : SyntaxError: 'return' outside of function (1:10)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should return false for invalid scripts', () => {
      expect(parser.canParse('return "unterminated;')).toBe(false);
      expect(parser.canParse('}{invalid}')).toBe(false);
      expect(parser.canParse('return @#$%^&*;')).toBe(false);
      expect(spyWarn).toHaveBeenCalledTimes(3);
      expect(spyWarn).toHaveBeenNthCalledWith(1, "error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyWarn).toHaveBeenNthCalledWith(2, "error parsing script : SyntaxError: Unexpected token (1:0)");
      expect(spyWarn).toHaveBeenNthCalledWith(3, "error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).toHaveBeenCalledTimes(3);
      expect(spyError).toHaveBeenNthCalledWith(1, "Error parsing script:", expect.any(SyntaxError));
      expect(spyError).toHaveBeenNthCalledWith(2, "Error parsing script:", expect.any(SyntaxError));
      expect(spyError).toHaveBeenNthCalledWith(3, "Error parsing script:", expect.any(SyntaxError));
    });

    it('should return true for empty scripts', () => {
      expect(parser.canParse('')).toBe(true);
      expect(parser.canParse('   ')).toBe(true);
      expect(spyWarn).not.toHaveBeenCalled();
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should use cache for canParse checks', () => {
      const script = 'return "test";';

      parser.canParse(script);
      expect(parser.getCacheSize()).toBe(1);

      parser.canParse(script); // Should use cache
      expect(parser.getCacheSize()).toBe(1);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle scripts with comments', () => {
      const script = `
        // This is a comment
        /* Multi-line
           comment */
        return "hello"; // End comment
      `;
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(true);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (5:8)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should handle scripts with string literals containing quotes', () => {
      const script = `return "He said 'hello' to me";`;
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should handle scripts with template literals', () => {
      const script = 'return `Hello ${name}, today is ${new Date().toDateString()}`;';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should handle scripts with regex literals', () => {
      const script = 'return /hello\\s+world/gi.test(text) ? "match" : "no match";';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should handle scripts with arrow functions', () => {
      const script = 'return [1,2,3].map(x => x * 2).join(", ");';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should handle scripts with destructuring', () => {
      const script = 'const {title, author} = metadata; return `${title} by ${author}`;';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:34)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should handle scripts with async/await', () => {
      const script = 'async function getTitle() { return await Promise.resolve("title"); }';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(spyWarn).not.toHaveBeenCalled();
      expect(spyError).not.toHaveBeenCalled();
    });
  });

  describe('memory management', () => {
    it('should handle large number of different scripts', () => {
      const scripts = Array.from({length: 100}, (_, i) => `return "script${i}";`);

      scripts.forEach(script => parser.parseScript(script));

      expect(parser.getCacheSize()).toBe(100);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });

    it('should handle repeated parsing of same script efficiently', () => {
      const script = 'return "repeated";';
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        parser.parseScript(script);
      }

      expect(parser.getCacheSize()).toBe(1); // Only one cache entry
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
    });
  });
});
