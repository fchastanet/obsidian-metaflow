import {ScriptASTParser} from './ScriptASTParser';
import {ScriptSyntaxValidator} from './ScriptSyntaxValidator';
import {ScriptSecurityAnalyzer} from './ScriptSecurityAnalyzer';
import {ScriptReturnAnalyzer} from './ScriptReturnAnalyzer';
import {ScriptBestPracticesChecker} from './ScriptBestPracticesChecker';

describe('Script Validation Components', () => {
  let astParser: ScriptASTParser;
  let syntaxValidator: ScriptSyntaxValidator;
  let securityAnalyzer: ScriptSecurityAnalyzer;
  let returnAnalyzer: ScriptReturnAnalyzer;
  let bestPracticesChecker: ScriptBestPracticesChecker;

  // Mock console.error to avoid cluttering test output
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    astParser = new ScriptASTParser();
    syntaxValidator = new ScriptSyntaxValidator(astParser);
    securityAnalyzer = new ScriptSecurityAnalyzer(astParser);
    returnAnalyzer = new ScriptReturnAnalyzer(astParser);
    bestPracticesChecker = new ScriptBestPracticesChecker(astParser);
  });

  describe('ScriptASTParser', () => {
    it('should parse valid script', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      const result = astParser.parseScript('return "hello";');
      expect(result).not.toBeNull();
      expect(result?.isWrapped).toBe(true);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });

    it('should cache parsed results', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      const script = 'return "hello";';
      const result1 = astParser.parseScript(script);
      const result2 = astParser.parseScript(script);
      expect(result1).toBe(result2); // Same object reference due to caching
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });

    it('should clear cache', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      astParser.parseScript('return "hello";');
      expect(astParser.getCacheSize()).toBe(1);
      astParser.clearCache();
      expect(astParser.getCacheSize()).toBe(0);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });
  });

  describe('ScriptSyntaxValidator', () => {
    it('should validate correct syntax', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      const result = syntaxValidator.validateSyntax('return "hello";');
      expect(result.isValid).toBe(true);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });

    it('should reject invalid syntax', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      const result = syntaxValidator.validateSyntax('return "hello;'); // Missing quote
      expect(result.isValid).toBe(false);
      expect(result.type).toBe('error');
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).toHaveBeenCalledWith("Error parsing script:", expect.any(SyntaxError));
      spyWarn.mockRestore();
      spyError.mockRestore();
    });
  });

  describe('ScriptSecurityAnalyzer', () => {
    it('should accept safe script', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      const result = securityAnalyzer.checkSecurity('return "hello";');
      expect(result.isValid).toBe(true);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });

    it('should reject eval usage', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      const result = securityAnalyzer.checkSecurity('return eval("2+2");');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('eval() is potentially dangerous');
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });
  });

  describe('ScriptReturnAnalyzer', () => {
    it('should detect return statement', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      const hasReturn = returnAnalyzer.hasReturnStatement('return "hello";');
      expect(hasReturn).toBe(true);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });

    it('should reject script without return', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      const hasReturn = returnAnalyzer.hasReturnStatement('console.log("hello");');
      expect(hasReturn).toBe(false);
      expect(spyWarn).not.toHaveBeenCalled();
      expect(spyError).not.toHaveBeenCalled();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });

    it('should validate execution paths', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      const result = returnAnalyzer.validateAllBranchesReturn('if (true) { return "a"; } else { return "b"; }');
      expect(result.isValid).toBe(true);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:12)");
      expect(spyError).not.toHaveBeenCalled();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });
  });

  describe('ScriptBestPracticesChecker', () => {
    it('should warn about console statements', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      const warnings = bestPracticesChecker.checkBestPractices('console.log("test"); return "hello";');
      expect(warnings).toContain('Remove console statements before deployment');
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:21)");
      expect(spyError).not.toHaveBeenCalled();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });

    it('should accept good practices', () => {
      const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
      const spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
      const warnings = bestPracticesChecker.checkBestPractices('return "hello";');
      expect(warnings.length).toBe(0);
      expect(spyWarn).toHaveBeenCalledWith("error parsing script : SyntaxError: 'return' outside of function (1:0)");
      expect(spyError).not.toHaveBeenCalled();
      spyWarn.mockRestore();
      spyError.mockRestore();
    });
  });
});
