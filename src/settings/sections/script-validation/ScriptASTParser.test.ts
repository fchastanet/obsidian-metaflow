import { ScriptASTParser } from './ScriptASTParser';

describe('ScriptASTParser', () => {
  let parser: ScriptASTParser;

  beforeEach(() => {
    parser = new ScriptASTParser();
  });

  afterEach(() => {
    parser.clearCache();
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
    });

    it('should parse valid standalone statements', () => {
      const script = 'return "hello world";';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(true);
      expect(result?.originalScript).toBe(script);
    });

    it('should parse complete program without wrapping', () => {
      const script = 'function test() { return "hello"; } test();';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(false);
      expect(result?.originalScript).toBe(script);
    });

    it('should return null for invalid syntax', () => {
      const script = 'return "unterminated string;';
      const result = parser.parseScript(script);

      expect(result).toBeNull();
    });

    it('should return null for completely malformed script', () => {
      const script = '}{invalid syntax here}{';
      const result = parser.parseScript(script);

      expect(result).toBeNull();
    });

    it('should handle empty script', () => {
      const script = '';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      // Empty script can be parsed, check the actual wrapper status
      expect(typeof result?.isWrapped).toBe('boolean');
    });

    it('should handle whitespace-only script', () => {
      const script = '   \n  \t  ';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      // Whitespace script can be parsed, check the actual wrapper status
      expect(typeof result?.isWrapped).toBe('boolean');
    });

    it('should parse complex expressions', () => {
      const script = 'return file.basename + " - " + (metadata.title || "Untitled");';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(true);
    });

    it('should parse conditional statements', () => {
      const script = 'if (metadata.title) { return metadata.title; } else { return file.basename; }';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(true);
    });
  });

  describe('caching', () => {
    it('should cache parsed results', () => {
      const script = 'return "hello";';
      const result1 = parser.parseScript(script);
      const result2 = parser.parseScript(script);

      expect(result1).toBe(result2); // Same object reference
    });

    it('should cache null results for invalid scripts', () => {
      const script = 'return "invalid;';
      const result1 = parser.parseScript(script);
      const result2 = parser.parseScript(script);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(parser.getCacheSize()).toBe(1);
    });

    it('should maintain separate cache entries for different scripts', () => {
      const script1 = 'return "hello";';
      const script2 = 'return "world";';

      parser.parseScript(script1);
      parser.parseScript(script2);

      expect(parser.getCacheSize()).toBe(2);
    });

    it('should clear cache correctly', () => {
      parser.parseScript('return "test1";');
      parser.parseScript('return "test2";');
      
      expect(parser.getCacheSize()).toBe(2);
      
      parser.clearCache();
      
      expect(parser.getCacheSize()).toBe(0);
    });

    it('should rebuild cache after clearing', () => {
      const script = 'return "hello";';
      const result1 = parser.parseScript(script);
      
      parser.clearCache();
      
      const result2 = parser.parseScript(script);
      
      expect(result1).not.toBe(result2); // Different object references
      expect(result1?.originalScript).toBe(result2?.originalScript);
      expect(parser.getCacheSize()).toBe(1);
    });
  });

  describe('canParse', () => {
    it('should return true for valid scripts', () => {
      expect(parser.canParse('return "hello";')).toBe(true);
      expect(parser.canParse('const x = 5; return x;')).toBe(true);
      expect(parser.canParse('if (true) return "yes"; else return "no";')).toBe(true);
    });

    it('should return false for invalid scripts', () => {
      expect(parser.canParse('return "unterminated;')).toBe(false);
      expect(parser.canParse('}{invalid}')).toBe(false);
      expect(parser.canParse('return @#$%^&*;')).toBe(false);
    });

    it('should return true for empty scripts', () => {
      expect(parser.canParse('')).toBe(true);
      expect(parser.canParse('   ')).toBe(true);
    });

    it('should use cache for canParse checks', () => {
      const script = 'return "test";';
      
      parser.canParse(script);
      expect(parser.getCacheSize()).toBe(1);
      
      parser.canParse(script); // Should use cache
      expect(parser.getCacheSize()).toBe(1);
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
    });

    it('should handle scripts with string literals containing quotes', () => {
      const script = `return "He said 'hello' to me";`;
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
    });

    it('should handle scripts with template literals', () => {
      const script = 'return `Hello ${name}, today is ${new Date().toDateString()}`;';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
    });

    it('should handle scripts with regex literals', () => {
      const script = 'return /hello\\s+world/gi.test(text) ? "match" : "no match";';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
    });

    it('should handle scripts with arrow functions', () => {
      const script = 'return [1,2,3].map(x => x * 2).join(", ");';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
    });

    it('should handle scripts with destructuring', () => {
      const script = 'const {title, author} = metadata; return `${title} by ${author}`;';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
    });

    it('should handle scripts with async/await', () => {
      const script = 'async function getTitle() { return await Promise.resolve("title"); }';
      const result = parser.parseScript(script);

      expect(result).not.toBeNull();
    });
  });

  describe('memory management', () => {
    it('should handle large number of different scripts', () => {
      const scripts = Array.from({length: 100}, (_, i) => `return "script${i}";`);
      
      scripts.forEach(script => parser.parseScript(script));
      
      expect(parser.getCacheSize()).toBe(100);
    });

    it('should handle repeated parsing of same script efficiently', () => {
      const script = 'return "repeated";';
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        parser.parseScript(script);
      }
      
      expect(parser.getCacheSize()).toBe(1); // Only one cache entry
    });
  });
});
