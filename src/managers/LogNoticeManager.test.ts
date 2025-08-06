import {LogNoticeManager} from "./LogNoticeManager";

describe("LogNoticeManager", () => {
  let obsidianAdapter: any;
  let manager: LogNoticeManager;

  beforeEach(() => {
    obsidianAdapter = {
      notice: jest.fn().mockImplementation((message: string) => {
        return {
          messageEl: document.createElement("div")
        }
      }),
    };
    // Ensure obsidianAdapter is not undefined and has all required properties
    manager = new LogNoticeManager(obsidianAdapter);
  });

  it("should call notice for debug", () => {
    const noticeObj = {messageEl: document.createElement("div")};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addDebug("debug");
    expect(noticeObj.messageEl.innerHTML).toContain(`MetaFlow - DEBUG 🐞`);
  });

  it("should call notice for info", () => {
    const noticeObj = {messageEl: document.createElement("div")};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addInfo("info");
    expect(noticeObj.messageEl.innerHTML).toContain(`MetaFlow - INFO ℹ️`);
  });

  it("should call notice for warning", () => {
    const noticeObj = {messageEl: document.createElement("div")};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addWarning("warn");
    expect(noticeObj.messageEl.innerHTML).toContain(`MetaFlow - WARNING ⚠️`);
  });

  it("should call notice for error", () => {
    const noticeObj = {messageEl: document.createElement("div")};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addError("error");
    expect(noticeObj.messageEl.innerHTML).toContain(`MetaFlow - ERROR ❌`);
  });

  it("should call addMessage with info level and use addDebug", () => {
    const noticeObj = {messageEl: document.createElement("div")};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);
    manager.addMessage("debug", "info");
    expect(noticeObj.messageEl.innerHTML).toContain(`MetaFlow - INFO ℹ️`);
  });

  it("should call addMessage with warning level and use addWarning", () => {
    const noticeObj = {messageEl: document.createElement("div")};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);
    manager.addMessage("warn", "warning");
    expect(noticeObj.messageEl.innerHTML).toContain(`MetaFlow - WARNING ⚠️`);
  });

  it("should call addMessage with error level and use addError", () => {
    const noticeObj = {messageEl: document.createElement("div")};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);
    manager.addMessage("error", "error");
    expect(noticeObj.messageEl.innerHTML).toContain(`MetaFlow - ERROR ❌`);
  });

  it("should call addMessage with ignore level and do nothing", () => {
    manager.addMessage("ignored", "ignore");
    expect(obsidianAdapter.notice).not.toHaveBeenCalled();
  });
});
