import {FileDebouncer} from './FileDebouncer';

// Mock timers using Jest's built-in timer mocking
jest.useFakeTimers();

describe('FileDebouncer', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should create instance with default debounce wait', () => {
      const debouncer = new FileDebouncer();
      expect(debouncer).toBeInstanceOf(FileDebouncer);
      expect(debouncer.getPendingCount()).toBe(0);
    });

    it('should create instance with custom debounce wait', () => {
      const customWait = 1000;
      const debouncer = new FileDebouncer(customWait);
      expect(debouncer).toBeInstanceOf(FileDebouncer);
    });
  });

  describe('createFileDebouncer', () => {
    let debouncer: FileDebouncer;
    let mockHandler: jest.Mock;
    let getFileKey: jest.Mock;

    beforeEach(() => {
      debouncer = new FileDebouncer(500);
      mockHandler = jest.fn();
      getFileKey = jest.fn();
    });

    it('should create a debounced function', () => {
      const debouncedFn = debouncer.createFileDebouncer(mockHandler, getFileKey);
      expect(typeof debouncedFn).toBe('function');
    });

    it('should call handler when file key is provided', () => {
      getFileKey.mockReturnValue('file1.md');
      const debouncedFn = debouncer.createFileDebouncer(mockHandler, getFileKey);

      debouncedFn('arg1', 'arg2');

      expect(getFileKey).toHaveBeenCalledWith('arg1', 'arg2');
      expect(debouncer.getPendingCount()).toBe(1);

      // Fast-forward time to trigger the debounced function
      jest.runAllTimers();
      expect(mockHandler).toHaveBeenCalledWith('arg1', 'arg2');
      expect(debouncer.getPendingCount()).toBe(0);
    });

    it('should not call handler when file key is null', () => {
      getFileKey.mockReturnValue(null);
      const debouncedFn = debouncer.createFileDebouncer(mockHandler, getFileKey);

      debouncedFn('arg1');

      expect(getFileKey).toHaveBeenCalledWith('arg1');
      expect(debouncer.getPendingCount()).toBe(0);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should not call handler when file key is undefined', () => {
      getFileKey.mockReturnValue(undefined);
      const debouncedFn = debouncer.createFileDebouncer(mockHandler, getFileKey);

      debouncedFn('arg1');

      expect(debouncer.getPendingCount()).toBe(0);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should clear existing timer for same file', () => {
      getFileKey.mockReturnValue('file1.md');
      const debouncedFn = debouncer.createFileDebouncer(mockHandler, getFileKey);

      // First call
      debouncedFn('arg1');
      expect(debouncer.getPendingCount()).toBe(1);

      // Second call with same file - should clear first timer
      debouncedFn('arg2');
      expect(debouncer.getPendingCount()).toBe(1);

      // Fast-forward time - only the second call should execute
      jest.runAllTimers();
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith('arg2');
    });

    it('should handle multiple files independently', () => {
      getFileKey.mockReturnValueOnce('file1.md').mockReturnValueOnce('file2.md');
      const debouncedFn = debouncer.createFileDebouncer(mockHandler, getFileKey);

      debouncedFn('file1-arg');
      debouncedFn('file2-arg');

      expect(debouncer.getPendingCount()).toBe(2);

      // Fast-forward time - both should execute
      jest.runAllTimers();
      expect(mockHandler).toHaveBeenCalledTimes(2);
      expect(mockHandler).toHaveBeenCalledWith('file1-arg');
      expect(mockHandler).toHaveBeenCalledWith('file2-arg');
    });

    it('should remove timer from map after execution', () => {
      getFileKey.mockReturnValue('file1.md');
      const debouncedFn = debouncer.createFileDebouncer(mockHandler, getFileKey);

      debouncedFn('arg1');
      expect(debouncer.getPendingCount()).toBe(1);

      // Fast-forward time to execute the debounced function
      jest.runAllTimers();
      expect(debouncer.getPendingCount()).toBe(0);
    });
  });

  describe('clearAll', () => {
    let debouncer: FileDebouncer;
    let mockHandler: jest.Mock;

    beforeEach(() => {
      debouncer = new FileDebouncer(500);
      mockHandler = jest.fn();
    });

    it('should clear all pending timers', () => {
      const debouncedFn1 = debouncer.createFileDebouncer(mockHandler, () => 'file1.md');
      const debouncedFn2 = debouncer.createFileDebouncer(mockHandler, () => 'file2.md');

      debouncedFn1('arg1');
      debouncedFn2('arg2');

      expect(debouncer.getPendingCount()).toBe(2);

      debouncer.cleanup();

      expect(debouncer.getPendingCount()).toBe(0);

      // Fast-forward time - nothing should execute
      jest.runAllTimers();
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle empty timer map', () => {
      expect(debouncer.getPendingCount()).toBe(0);

      expect(() => debouncer.cleanup()).not.toThrow();
      expect(debouncer.getPendingCount()).toBe(0);
    });
  });

  describe('clearForFile', () => {
    let debouncer: FileDebouncer;
    let mockHandler: jest.Mock;

    beforeEach(() => {
      debouncer = new FileDebouncer(500);
      mockHandler = jest.fn();
    });

    it('should clear timer for specific file', () => {
      const debouncedFn1 = debouncer.createFileDebouncer(mockHandler, () => 'file1.md');
      const debouncedFn2 = debouncer.createFileDebouncer(mockHandler, () => 'file2.md');

      debouncedFn1('arg1');
      debouncedFn2('arg2');

      expect(debouncer.getPendingCount()).toBe(2);

      debouncer.clearForFile('file1.md');

      expect(debouncer.getPendingCount()).toBe(1);

      // Fast-forward time - only file2 should execute
      jest.runAllTimers();
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith('arg2');
    });

    it('should handle non-existent file key', () => {
      expect(debouncer.getPendingCount()).toBe(0);

      expect(() => debouncer.clearForFile('nonexistent.md')).not.toThrow();
      expect(debouncer.getPendingCount()).toBe(0);
    });
  });

  describe('getPendingCount', () => {
    let debouncer: FileDebouncer;
    let mockHandler: jest.Mock;

    beforeEach(() => {
      debouncer = new FileDebouncer(500);
      mockHandler = jest.fn();
    });

    it('should return 0 when no timers are pending', () => {
      expect(debouncer.getPendingCount()).toBe(0);
    });

    it('should return correct count of pending timers', () => {
      const debouncedFn = debouncer.createFileDebouncer(mockHandler, (file: string) => file);

      debouncedFn('file1.md');
      expect(debouncer.getPendingCount()).toBe(1);

      debouncedFn('file2.md');
      expect(debouncer.getPendingCount()).toBe(2);

      // Same file should not increase count
      debouncedFn('file1.md');
      expect(debouncer.getPendingCount()).toBe(2);
    });

    it('should decrease count after clearing specific file', () => {
      const debouncedFn = debouncer.createFileDebouncer(mockHandler, (file: string) => file);

      debouncedFn('file1.md');
      debouncedFn('file2.md');
      expect(debouncer.getPendingCount()).toBe(2);

      debouncer.clearForFile('file1.md');
      expect(debouncer.getPendingCount()).toBe(1);
    });
  });

  describe('custom debounce wait time', () => {
    it('should use custom wait time', () => {
      const customWait = 1000;
      const debouncer = new FileDebouncer(customWait);
      const mockHandler = jest.fn();
      const getFileKey = jest.fn().mockReturnValue('file1.md');

      const debouncedFn = debouncer.createFileDebouncer(mockHandler, getFileKey);
      debouncedFn('arg1');

      // Advance time by less than the custom wait time
      jest.advanceTimersByTime(500);
      expect(mockHandler).not.toHaveBeenCalled();

      // Advance time to reach the custom wait time
      jest.advanceTimersByTime(500);
      expect(mockHandler).toHaveBeenCalledWith('arg1');
    });
  });
});
