export type NoticeLevel = 'info' | 'warning' | 'error' | 'ignore';

export class MetaFlowException extends Error {
  public noticeLevel: NoticeLevel;

  constructor(message: string, noticeLevel: NoticeLevel) {
    super(message);
    this.name = "MetaFlowException";
    this.noticeLevel = noticeLevel;
  }
}
