export class MetaFlowException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaFlowException";
  }
}
