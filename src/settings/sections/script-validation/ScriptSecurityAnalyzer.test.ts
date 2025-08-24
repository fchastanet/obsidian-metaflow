import { ScriptSecurityAnalyzer } from './ScriptSecurityAnalyzer';
import { ScriptASTParser } from './ScriptASTParser';

describe('ScriptSecurityAnalyzer', () => {
  let analyzer: ScriptSecurityAnalyzer;
  let astParser: ScriptASTParser;

  beforeEach(() => {
    astParser = new ScriptASTParser();
    analyzer = new ScriptSecurityAnalyzer(astParser);
  });

  afterEach(() => {
    astParser.clearCache();
  });

  describe('checkSecurity', () => {
    describe('safe scripts', () => {
      it('should accept simple return statements', () => {
        const result = analyzer.checkSecurity('return "hello world";');
        
        expect(result.isValid).toBe(true);
        expect(result.message).toBe('');
        expect(result.type).toBe('success');
      });

      it('should accept variable operations', () => {
        const result = analyzer.checkSecurity(`
          const title = metadata.title || file.basename;
          return title.toUpperCase();
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept string manipulation', () => {
        const result = analyzer.checkSecurity(`
          return file.basename
            .replace(/\\.[^/.]+$/, "")
            .replace(/[-_]/g, " ")
            .trim();
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept array operations', () => {
        const result = analyzer.checkSecurity(`
          const words = file.basename.split(/[-_\\s]+/);
          return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept date operations', () => {
        const result = analyzer.checkSecurity(`
          const now = new Date();
          return file.basename + " (" + now.getFullYear() + ")";
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept JSON operations', () => {
        const result = analyzer.checkSecurity(`
          try {
            const data = JSON.parse(metadata.custom);
            return data.title || file.basename;
          } catch (e) {
            return file.basename;
          }
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept regular expressions', () => {
        const result = analyzer.checkSecurity(`
          return file.basename.replace(/[^a-zA-Z0-9\\s]/g, '').trim();
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should accept conditional logic', () => {
        const result = analyzer.checkSecurity(`
          if (metadata.title && metadata.title.length > 0) {
            return metadata.title;
          } else if (file.name) {
            return file.name;
          } else {
            return "Untitled";
          }
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });
    });

    describe('dangerous patterns - AST detection', () => {
      it('should reject eval() usage', () => {
        const result = analyzer.checkSecurity('return eval("2 + 2");');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: eval() is potentially dangerous');
        expect(result.type).toBe('error');
      });

      it('should reject Function constructor', () => {
        const result = analyzer.checkSecurity('return Function("return 42")();');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: Dynamic function creation may be unsafe');
        expect(result.type).toBe('error');
      });

      it('should reject new Function()', () => {
        const result = analyzer.checkSecurity('const fn = new Function("a", "b", "return a + b"); return fn(1, 2);');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: Dynamic function creation may be unsafe');
        expect(result.type).toBe('error');
      });

      it('should reject setTimeout', () => {
        const result = analyzer.checkSecurity('setTimeout(() => console.log("hello"), 1000); return "test";');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: Timer functions may cause performance issues');
        expect(result.type).toBe('error');
      });

      it('should reject setInterval', () => {
        const result = analyzer.checkSecurity('setInterval(() => console.log("hello"), 1000); return "test";');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: Timer functions may cause performance issues');
        expect(result.type).toBe('error');
      });

      it('should reject require() calls', () => {
        const result = analyzer.checkSecurity('const fs = require("fs"); return fs.readFileSync("file.txt");');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: require() may access system resources');
        expect(result.type).toBe('error');
      });

      it('should reject dynamic imports', () => {
        const result = analyzer.checkSecurity('const module = await import("./module.js"); return module.getData();');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: Dynamic imports may access external resources');
        expect(result.type).toBe('error');
      });

      it('should detect eval in nested expressions', () => {
        const result = analyzer.checkSecurity(`
          const data = {
            process: function(code) {
              return eval(code);
            }
          };
          return data.process("2 + 2");
        `);
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: eval() is potentially dangerous');
        expect(result.type).toBe('error');
      });

      it('should detect Function in object methods', () => {
        const result = analyzer.checkSecurity(`
          const utils = {
            createFunction: function(body) {
              return new Function(body);
            }
          };
          return utils.createFunction("return 42")();
        `);
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: Dynamic function creation may be unsafe');
        expect(result.type).toBe('error');
      });

      it('should detect setTimeout in callback', () => {
        const result = analyzer.checkSecurity(`
          function delayedTitle() {
            setTimeout(() => {
              console.log("Delayed execution");
            }, 100);
            return "title";
          }
          return delayedTitle();
        `);
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: Timer functions may cause performance issues');
        expect(result.type).toBe('error');
      });
    });

    describe('dangerous patterns - regex fallback', () => {
      it('should reject eval when AST parsing fails', () => {
        // Mock AST parser to return null to test regex fallback
        jest.spyOn(astParser, 'parseScript').mockReturnValue(null);
        
        const result = analyzer.checkSecurity('return eval("test");');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: eval() is potentially dangerous');
        expect(result.type).toBe('error');
      });

      it('should reject Function constructor when AST parsing fails', () => {
        jest.spyOn(astParser, 'parseScript').mockReturnValue(null);
        
        const result = analyzer.checkSecurity('return Function("return 42")();');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: Dynamic function creation may be unsafe');
        expect(result.type).toBe('error');
      });

      it('should reject setTimeout when AST parsing fails', () => {
        jest.spyOn(astParser, 'parseScript').mockReturnValue(null);
        
        const result = analyzer.checkSecurity('setTimeout(fn, 100);');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: Timer functions may cause performance issues');
        expect(result.type).toBe('error');
      });

      it('should reject setInterval when AST parsing fails', () => {
        jest.spyOn(astParser, 'parseScript').mockReturnValue(null);
        
        const result = analyzer.checkSecurity('setInterval(fn, 100);');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: Timer functions may cause performance issues');
        expect(result.type).toBe('error');
      });

      it('should reject require when AST parsing fails', () => {
        jest.spyOn(astParser, 'parseScript').mockReturnValue(null);
        
        const result = analyzer.checkSecurity('const fs = require("fs");');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: require() may access system resources');
        expect(result.type).toBe('error');
      });

      it('should reject dynamic import when AST parsing fails', () => {
        jest.spyOn(astParser, 'parseScript').mockReturnValue(null);
        
        const result = analyzer.checkSecurity('import("module");');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: Dynamic imports may access external resources');
        expect(result.type).toBe('error');
      });

      it('should accept safe script when AST parsing fails', () => {
        jest.spyOn(astParser, 'parseScript').mockReturnValue(null);
        
        const result = analyzer.checkSecurity('return "safe content";');
        
        expect(result.isValid).toBe(true);
        expect(result.message).toBe('');
        expect(result.type).toBe('success');
      });
    });

    describe('edge cases', () => {
      it('should handle empty scripts', () => {
        const result = analyzer.checkSecurity('');
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should handle scripts with only comments', () => {
        const result = analyzer.checkSecurity('// Just a comment');
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should not be fooled by string literals containing dangerous patterns', () => {
        const result = analyzer.checkSecurity('return "This string contains eval but is safe";');
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should not be fooled by comments containing dangerous patterns', () => {
        const result = analyzer.checkSecurity(`
          // This comment mentions eval() but it's safe
          /* Another comment with Function() constructor */
          return "safe";
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should detect dangerous patterns in template literals', () => {
        const result = analyzer.checkSecurity('return `Result: ${eval("2+2")}`;');
        
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Security concern: eval() is potentially dangerous');
        expect(result.type).toBe('error');
      });

      it('should handle method names that contain dangerous words but are safe', () => {
        const result = analyzer.checkSecurity(`
          const obj = {
            evaluateTitle: function() { return "title"; },
            setTimeoutValue: 1000
          };
          return obj.evaluateTitle();
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should handle variable names that contain dangerous words', () => {
        const result = analyzer.checkSecurity(`
          const evalResult = "not actually eval";
          const functionName = "not actually Function";
          return evalResult + functionName;
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should handle property access that looks like dangerous functions', () => {
        const result = analyzer.checkSecurity(`
          const obj = { eval: "safe property", Function: "safe property" };
          return obj.eval + obj.Function;
        `);
        
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });
    });

    describe('caching integration', () => {
      it('should use cached AST results', () => {
        const script = 'return "safe script";';
        
        analyzer.checkSecurity(script);
        expect(astParser.getCacheSize()).toBe(1);
        
        analyzer.checkSecurity(script);
        expect(astParser.getCacheSize()).toBe(1); // Still only one cache entry
      });

      it('should handle different scripts separately', () => {
        analyzer.checkSecurity('return "script1";');
        analyzer.checkSecurity('return "script2";');
        
        expect(astParser.getCacheSize()).toBe(2);
      });
    });
  });
});
