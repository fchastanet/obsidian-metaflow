export class SkipException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkipException";
  }
}
