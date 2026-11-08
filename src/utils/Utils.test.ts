import {Utils} from './Utils';
import {createHash} from 'crypto';

// Mock the crypto module
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn()
  }))
}));

describe('Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('timeout', () => {
    it('should resolve after specified milliseconds', async () => {
      const timeoutPromise = Utils.timeout(1000);

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      await expect(timeoutPromise).resolves.toBeUndefined();
    });

    it('should not resolve before specified time', async () => {
      const timeoutPromise = Utils.timeout(1000);
      let resolved = false;

      timeoutPromise.then(() => {
        resolved = true;
      });

      // Advance time by less than timeout
      jest.advanceTimersByTime(500);

      // Allow promise to be processed
      await Promise.resolve();

      expect(resolved).toBe(false);

      // Complete the timeout
      jest.advanceTimersByTime(500);
      await timeoutPromise;
      expect(resolved).toBe(true);
    });

    it('should handle zero timeout', async () => {
      const timeoutPromise = Utils.timeout(0);

      jest.advanceTimersByTime(0);

      await expect(timeoutPromise).resolves.toBeUndefined();
    });
  });

  describe('sleep', () => {
    it('should execute function after timeout', async () => {
      const mockFn = jest.fn();
      const sleepPromise = Utils.sleep(1000, mockFn);

      // Function should not be called immediately
      expect(mockFn).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      await sleepPromise;

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should return the result of the function', async () => {
      const mockFn = jest.fn().mockReturnValue('test result');
      const sleepPromise = Utils.sleep(500, mockFn);

      jest.advanceTimersByTime(500);

      const result = await sleepPromise;

      expect(result).toBe('test result');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle function that throws an error', async () => {
      const mockFn = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const sleepPromise = Utils.sleep(100, mockFn);

      jest.advanceTimersByTime(100);

      await expect(sleepPromise).rejects.toThrow('Test error');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should work with zero timeout', async () => {
      const mockFn = jest.fn().mockReturnValue('immediate');
      const sleepPromise = Utils.sleep(0, mockFn);

      jest.advanceTimersByTime(0);

      const result = await sleepPromise;

      expect(result).toBe('immediate');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('sha256', () => {
    it('should compute SHA-256 hash of a string', () => {
      const mockDigest = jest.fn().mockReturnValue('mocked-hash');
      const mockUpdate = jest.fn().mockReturnValue({digest: mockDigest});
      const mockCreateHash = createHash as jest.MockedFunction<typeof createHash>;

      mockCreateHash.mockReturnValue({
        update: mockUpdate,
        digest: mockDigest
      } as any);

      const input = 'test string';
      const result = Utils.sha256(input);

      expect(createHash).toHaveBeenCalledWith('sha256');
      expect(mockUpdate).toHaveBeenCalledWith(input, 'utf8');
      expect(mockDigest).toHaveBeenCalledWith('hex');
      expect(result).toBe('mocked-hash');
    });

    it('should handle empty string', () => {
      const mockDigest = jest.fn().mockReturnValue('empty-hash');
      const mockUpdate = jest.fn().mockReturnValue({digest: mockDigest});
      const mockCreateHash = createHash as jest.MockedFunction<typeof createHash>;

      mockCreateHash.mockReturnValue({
        update: mockUpdate,
        digest: mockDigest
      } as any);

      const result = Utils.sha256('');

      expect(createHash).toHaveBeenCalledWith('sha256');
      expect(mockUpdate).toHaveBeenCalledWith('', 'utf8');
      expect(mockDigest).toHaveBeenCalledWith('hex');
      expect(result).toBe('empty-hash');
    });

    it('should handle special characters', () => {
      const mockDigest = jest.fn().mockReturnValue('special-hash');
      const mockUpdate = jest.fn().mockReturnValue({digest: mockDigest});
      const mockCreateHash = createHash as jest.MockedFunction<typeof createHash>;

      mockCreateHash.mockReturnValue({
        update: mockUpdate,
        digest: mockDigest
      } as any);

      const input = 'Hello 世界! 🌍 \n\t"quotes"';
      const result = Utils.sha256(input);

      expect(createHash).toHaveBeenCalledWith('sha256');
      expect(mockUpdate).toHaveBeenCalledWith(input, 'utf8');
      expect(mockDigest).toHaveBeenCalledWith('hex');
      expect(result).toBe('special-hash');
    });

    it('should handle very long strings', () => {
      const mockDigest = jest.fn().mockReturnValue('long-hash');
      const mockUpdate = jest.fn().mockReturnValue({digest: mockDigest});
      const mockCreateHash = createHash as jest.MockedFunction<typeof createHash>;

      mockCreateHash.mockReturnValue({
        update: mockUpdate,
        digest: mockDigest
      } as any);

      const longString = 'a'.repeat(10000);
      const result = Utils.sha256(longString);

      expect(createHash).toHaveBeenCalledWith('sha256');
      expect(mockUpdate).toHaveBeenCalledWith(longString, 'utf8');
      expect(mockDigest).toHaveBeenCalledWith('hex');
      expect(result).toBe('long-hash');
    });
  });

  describe('stackTrace', () => {
    it('should return an object with stack property', () => {
      const result = Utils.stackTrace();

      expect(result).toHaveProperty('stack');
      expect(typeof result.stack).toBe('string');
    });

    it('should contain stack trace information', () => {
      const result = Utils.stackTrace();

      expect(result.stack).toContain('stackTrace');
      expect(result.stack).toContain('Utils.test.ts');
    });

    it('should return different stack traces when called from different locations', () => {
      const getStackFromFunction = () => {
        return Utils.stackTrace();
      };

      const directStack = Utils.stackTrace();
      const functionStack = getStackFromFunction();

      expect(directStack.stack).not.toBe(functionStack.stack);
      expect(functionStack.stack).toContain('getStackFromFunction');
    });

    it('should handle multiple calls', () => {
      const stack1 = Utils.stackTrace();
      const stack2 = Utils.stackTrace();

      // Both should have stack property
      expect(stack1).toHaveProperty('stack');
      expect(stack2).toHaveProperty('stack');

      // Stack traces should be similar but potentially different due to line numbers
      expect(typeof stack1.stack).toBe('string');
      expect(typeof stack2.stack).toBe('string');
    });
  });
});
