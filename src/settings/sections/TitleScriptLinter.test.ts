import { TitleScriptLinter, ValidationResult } from './TitleScriptLinter';

describe('TitleScriptLinter', () => {
  let linter: TitleScriptLinter;

  beforeEach(() => {
    linter = new TitleScriptLinter();
  });

  describe('validateScript', () => {
    describe('empty scripts', () => {
      it('should reject empty script', () => {
        const result = linter.validateScript('');
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Script cannot be empty');
        expect(result.type).toBe('error');
      });

      it('should reject whitespace-only script', () => {
        const result = linter.validateScript('   \n  ');
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Script cannot be empty');
        expect(result.type).toBe('error');
      });
    });

    describe('return statement validation', () => {
      it('should accept script with return statement', () => {
        const result = linter.validateScript('return "Hello World";');
        expect(result.isValid).toBe(true);
      });

      it('should reject script without return statement', () => {
        const result = linter.validateScript('const title = "Hello"; console.log(title);');
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Script must contain a return statement');
        expect(result.type).toBe('error');
      });

      it('should accept script with return in function', () => {
        const result = linter.validateScript(`
          function getTitle() {
            return "Hello";
          }
          return getTitle();
        `);
        expect(result.isValid).toBe(true);
      });
    });

    describe('syntax validation', () => {
      it('should accept valid JavaScript', () => {
        const result = linter.validateScript('const title = file.basename; return title;');
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid JavaScript syntax', () => {
        const result = linter.validateScript('const title = ; return title;');
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Syntax error');
        expect(result.type).toBe('error');
      });

      it('should reject unclosed braces', () => {
        const result = linter.validateScript('if (true) { return "test";');
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Syntax error');
        expect(result.type).toBe('error');
      });
    });

    describe('security validation', () => {
      it('should reject scripts with eval()', () => {
        const result = linter.validateScript('return eval("file.basename");');
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('eval() is potentially dangerous');
        expect(result.type).toBe('error');
      });

      it('should reject scripts with Function constructor', () => {
        const result = linter.validateScript('const fn = new Function("return 1"); return fn();');
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Dynamic function creation may be unsafe');
        expect(result.type).toBe('error');
      });

      it('should reject scripts with setTimeout', () => {
        const result = linter.validateScript('setTimeout(() => {}, 1000); return "test";');
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Timer functions may cause performance issues');
        expect(result.type).toBe('error');
      });

      it('should reject scripts with require()', () => {
        const result = linter.validateScript('const fs = require("fs"); return "test";');
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('require() may access system resources');
        expect(result.type).toBe('error');
      });
    });

    describe('execution path validation', () => {
      it('should reject if statement without else that has no return after', () => {
        const result = linter.validateScript(`
          if (test) {
            return "test";
          }
          // Missing return here
        `);
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Not all execution paths return a value');
        expect(result.type).toBe('error');
      });

      it('should reject if statement with else but one branch missing return', () => {
        const result = linter.validateScript(`
          if (test) {
            return "test";
          } else {
            console.log("no return here");
          }
        `);
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Not all execution paths return a value');
        expect(result.type).toBe('error');
      });

      it('should accept if statement with else where both branches return', () => {
        const result = linter.validateScript(`
          if (test) {
            return "test";
          } else {
            return "else";
          }
        `);
        expect(result.isValid).toBe(true);
      });

      it('should reject if one branch returns non-string', () => {
        const result = linter.validateScript(`
          if (test) {
            return "test";
          } else {
            return 42;
          }
        `);
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Some return statements may not return strings');
        expect(result.type).toBe('error');
      });

      it('should accept single return statement', () => {
        const result = linter.validateScript('return "test";');
        expect(result.isValid).toBe(true);
      });

      it('should reject switch without default case', () => {
        const result = linter.validateScript(`
          switch (value) {
            case 1:
              return "one";
            case 2:
              return "two";
          }
        `);
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Not all execution paths return a value');
        expect(result.type).toBe('error');
      });

      it('should accept switch with default case where all return', () => {
        const result = linter.validateScript(`
          switch (value) {
            case 1:
              return "one";
            case 2:
              return "two";
            default:
              return "default";
          }
        `);
        expect(result.isValid).toBe(true);
      });

      it('should reject switch with default but missing return in case', () => {
        const result = linter.validateScript(`
          switch (value) {
            case 1:
              console.log("case 1");
              break;
            case 2:
              return "two";
            default:
              return "default";
          }
        `);
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Not all execution paths return a value');
        expect(result.type).toBe('error');
      });

      it('should accept nested if statements with all branches returning', () => {
        const result = linter.validateScript(`
          if (condition1) {
            if (condition2) {
              return "nested true";
            } else {
              return "nested false";
            }
          } else {
            return "outer false";
          }
        `);
        expect(result.isValid).toBe(true);
      });

      it('should reject try-catch where catch does not return', () => {
        const result = linter.validateScript(`
          try {
            return "success";
          } catch (error) {
            console.log("error");
          }
        `);
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Not all execution paths return a value');
        expect(result.type).toBe('error');
      });

      it('should accept try-catch where both return', () => {
        const result = linter.validateScript(`
          try {
            return "success";
          } catch (error) {
            return "error";
          }
        `);
        expect(result.isValid).toBe(true);
      });
    });

    describe('warning conditions', () => {
      it('should warn about very long scripts', () => {
        const longScript = 'const title = "' + 'a'.repeat(1000) + '"; return title;';
        const result = linter.validateScript(longScript);
        expect(result.isValid).toBe(true);
        expect(result.message).toContain('Script is very long');
        expect(result.type).toBe('warning');
      });

      it('should warn about console statements', () => {
        const result = linter.validateScript('console.log("debug"); return file.basename;');
        expect(result.isValid).toBe(true);
        expect(result.message).toContain('Remove console statements');
        expect(result.type).toBe('warning');
      });

      it('should warn if script might not return string', () => {
        const result = linter.validateScript('return 42;');
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Some return statements may not return strings');
        expect(result.type).toBe('error');
      });
    });

    describe('valid scripts', () => {
      it('should accept simple string return', () => {
        const result = linter.validateScript('return "Hello World";');
        expect(result.isValid).toBe(true);
        expect(result.message).toBe('Script syntax is valid');
        expect(result.type).toBe('success');
      });

      it('should accept script with file operations', () => {
        const result = linter.validateScript(`
          const title = file.basename;
          const date = metadata.created || "Unknown";
          return title + " - " + date;
        `);
        expect(result.isValid).toBe(true);
        expect(result.message).toBe('Script syntax is valid');
        expect(result.type).toBe('success');
      });

      it('should accept script with conditional logic', () => {
        const result = linter.validateScript(`
          if (metadata.title) {
            return metadata.title;
          } else {
            return file.basename;
          }
        `);
        expect(result.isValid).toBe(true);
        // With AST analysis, we can better detect that this returns a string in both branches
        expect(result.message).toBe('Script syntax is valid');
        expect(result.type).toBe('success');
      });

      it('should recognize string concatenation as returning string', () => {
        const result = linter.validateScript('return file.basename + " - " + metadata.date;');
        expect(result.isValid).toBe(true);
        expect(result.message).toBe('Script syntax is valid');
        expect(result.type).toBe('success');
      });

      it('should recognize template literals as returning string', () => {
        const result = linter.validateScript('return `${file.basename} - ${metadata.date}`;');
        expect(result.isValid).toBe(true);
        expect(result.message).toBe('Script syntax is valid');
        expect(result.type).toBe('success');
      });

      it('should recognize string methods as returning string', () => {
        const result = linter.validateScript('return file.basename.replace(/\\.md$/, "");');
        expect(result.isValid).toBe(true);
        expect(result.message).toBe('Script syntax is valid');
        expect(result.type).toBe('success');
      });
    });
  });
});
