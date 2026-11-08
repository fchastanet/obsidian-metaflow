/**
 * ValidationResult interface for script validation feedback
 */
export interface ValidationResult {
  isValid: boolean;
  message: string;
  type: 'error' | 'warning' | 'success';
}
