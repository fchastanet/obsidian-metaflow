import {MetaFlowSettings} from "../settings/types";

/**
 * Manages debounced callbacks with concurrency control
 */
export class DebouncedCallbackManager<T> {
  private debounceTimers: Map<string, number> = new Map();
  private pendingCallbacks: Map<string, T> = new Map();
  private processingKeys: Set<string> = new Set();
  private readonly DEBOUNCE_DELAY = 1000; // 1 second

  constructor(
    private callback: (key: string, data: T) => Promise<void>,
    private settings: MetaFlowSettings
  ) { }

  /**
   * Schedule a callback for the given key with debouncing
   * If multiple calls are made for the same key, only the last one will be executed
   */
  schedule(key: string, data: T): void {
    // Store the latest callback parameters (this ensures we always use the LAST event)
    this.pendingCallbacks.set(key, data);

    // Clear any existing timer for this key
    if (this.debounceTimers.has(key)) {
      window.clearTimeout(this.debounceTimers.get(key)!);
    }

    // Set a new timer to execute the callback with the latest parameters
    const timer = window.setTimeout(async () => {
      await this.execute(key);
    }, this.DEBOUNCE_DELAY);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Execute the callback for a specific key
   */
  private async execute(key: string): Promise<void> {
    // Clean up timer
    this.debounceTimers.delete(key);

    // Get the latest callback parameters
    const callbackData = this.pendingCallbacks.get(key);
    if (!callbackData) {
      this.pendingCallbacks.delete(key);
      return;
    }

    // Prevent concurrent execution for the same key
    if (this.isProcessing(key)) {
      if (this.settings.debugMode) {
        console.debug(`DebouncedCallbackManager: Callback already processing for ${key}, skipping`);
      }
      this.pendingCallbacks.delete(key);
      return;
    }

    // Mark key as being processed
    this.processingKeys.add(key);

    try {
      if (this.settings.debugMode) {
        console.debug(`DebouncedCallbackManager: Executing callback for ${key}`);
      }

      await this.callback(key, callbackData);
    } catch (error) {
      console.error(`DebouncedCallbackManager: Error in callback for ${key}:`, error);
    } finally {
      // Always clean up
      this.processingKeys.delete(key);
      this.pendingCallbacks.delete(key);
    }
  }

  /**
   * Check if a callback is currently being processed for the given key
   */
  isProcessing(key: string): boolean {
    return this.processingKeys.has(key);
  }

  /**
   * Check if there's a pending callback for the given key
   */
  hasPending(key: string): boolean {
    return this.pendingCallbacks.has(key);
  }

  /**
   * Get the pending callback data for a key (for testing purposes)
   */
  getPending(key: string): T | undefined {
    return this.pendingCallbacks.get(key);
  }

  /**
   * Clear all pending callbacks and timers
   */
  clear(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      window.clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingCallbacks.clear();
    this.processingKeys.clear();
  }
}
