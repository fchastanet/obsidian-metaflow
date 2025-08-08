import {LogNoticeManager} from "./LogNoticeManager";

describe("LogNoticeManager", () => {
  let obsidianAdapter: any;
  let manager: LogNoticeManager;
  let domCreate: any;

  beforeEach(() => {
    domCreate = jest.fn().mockImplementation(({cls, title, text}) => {
      const div = document.createElement("div");
      if (cls) div.className = cls;
      if (title) div.title = title;
      if (text) div.textContent = text;
      div.createDiv = domCreate;
      return div;
    });

    obsidianAdapter = {
      notice: jest.fn().mockImplementation((message: string) => {
        return {
          messageEl: jest.fn().mockImplementation(() => {
            return {
              createDiv: domCreate,
            };
          })()
        }
      }),
    };
    // Ensure obsidianAdapter is not undefined and has all required properties
    manager = new LogNoticeManager(obsidianAdapter);
  });

  it("should call notice for debug", () => {
    const noticeObj = {messageEl: {createDiv: domCreate}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addDebug("debug");
    expect(domCreate).toHaveBeenCalledTimes(3);
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "debug level"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - DEBUG 🐞"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "debug"});
  });

  it("should call notice for info", () => {
    const noticeObj = {messageEl: {createDiv: domCreate}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addInfo("info");
    expect(domCreate).toHaveBeenCalledTimes(3);
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "info level"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - INFO ℹ️"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "info"});
  });

  it("should call notice for warning", () => {
    const noticeObj = {messageEl: {createDiv: domCreate}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addWarning("warn");
    expect(domCreate).toHaveBeenCalledTimes(3);
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "warning level"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - WARNING ⚠️"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "warn"});
  });

  it("should call notice for error", () => {
    const noticeObj = {messageEl: {createDiv: domCreate}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addError("error");
    expect(domCreate).toHaveBeenCalledTimes(3);
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "error level"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - ERROR ❌"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "error"});
  });

  it("should call addMessage with info level and use addDebug", () => {
    const noticeObj = {messageEl: {createDiv: domCreate}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);
    manager.addMessage("debug", "info");
    expect(domCreate).toHaveBeenCalledTimes(3);
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "info level"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - INFO ℹ️"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "debug"});
  });

  it("should call addMessage with warning level and use addWarning", () => {
    const noticeObj = {messageEl: {createDiv: domCreate}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);
    manager.addMessage("warn", "warning");
    expect(domCreate).toHaveBeenCalledTimes(3);
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "warning level"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - WARNING ⚠️"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "warn"});
  });

  it("should call addMessage with error level and use addError", () => {
    const noticeObj = {messageEl: {createDiv: domCreate}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);
    manager.addMessage("error", "error");
    expect(domCreate).toHaveBeenCalledTimes(3);
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "error level"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - ERROR ❌"});
    expect(domCreate).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "error"});
  });

  it("should call addMessage with ignore level and do nothing", () => {
    manager.addMessage("ignored", "ignore");
    expect(obsidianAdapter.notice).not.toHaveBeenCalled();
  });
});
