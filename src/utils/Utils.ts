import {createHash} from "crypto";
export class Utils {
  static timeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async sleep(timeout: number, fn: () => void): Promise<void> {
    await this.timeout(timeout);
    return fn();
  }

  /**
   * Computes the SHA-256 hash of a string and returns it as a hex string.
   * @param input The string to hash.
   */
  static sha256(input: string): string {
    return createHash("sha256").update(input, "utf8").digest("hex");
  }
}
