export type LogManagerLogLevel = 'info' | 'warning' | 'error' | 'ignore';
export type LogManagerInterface = {
  addDebug(message: string): void;
  addInfo(message: string): void;
  addWarning(message: string): void;
  addError(message: string): void;
  addMessage(message: string, logLevel: LogManagerLogLevel): void;
};
