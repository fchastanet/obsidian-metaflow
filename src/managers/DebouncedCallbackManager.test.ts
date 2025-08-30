import {DebouncedCallbackManager} from './DebouncedCallbackManager';
import {MetaFlowSettings} from '../settings/types';

// Mock timers
jest.useFakeTimers();

describe('DebouncedCallbackManager', () => {
  let manager: DebouncedCallbackManager<string>;
  let mockCallback: jest.Mock<Promise<void>, [string, string]>;
  let mockSettings: MetaFlowSettings;
  let mockSetTimeout: jest.SpyInstance;
  let mockClearTimeout: jest.SpyInstance;

  beforeEach(() => {
    // Mock console methods
    jest.spyOn(console, 'debug').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });

    // Mock window.setTimeout and window.clearTimeout to prevent actual timers
    mockSetTimeout = jest.spyOn(window, 'setTimeout').mockImplementation((callback, delay) => {
      return 123 as any; // Return a fake timer ID
    });
    mockClearTimeout = jest.spyOn(window, 'clearTimeout').mockImplementation(() => { });

    mockCallback = jest.fn().mockResolvedValue(undefined);
    mockSettings = {debugMode: true} as MetaFlowSettings;

    manager = new DebouncedCallbackManager(mockCallback, mockSettings);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.restoreAllMocks();
    mockSetTimeout.mockRestore();
    mockClearTimeout.mockRestore();
  });

  describe('schedule', () => {
    it('should schedule a callback with debouncing', async () => {
      manager.schedule('key1', 'data1');

      expect(manager.hasPending('key1')).toBe(true);
      expect(manager.getPending('key1')).toBe('data1');
      expect(mockCallback).not.toHaveBeenCalled();
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);

      // Manually trigger the timer callback
      const timerCallback = mockSetTimeout.mock.calls[0][0];
      await timerCallback();

      expect(mockCallback).toHaveBeenCalledWith('key1', 'data1');
      expect(manager.hasPending('key1')).toBe(false);
    });

    it('should use the last data when multiple calls are made for the same key', async () => {
      manager.schedule('key1', 'data1');
      manager.schedule('key1', 'data2');
      manager.schedule('key1', 'data3');

      expect(manager.getPending('key1')).toBe('data3');
      expect(mockClearTimeout).toHaveBeenCalledTimes(2); // Should clear previous timers

      // Manually trigger the timer callback
      const timerCallback = mockSetTimeout.mock.calls[mockSetTimeout.mock.calls.length - 1][0];
      await timerCallback();

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('key1', 'data3');
    });

    it('should handle multiple keys independently', async () => {
      manager.schedule('key1', 'data1');
      manager.schedule('key2', 'data2');

      expect(mockSetTimeout).toHaveBeenCalledTimes(2);

      // Manually trigger both timer callbacks
      const callback1 = mockSetTimeout.mock.calls[0][0];
      const callback2 = mockSetTimeout.mock.calls[1][0];
      await callback1();
      await callback2();

      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(mockCallback).toHaveBeenCalledWith('key1', 'data1');
      expect(mockCallback).toHaveBeenCalledWith('key2', 'data2');
    });

    it('should restart timer when scheduling for the same key multiple times', async () => {
      manager.schedule('key1', 'data1');

      expect(mockSetTimeout).toHaveBeenCalledTimes(1);
      expect(mockCallback).not.toHaveBeenCalled();

      // Schedule again - should restart the timer
      manager.schedule('key1', 'data2');

      expect(mockSetTimeout).toHaveBeenCalledTimes(2);
      expect(mockClearTimeout).toHaveBeenCalledTimes(1); // Should clear previous timer

      // Manually trigger the final timer callback
      const finalCallback = mockSetTimeout.mock.calls[1][0];
      await finalCallback();

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('key1', 'data2');
    });
  });

  describe('isProcessing', () => {
    it('should return true when callback is being executed', async () => {
      let callbackResolve: () => void;
      const callbackPromise = new Promise<void>((resolve) => {
        callbackResolve = resolve;
      });
      mockCallback.mockReturnValue(callbackPromise);

      manager.schedule('key1', 'data1');

      // Manually trigger the timer callback
      const timerCallback = mockSetTimeout.mock.calls[0][0];
      const executePromise = timerCallback();

      // Allow the callback to start but not complete
      await jest.runAllTicks();

      expect(manager.isProcessing('key1')).toBe(true);

      // Complete the callback
      callbackResolve!();
      await executePromise;

      expect(manager.isProcessing('key1')).toBe(false);
    });

    it('should return false for keys not being processed', () => {
      expect(manager.isProcessing('nonexistent')).toBe(false);
    });
  });

  describe('concurrent execution prevention', () => {
    it('should skip execution if callback is already processing for the same key', async () => {
      let callbackResolve: () => void;
      const callbackPromise = new Promise<void>((resolve) => {
        callbackResolve = resolve;
      });
      mockCallback.mockReturnValue(callbackPromise);

      // Schedule first callback
      manager.schedule('key1', 'data1');
      const firstCallback = mockSetTimeout.mock.calls[0][0];
      const firstExecutePromise = firstCallback();

      // Allow the callback to start but not complete
      await jest.runAllTicks();

      expect(manager.isProcessing('key1')).toBe(true);

      // Schedule second callback while first is still processing
      manager.schedule('key1', 'data2');
      const secondCallback = mockSetTimeout.mock.calls[1][0];
      await secondCallback();

      // Only the first callback should have been called
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('key1', 'data1');
      expect(manager.hasPending('key1')).toBe(false);

      // Complete the first callback
      callbackResolve!();
      await firstExecutePromise;

      expect(manager.isProcessing('key1')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle callback errors gracefully', async () => {
      const error = new Error('Callback error');
      mockCallback.mockRejectedValue(error);

      manager.schedule('key1', 'data1');

      // Manually trigger the timer callback
      const timerCallback = mockSetTimeout.mock.calls[0][0];
      await timerCallback();

      expect(console.error).toHaveBeenCalledWith('DebouncedCallbackManager: Error in callback for key1:', error);
      expect(manager.isProcessing('key1')).toBe(false);
      expect(manager.hasPending('key1')).toBe(false);
    });

    it('should clean up properly even when callback throws', async () => {
      mockCallback.mockRejectedValue(new Error('Test error'));

      manager.schedule('key1', 'data1');

      // Manually trigger the first timer callback
      const firstCallback = mockSetTimeout.mock.calls[0][0];
      await firstCallback();

      // Should be able to schedule again after error
      mockCallback.mockResolvedValue(undefined);
      manager.schedule('key1', 'data2');

      // Manually trigger the second timer callback
      const secondCallback = mockSetTimeout.mock.calls[1][0];
      await secondCallback();

      expect(mockCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('clear', () => {
    it('should clear all pending callbacks and timers', () => {
      manager.schedule('key1', 'data1');
      manager.schedule('key2', 'data2');

      expect(manager.hasPending('key1')).toBe(true);
      expect(manager.hasPending('key2')).toBe(true);
      expect(mockSetTimeout).toHaveBeenCalledTimes(2);

      manager.clear();

      expect(manager.hasPending('key1')).toBe(false);
      expect(manager.hasPending('key2')).toBe(false);
      expect(mockClearTimeout).toHaveBeenCalledTimes(2);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should clear processing state', async () => {
      let callbackResolve: () => void;
      const callbackPromise = new Promise<void>((resolve) => {
        callbackResolve = resolve;
      });
      mockCallback.mockReturnValue(callbackPromise);

      manager.schedule('key1', 'data1');

      // Manually trigger the timer callback to start processing
      const timerCallback = mockSetTimeout.mock.calls[0][0];
      const executePromise = timerCallback();
      await jest.runAllTicks();

      expect(manager.isProcessing('key1')).toBe(true);

      manager.clear();

      expect(manager.isProcessing('key1')).toBe(false);
    });
  });
});
