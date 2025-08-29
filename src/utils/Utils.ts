import {createHash} from "crypto";
export class Utils {
  static timeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async sleep<T extends (...args: any[]) => any>(timeout: number, fn: T, ...args: Parameters<T>): Promise<ReturnType<T>> {
    await this.timeout(timeout);
    return fn(...args);
  }

  /**
   * Creates a debounced version of the provided function.
   * The debounced function delays invoking the function until after wait milliseconds have elapsed
   * since the last time it was invoked.
   */
  static debounce<T extends (...args: any[]) => void>(fn: T, wait: number): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    return (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), wait);
    };
  }

  /**
   * Computes the SHA-256 hash of a string and returns it as a hex string.
   * @param input The string to hash.
   */
  static sha256(input: string): string {
    return createHash("sha256").update(input, "utf8").digest("hex");
  }
}
