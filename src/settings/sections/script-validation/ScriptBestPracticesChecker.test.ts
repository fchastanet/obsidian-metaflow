import { ScriptBestPracticesChecker } from './ScriptBestPracticesChecker';
import { ScriptASTParser } from './ScriptASTParser';

describe('ScriptBestPracticesChecker', () => {
  let checker: ScriptBestPracticesChecker;
  let astParser: ScriptASTParser;

  beforeEach(() => {
    astParser = new ScriptASTParser();
    checker = new ScriptBestPracticesChecker(astParser);
  });

  afterEach(() => {
    astParser.clearCache();
  });

  describe('checkBestPractices', () => {
    describe('no warnings', () => {
      it('should return no warnings for simple clean script', () => {
        const warnings = checker.checkBestPractices('return "hello world";');
        
        expect(warnings).toEqual([]);
      });

      it('should return no warnings for moderately complex script', () => {
        const script = `
          const title = metadata.title || file.basename;
          return title.replace(/[-_]/g, ' ').trim();
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toEqual([]);
      });

      it('should return no warnings for script with string operations', () => {
        const script = `
          const cleaned = file.basename
            .replace(/\\.[^/.]+$/, "")
            .replace(/[-_]/g, " ")
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
          return cleaned;
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toEqual([]);
      });

      it('should return no warnings for conditional logic returning strings', () => {
        const script = `
          if (metadata.title && metadata.title.length > 0) {
            return metadata.title.toUpperCase();
          } else {
            return file.basename.toLowerCase();
          }
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toEqual([]);
      });

      it('should return no warnings for try-catch with string returns', () => {
        const script = `
          try {
            const data = JSON.parse(metadata.custom);
            return data.title.toString();
          } catch (e) {
            return file.basename;
          }
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toEqual([]);
      });
    });

    describe('script length warnings', () => {
      it('should warn about very long scripts', () => {
        const longScript = 'return "' + 'x'.repeat(1000) + '";';
        const warnings = checker.checkBestPractices(longScript);
        
        expect(warnings).toContain('Script is very long, consider breaking it down');
      });

      it('should not warn about reasonably sized scripts', () => {
        const normalScript = 'return "' + 'x'.repeat(500) + '";';
        const warnings = checker.checkBestPractices(normalScript);
        
        expect(warnings).not.toContain('Script is very long, consider breaking it down');
      });

      it('should handle scripts exactly at the threshold', () => {
        const thresholdScript = 'return "' + 'x'.repeat(990) + '";'; // Exactly 1000 chars
        const warnings = checker.checkBestPractices(thresholdScript);
        
        expect(warnings).not.toContain('Script is very long, consider breaking it down');
      });

      it('should warn about scripts just over the threshold', () => {
        const overThresholdScript = 'return "' + 'x'.repeat(992) + '";'; // Just over 1000 chars
        const warnings = checker.checkBestPractices(overThresholdScript);
        
        expect(warnings).toContain('Script is very long, consider breaking it down');
      });
    });

    describe('console statement warnings - AST detection', () => {
      it('should warn about console.log statements', () => {
        const script = `
          console.log("Debug message");
          return "title";
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Remove console statements before deployment');
      });

      it('should warn about console.error statements', () => {
        const script = `
          try {
            return metadata.title;
          } catch (e) {
            console.error("Error:", e);
            return file.basename;
          }
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Remove console statements before deployment');
      });

      it('should warn about console.warn statements', () => {
        const script = `
          if (!metadata.title) {
            console.warn("No title found");
          }
          return file.basename;
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Remove console statements before deployment');
      });

      it('should warn about console.debug statements', () => {
        const script = `
          console.debug("Processing file:", file.basename);
          return file.basename;
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Remove console statements before deployment');
      });

      it('should warn about console.info statements', () => {
        const script = `
          console.info("File processed");
          return "processed";
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Remove console statements before deployment');
      });

      it('should detect console statements in nested functions', () => {
        const script = `
          function debugLog(msg) {
            console.log("Debug:", msg);
          }
          debugLog("test");
          return "title";
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Remove console statements before deployment');
      });

      it('should detect console statements in arrow functions', () => {
        const script = `
          const logTitle = (title) => {
            console.log("Title:", title);
            return title;
          };
          return logTitle(file.basename);
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Remove console statements before deployment');
      });

      it('should detect console statements in conditional blocks', () => {
        const script = `
          if (debug) {
            console.log("Debug mode enabled");
          }
          return file.basename;
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Remove console statements before deployment');
      });

      it('should not warn about variables named console', () => {
        const script = `
          const console = "not the console object";
          return console;
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Remove console statements before deployment');
      });

      it('should not warn about console in string literals', () => {
        const script = `
          return "Check the console for errors";
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Remove console statements before deployment');
      });

      it('should not warn about console in comments', () => {
        const script = `
          // Use console.log for debugging
          /* console.error can help with errors */
          return "title";
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Remove console statements before deployment');
      });
    });

    describe('string return warnings - AST detection', () => {
      it('should warn when script doesn\'t return strings', () => {
        const script = `
          return 42; // Number, not string
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Script should return a string for the title');
      });

      it('should warn when script returns boolean', () => {
        const script = `
          return true;
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Script should return a string for the title');
      });

      it('should warn when script returns object', () => {
        const script = `
          return { title: "test" };
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Script should return a string for the title');
      });

      it('should not warn when script returns string literal', () => {
        const script = `
          return "string literal";
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });

      it('should not warn when script returns template literal', () => {
        const script = `
          return \`template \${literal}\`;
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });

      it('should not warn when script returns string concatenation', () => {
        const script = `
          return "hello" + " " + "world";
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });

      it('should not warn when script returns string method call', () => {
        const script = `
          return file.basename.toString();
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });

      it('should not warn when script returns conditional with strings', () => {
        const script = `
          return condition ? "yes" : "no";
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });

      it('should not warn when script returns identifier (assumed string)', () => {
        const script = `
          const title = metadata.title;
          return title;
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });

      it('should not warn when script returns member expression', () => {
        const script = `
          return metadata.title;
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });
    });

    describe('regex fallback when AST parsing fails', () => {
      beforeEach(() => {
        jest.spyOn(astParser, 'parseScript').mockReturnValue(null);
      });

      it('should detect console statements with regex fallback', () => {
        const script = `console.log("test"); return "title";`;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Remove console statements before deployment');
      });

      it('should detect non-string returns with regex fallback', () => {
        const script = `return 42;`;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Script should return a string for the title');
      });

      it('should not warn about console in strings with regex fallback', () => {
        const script = `return "console.log is useful";`;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Remove console statements before deployment');
      });

      it('should detect string returns with regex fallback', () => {
        const script = `return "hello world";`;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });

      it('should detect string operations with regex fallback', () => {
        const script = `return title + " suffix";`;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });

      it('should detect template literals with regex fallback', () => {
        const script = `return \`prefix \${title}\`;`;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });

      it('should detect string method calls with regex fallback', () => {
        const script = `return title.toString();`;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });

      it('should detect conditional string returns with regex fallback', () => {
        const script = `return condition ? "yes" : "no";`;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).not.toContain('Script should return a string for the title');
      });
    });

    describe('multiple warnings', () => {
      it('should return multiple warnings when multiple issues exist', () => {
        const longScriptWithConsole = `
          console.log("Debug message");
          return 42;
        ` + 'x'.repeat(1000);
        
        const warnings = checker.checkBestPractices(longScriptWithConsole);
        
        expect(warnings).toContain('Script is very long, consider breaking it down');
        expect(warnings).toContain('Remove console statements before deployment');
        expect(warnings).toContain('Script should return a string for the title');
        expect(warnings.length).toBe(3);
      });

      it('should return warnings in consistent order', () => {
        const problematicScript = `
          console.log("test");
          return 123;
        ` + 'x'.repeat(1000);
        
        const warnings1 = checker.checkBestPractices(problematicScript);
        const warnings2 = checker.checkBestPractices(problematicScript);
        
        expect(warnings1).toEqual(warnings2);
      });
    });

    describe('edge cases', () => {
      it('should handle empty scripts', () => {
        const warnings = checker.checkBestPractices('');
        
        // Empty scripts should warn about not returning strings
        expect(warnings).toContain('Script should return a string for the title');
      });

      it('should handle scripts with only comments', () => {
        const script = `
          // Just a comment
          /* Another comment */
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toContain('Script should return a string for the title');
      });

      it('should handle scripts with only whitespace', () => {
        const warnings = checker.checkBestPractices('   \n  \t  ');
        
        expect(warnings).toContain('Script should return a string for the title');
      });

      it('should handle complex nested structures', () => {
        const script = `
          function processTitle() {
            if (metadata.title) {
              return metadata.title.replace(/[^a-zA-Z0-9\\s]/g, '').trim();
            } else {
              return file.basename
                .replace(/\\.[^/.]+$/, "")
                .replace(/[-_]/g, " ")
                .split(" ")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
            }
          }
          return processTitle();
        `;
        const warnings = checker.checkBestPractices(script);
        
        expect(warnings).toEqual([]);
      });
    });

    describe('caching integration', () => {
      it('should use cached AST results', () => {
        const script = 'return "test";';
        
        checker.checkBestPractices(script);
        expect(astParser.getCacheSize()).toBe(1);
        
        checker.checkBestPractices(script);
        expect(astParser.getCacheSize()).toBe(1); // Still only one cache entry
      });

      it('should handle different scripts separately', () => {
        checker.checkBestPractices('return "script1";');
        checker.checkBestPractices('return "script2";');
        
        expect(astParser.getCacheSize()).toBe(2);
      });
    });
  });
});
