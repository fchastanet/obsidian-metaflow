import { ValidationResult } from './ValidationResult';

describe('ValidationResult', () => {
  describe('interface structure', () => {
    it('should accept valid error result', () => {
      const result: ValidationResult = {
        isValid: false,
        message: 'Test error message',
        type: 'error'
      };

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Test error message');
      expect(result.type).toBe('error');
    });

    it('should accept valid warning result', () => {
      const result: ValidationResult = {
        isValid: true,
        message: 'Test warning message',
        type: 'warning'
      };

      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Test warning message');
      expect(result.type).toBe('warning');
    });

    it('should accept valid success result', () => {
      const result: ValidationResult = {
        isValid: true,
        message: 'Test success message',
        type: 'success'
      };

      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Test success message');
      expect(result.type).toBe('success');
    });

    it('should accept empty message', () => {
      const result: ValidationResult = {
        isValid: true,
        message: '',
        type: 'success'
      };

      expect(result.message).toBe('');
    });
  });

  describe('type constraints', () => {
    it('should only allow specific type values', () => {
      // These should compile without errors
      const errorResult: ValidationResult = { isValid: false, message: '', type: 'error' };
      const warningResult: ValidationResult = { isValid: true, message: '', type: 'warning' };
      const successResult: ValidationResult = { isValid: true, message: '', type: 'success' };

      expect(errorResult.type).toBe('error');
      expect(warningResult.type).toBe('warning');
      expect(successResult.type).toBe('success');

      // Note: TypeScript would prevent invalid type values at compile time
      // so we can't test invalid values like 'invalid' or 'info' here
    });
  });

  describe('typical usage patterns', () => {
    it('should represent syntax errors correctly', () => {
      const syntaxError: ValidationResult = {
        isValid: false,
        message: 'Syntax error: Unexpected token',
        type: 'error'
      };

      expect(syntaxError.isValid).toBe(false);
      expect(syntaxError.type).toBe('error');
      expect(syntaxError.message).toContain('Syntax error');
    });

    it('should represent security concerns correctly', () => {
      const securityError: ValidationResult = {
        isValid: false,
        message: 'Security concern: eval() is potentially dangerous',
        type: 'error'
      };

      expect(securityError.isValid).toBe(false);
      expect(securityError.type).toBe('error');
      expect(securityError.message).toContain('Security concern');
    });

    it('should represent best practice warnings correctly', () => {
      const warning: ValidationResult = {
        isValid: true,
        message: 'Script is valid but consider: Remove console statements before deployment',
        type: 'warning'
      };

      expect(warning.isValid).toBe(true);
      expect(warning.type).toBe('warning');
      expect(warning.message).toContain('consider');
    });

    it('should represent successful validation correctly', () => {
      const success: ValidationResult = {
        isValid: true,
        message: 'Script syntax is valid',
        type: 'success'
      };

      expect(success.isValid).toBe(true);
      expect(success.type).toBe('success');
      expect(success.message).toContain('valid');
    });

    it('should represent silent success correctly', () => {
      const silentSuccess: ValidationResult = {
        isValid: true,
        message: '',
        type: 'success'
      };

      expect(silentSuccess.isValid).toBe(true);
      expect(silentSuccess.type).toBe('success');
      expect(silentSuccess.message).toBe('');
    });
  });

  describe('logical consistency', () => {
    it('should have consistent error states', () => {
      const errorResults: ValidationResult[] = [
        { isValid: false, message: 'Error 1', type: 'error' },
        { isValid: false, message: 'Error 2', type: 'error' },
        { isValid: false, message: '', type: 'error' }
      ];

      errorResults.forEach(result => {
        expect(result.isValid).toBe(false);
        expect(result.type).toBe('error');
      });
    });

    it('should have consistent success states', () => {
      const successResults: ValidationResult[] = [
        { isValid: true, message: 'Success', type: 'success' },
        { isValid: true, message: '', type: 'success' },
        { isValid: true, message: 'All good', type: 'success' }
      ];

      successResults.forEach(result => {
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });
    });

    it('should have consistent warning states', () => {
      const warningResults: ValidationResult[] = [
        { isValid: true, message: 'Warning 1', type: 'warning' },
        { isValid: true, message: 'Warning 2', type: 'warning' },
        { isValid: true, message: 'Consider this', type: 'warning' }
      ];

      warningResults.forEach(result => {
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('warning');
      });
    });
  });

  describe('use in arrays and collections', () => {
    it('should work in arrays', () => {
      const results: ValidationResult[] = [
        { isValid: true, message: 'Success 1', type: 'success' },
        { isValid: false, message: 'Error 1', type: 'error' },
        { isValid: true, message: 'Warning 1', type: 'warning' }
      ];

      expect(results).toHaveLength(3);
      expect(results[0].type).toBe('success');
      expect(results[1].type).toBe('error');
      expect(results[2].type).toBe('warning');
    });

    it('should support filtering by type', () => {
      const results: ValidationResult[] = [
        { isValid: true, message: 'Success 1', type: 'success' },
        { isValid: false, message: 'Error 1', type: 'error' },
        { isValid: true, message: 'Warning 1', type: 'warning' },
        { isValid: false, message: 'Error 2', type: 'error' }
      ];

      const errors = results.filter(r => r.type === 'error');
      const warnings = results.filter(r => r.type === 'warning');
      const successes = results.filter(r => r.type === 'success');

      expect(errors).toHaveLength(2);
      expect(warnings).toHaveLength(1);
      expect(successes).toHaveLength(1);
    });

    it('should support filtering by validity', () => {
      const results: ValidationResult[] = [
        { isValid: true, message: 'Success 1', type: 'success' },
        { isValid: false, message: 'Error 1', type: 'error' },
        { isValid: true, message: 'Warning 1', type: 'warning' },
        { isValid: false, message: 'Error 2', type: 'error' }
      ];

      const valid = results.filter(r => r.isValid);
      const invalid = results.filter(r => !r.isValid);

      expect(valid).toHaveLength(2);
      expect(invalid).toHaveLength(2);
    });
  });

  describe('serialization and deserialization', () => {
    it('should serialize to JSON correctly', () => {
      const result: ValidationResult = {
        isValid: false,
        message: 'Test error',
        type: 'error'
      };

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(parsed.isValid).toBe(false);
      expect(parsed.message).toBe('Test error');
      expect(parsed.type).toBe('error');
    });

    it('should handle special characters in messages', () => {
      const result: ValidationResult = {
        isValid: false,
        message: 'Error with "quotes" and \\backslashes\\ and newlines\n',
        type: 'error'
      };

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(parsed.message).toBe(result.message);
    });

    it('should handle unicode characters in messages', () => {
      const result: ValidationResult = {
        isValid: true,
        message: 'Success with unicode: 😀 🌟 ✨',
        type: 'success'
      };

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(parsed.message).toBe(result.message);
    });
  });
});
