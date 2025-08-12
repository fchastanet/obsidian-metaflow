export class Utils {
  static timeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async sleep(timeout: number, fn: Function, ...args: any[]) {
    await this.timeout(timeout);
    return fn(...args);
  }
}
