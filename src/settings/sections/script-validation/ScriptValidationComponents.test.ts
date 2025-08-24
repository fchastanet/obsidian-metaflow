import { ScriptASTParser } from './ScriptASTParser';
import { ScriptSyntaxValidator } from './ScriptSyntaxValidator';
import { ScriptSecurityAnalyzer } from './ScriptSecurityAnalyzer';
import { ScriptReturnAnalyzer } from './ScriptReturnAnalyzer';
import { ScriptBestPracticesChecker } from './ScriptBestPracticesChecker';

describe('Script Validation Components', () => {
  let astParser: ScriptASTParser;
  let syntaxValidator: ScriptSyntaxValidator;
  let securityAnalyzer: ScriptSecurityAnalyzer;
  let returnAnalyzer: ScriptReturnAnalyzer;
  let bestPracticesChecker: ScriptBestPracticesChecker;

  beforeEach(() => {
    astParser = new ScriptASTParser();
    syntaxValidator = new ScriptSyntaxValidator(astParser);
    securityAnalyzer = new ScriptSecurityAnalyzer(astParser);
    returnAnalyzer = new ScriptReturnAnalyzer(astParser);
    bestPracticesChecker = new ScriptBestPracticesChecker(astParser);
  });

  describe('ScriptASTParser', () => {
    it('should parse valid script', () => {
      const result = astParser.parseScript('return "hello";');
      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(true);
    });

    it('should cache parsed results', () => {
      const script = 'return "hello";';
      const result1 = astParser.parseScript(script);
      const result2 = astParser.parseScript(script);
      expect(result1).toBe(result2); // Same object reference due to caching
    });

    it('should clear cache', () => {
      astParser.parseScript('return "hello";');
      expect(astParser.getCacheSize()).toBe(1);
      astParser.clearCache();
      expect(astParser.getCacheSize()).toBe(0);
    });
  });

  describe('ScriptSyntaxValidator', () => {
    it('should validate correct syntax', () => {
      const result = syntaxValidator.validateSyntax('return "hello";');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid syntax', () => {
      const result = syntaxValidator.validateSyntax('return "hello;'); // Missing quote
      expect(result.isValid).toBe(false);
      expect(result.type).toBe('error');
    });
  });

  describe('ScriptSecurityAnalyzer', () => {
    it('should accept safe script', () => {
      const result = securityAnalyzer.checkSecurity('return "hello";');
      expect(result.isValid).toBe(true);
    });

    it('should reject eval usage', () => {
      const result = securityAnalyzer.checkSecurity('return eval("2+2");');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('eval() is potentially dangerous');
    });
  });

  describe('ScriptReturnAnalyzer', () => {
    it('should detect return statement', () => {
      const hasReturn = returnAnalyzer.hasReturnStatement('return "hello";');
      expect(hasReturn).toBe(true);
    });

    it('should reject script without return', () => {
      const hasReturn = returnAnalyzer.hasReturnStatement('console.log("hello");');
      expect(hasReturn).toBe(false);
    });

    it('should validate execution paths', () => {
      const result = returnAnalyzer.validateAllBranchesReturn('if (true) { return "a"; } else { return "b"; }');
      expect(result.isValid).toBe(true);
    });
  });

  describe('ScriptBestPracticesChecker', () => {
    it('should warn about console statements', () => {
      const warnings = bestPracticesChecker.checkBestPractices('console.log("test"); return "hello";');
      expect(warnings).toContain('Remove console statements before deployment');
    });

    it('should accept good practices', () => {
      const warnings = bestPracticesChecker.checkBestPractices('return "hello";');
      expect(warnings.length).toBe(0);
    });
  });
});
