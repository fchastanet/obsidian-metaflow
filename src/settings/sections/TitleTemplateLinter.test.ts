import {TitleTemplateLinter, ValidationResult} from './TitleTemplateLinter';

describe('TitleTemplateLinter', () => {
  let linter: TitleTemplateLinter;

  beforeEach(() => {
    linter = new TitleTemplateLinter();
  });

  describe('validateTemplate', () => {
    describe('empty templates', () => {
      it('should reject empty template', () => {
        const result = linter.validateTemplate('');
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Template cannot be empty');
        expect(result.type).toBe('error');
      });

      it('should reject whitespace-only template', () => {
        const result = linter.validateTemplate('   ');
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Template cannot be empty');
        expect(result.type).toBe('error');
      });
    });

    describe('brace balance validation', () => {
      it('should accept balanced braces', () => {
        const result = linter.validateTemplate('{{title}} - {{author}}');
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should reject unbalanced opening braces', () => {
        const result = linter.validateTemplate('{{title} - {{author}}');
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Unbalanced braces');
        expect(result.type).toBe('error');
      });

      it('should reject unbalanced closing braces', () => {
        const result = linter.validateTemplate('{{title}} - {author}}');
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Unbalanced braces');
        expect(result.type).toBe('error');
      });

      it('should reject mismatched braces', () => {
        const result = linter.validateTemplate('{{title] - {{author}}');
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Mismatched braces');
        expect(result.type).toBe('error');
      });

      it('should handle mixed bracket types correctly', () => {
        const result = linter.validateTemplate('{{title}} - [{{date}}]');
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });
    });

    describe('variable validation', () => {
      it('should accept valid variable names', () => {
        const result = linter.validateTemplate('{{title}} {{author}} {{metadata.date}}');
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });

      it('should reject empty variables', () => {
        const result = linter.validateTemplate('{{title}} {{}} {{author}}');
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Found empty template variables {{}}');
        expect(result.type).toBe('error');
      });

      it('should reject invalid variable names', () => {
        const result = linter.validateTemplate('{{title}} {{123invalid}} {{author}}');
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Invalid variable names: 123invalid');
        expect(result.type).toBe('error');
      });

      it('should accept variables with dots for nested properties', () => {
        const result = linter.validateTemplate('{{metadata.title}} {{file.basename}}');
        expect(result.isValid).toBe(true);
        expect(result.type).toBe('success');
      });
    });

    describe('warning conditions', () => {
      it('should warn about very long templates', () => {
        const longTemplate = '{{title}} - ' + 'a'.repeat(200);
        const result = linter.validateTemplate(longTemplate);
        expect(result.isValid).toBe(true);
        expect(result.message).toContain('Template is very long');
        expect(result.type).toBe('warning');
      });

      it('should warn about problematic file system characters', () => {
        const result = linter.validateTemplate('{{title}} / {{author}} | invalid');
        expect(result.isValid).toBe(true);
        expect(result.message).toContain('file system issues');
        expect(result.type).toBe('warning');
      });

      it('should warn about single braces', () => {
        const result = linter.validateTemplate('{title} - {{author}}');
        expect(result.isValid).toBe(true);
        expect(result.message).toContain('Single braces detected');
        expect(result.type).toBe('warning');
      });
    });

    describe('valid templates', () => {
      it('should accept simple template', () => {
        const result = linter.validateTemplate('{{title}}');
        expect(result.isValid).toBe(true);
        expect(result.message).toBe('Template syntax is valid');
        expect(result.type).toBe('success');
      });

      it('should accept complex template', () => {
        const result = linter.validateTemplate('{{metadata.date}} - {{title}} by {{author}}');
        expect(result.isValid).toBe(true);
        expect(result.message).toBe('Template syntax is valid');
        expect(result.type).toBe('success');
      });
    });
  });
});
