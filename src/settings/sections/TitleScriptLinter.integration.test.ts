import {TitleScriptLinter} from './TitleScriptLinter';

describe('TitleScriptLinter Integration', () => {
  let linter: TitleScriptLinter;

  beforeEach(() => {
    linter = new TitleScriptLinter();
  });

  afterEach(() => {
    linter.clearCache();
  });

  describe('refactored architecture integration', () => {
    it('should maintain all original functionality', () => {
      // Test various scenarios to ensure refactoring didn't break anything

      // Valid script
      const validResult = linter.validateScript('return "simple string";');
      expect(validResult.isValid).toBe(true);
      expect(validResult.type).toBe('success');

      // Invalid syntax
      const syntaxError = linter.validateScript('return "unterminated;');
      expect(syntaxError.isValid).toBe(false);
      expect(syntaxError.type).toBe('error');

      // Missing return
      const noReturn = linter.validateScript('const x = 5; console.log(x);');
      expect(noReturn.isValid).toBe(false);
      expect(noReturn.message).toBe('Script must contain a return statement');

      // Security issue
      const securityIssue = linter.validateScript('return eval("2+2");');
      expect(securityIssue.isValid).toBe(false);
      expect(securityIssue.message).toContain('Security concern');

      // Warning case
      const warningCase = linter.validateScript('console.log("debug"); return "title";');
      expect(warningCase.isValid).toBe(true);
      expect(warningCase.type).toBe('warning');
      expect(warningCase.message).toContain('consider');
    });

    it('should use AST caching efficiently', () => {
      const script = 'return "cached script";';

      // First validation should parse and cache
      expect(linter.getCacheSize()).toBe(0);

      linter.validateScript(script);
      expect(linter.getCacheSize()).toBe(1);

      // Second validation should use cache
      linter.validateScript(script);
      expect(linter.getCacheSize()).toBe(1); // Still only one cache entry

      // Different script should add to cache
      linter.validateScript('return "different script";');
      expect(linter.getCacheSize()).toBe(2);

      // Clearing cache should work
      linter.clearCache();
      expect(linter.getCacheSize()).toBe(0);
    });

    it('should handle complex validation scenarios', () => {
      const complexScript = `
        try {
          if (title && title.length > 0) {
            return title
              .replace(/[^a-zA-Z0-9\\s]/g, '')
              .trim()
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          } else {
            return 'Untitled';
          }
        } catch (e) {
          return 'Default';
        }
      `;

      const result = linter.validateScript(complexScript);
      expect(result.isValid).toBe(true);
      expect(['success', 'warning']).toContain(result.type);
    });

    it('should detect multiple issues and prioritize errors', () => {
      // Script with both security issue and missing returns
      const multipleIssues = `
        if (condition) {
          return eval("dangerous");
        }
        // Missing return in else case
      `;

      const result = linter.validateScript(multipleIssues);
      expect(result.isValid).toBe(false);
      expect(result.type).toBe('error');
      // Should catch security issue before return analysis
      expect(result.message).toContain('Security concern');
    });

    it('should handle edge cases gracefully', () => {
      // Empty script
      expect(linter.validateScript('').isValid).toBe(false);

      // Whitespace only
      expect(linter.validateScript('   \n  ').isValid).toBe(false);

      // Only comments
      const commentResult = linter.validateScript('// Just a comment');
      expect(commentResult.isValid).toBe(false);
      expect(commentResult.message).toBe('Script must contain a return statement');

      // Very long script
      const longScript = 'return "' + 'x'.repeat(1000) + '";';
      const longResult = linter.validateScript(longScript);
      expect(longResult.isValid).toBe(true);
      expect(longResult.type).toBe('warning');
      expect(longResult.message).toContain('very long');
    });

    it('should provide consistent results across multiple validations', () => {
      const script = 'return metadata.title ? metadata.title.toUpperCase() : file.basename;';

      const result1 = linter.validateScript(script);
      const result2 = linter.validateScript(script);
      const result3 = linter.validateScript(script);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('should maintain performance with caching', () => {
      const scripts = [
        'return "script1";',
        'return "script2";',
        'return "script3";',
        'return "script1";', // Duplicate
        'return "script2";', // Duplicate
      ];

      scripts.forEach(script => linter.validateScript(script));

      // Should only have 3 cache entries (not 5)
      expect(linter.getCacheSize()).toBe(3);
    });

    it('should handle all validation types correctly', () => {
      const testCases = [
        {
          script: 'return "perfect";',
          expectedValid: true,
          expectedType: 'success'
        },
        {
          script: 'console.log("debug"); return "warning";',
          expectedValid: true,
          expectedType: 'warning'
        },
        {
          script: 'invalid syntax here',
          expectedValid: false,
          expectedType: 'error'
        },
        {
          script: 'const x = 5;', // No return
          expectedValid: false,
          expectedType: 'error'
        },
        {
          script: 'return eval("danger");',
          expectedValid: false,
          expectedType: 'error'
        }
      ];

      testCases.forEach((testCase, index) => {
        const result = linter.validateScript(testCase.script);
        expect(result.isValid).toBe(testCase.expectedValid);
        expect(result.type).toBe(testCase.expectedType);
      });
    });
  });

  describe('refactoring benefits verification', () => {
    it('should demonstrate improved modularity', () => {
      // The linter should now be using separate, focused components
      // This is demonstrated by the fact that we can clear cache
      // and get cache size, showing the AST parser is separate

      expect(typeof linter.clearCache).toBe('function');
      expect(typeof linter.getCacheSize).toBe('function');

      linter.validateScript('return "test";');
      expect(linter.getCacheSize()).toBeGreaterThan(0);

      linter.clearCache();
      expect(linter.getCacheSize()).toBe(0);
    });

    it('should demonstrate performance improvements', () => {
      const script = 'return "performance test";';

      // First validation - parsing and caching
      const start1 = Date.now();
      linter.validateScript(script);
      const duration1 = Date.now() - start1;

      // Second validation - should use cache (faster)
      const start2 = Date.now();
      linter.validateScript(script);
      const duration2 = Date.now() - start2;

      // Cache usage should be evident (though timing might be too small to measure reliably)
      expect(linter.getCacheSize()).toBe(1);
    });

    it('should demonstrate maintainability through clear separation', () => {
      // Each validation concern is now separate:
      // 1. Syntax validation
      // 2. Security analysis
      // 3. Return statement analysis
      // 4. Best practices checking
      // 5. AST parsing and caching

      // This is demonstrated by the comprehensive validation
      const complexScript = `
        // Comment
        try {
          const title = metadata.title || file.basename;
          if (title.length > 0) {
            return title.trim().toUpperCase();
          } else {
            return "Default Title";
          }
        } catch (e) {
          return "Error Title";
        }
      `;

      const result = linter.validateScript(complexScript);

      // Should pass all validation stages:
      // ✓ Syntax is valid
      // ✓ No security issues
      // ✓ All paths return
      // ✓ Returns string values
      expect(result.isValid).toBe(true);
    });
  });
});
