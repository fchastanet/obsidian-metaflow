export class Utils {
  static timeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async sleep<T extends (...args: any[]) => any>(timeout: number, fn: T, ...args: Parameters<T>): Promise<ReturnType<T>> {
    await this.timeout(timeout);
    return fn(...args);
  }
}
