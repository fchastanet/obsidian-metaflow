import {domCreate} from "../__mocks__/dom";
import {LogNoticeManager} from "./LogNoticeManager";

describe("LogNoticeManager", () => {
  let obsidianAdapter: any;
  let manager: LogNoticeManager;
  let domCreateFn: any = domCreate;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    obsidianAdapter = {
      notice: jest.fn().mockImplementation((message: string) => {
        return {
          messageEl: jest.fn().mockImplementation(() => {
            return {
              createDiv: domCreateFn,
            };
          })()
        }
      }),
    };
    // Ensure obsidianAdapter is not undefined and has all required properties
    manager = new LogNoticeManager(obsidianAdapter);
  });

  it("should call notice for debug", () => {
    const noticeObj = {messageEl: {createDiv: domCreateFn}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addDebug("debug");
    expect(domCreateFn).toHaveBeenCalledTimes(3);
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "debug level"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - DEBUG 🐞"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "debug"});
  });

  it("should call notice for info", () => {
    const noticeObj = {messageEl: {createDiv: domCreateFn}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addInfo("info");
    expect(domCreateFn).toHaveBeenCalledTimes(3);
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "info level"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - INFO ℹ️"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "info"});
  });

  it("should call notice for warning", () => {
    const noticeObj = {messageEl: {createDiv: domCreateFn}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addWarning("warn");
    expect(domCreateFn).toHaveBeenCalledTimes(3);
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "warning level"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - WARNING ⚠️"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "warn"});
  });

  it("should call notice for error", () => {
    const noticeObj = {messageEl: {createDiv: domCreateFn}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);

    manager.addError("error");
    expect(domCreateFn).toHaveBeenCalledTimes(3);
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "error level"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - ERROR ❌"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "error"});
  });

  it("should call addMessage with info level and use addDebug", () => {
    const noticeObj = {messageEl: {createDiv: domCreateFn}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);
    manager.addMessage("debug", "info");
    expect(domCreateFn).toHaveBeenCalledTimes(3);
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "info level"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - INFO ℹ️"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "debug"});
  });

  it("should call addMessage with warning level and use addWarning", () => {
    const noticeObj = {messageEl: {createDiv: domCreateFn}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);
    manager.addMessage("warn", "warning");
    expect(domCreateFn).toHaveBeenCalledTimes(3);
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "warning level"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - WARNING ⚠️"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "warn"});
  });

  it("should call addMessage with error level and use addError", () => {
    const noticeObj = {messageEl: {createDiv: domCreateFn}};
    obsidianAdapter.notice.mockReturnValueOnce(noticeObj);
    manager.addMessage("error", "error");
    expect(domCreateFn).toHaveBeenCalledTimes(3);
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice", "title": "error level"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-title", "text": "MetaFlow - ERROR ❌"});
    expect(domCreateFn).toHaveBeenCalledWith({"cls": "meta-flow-notice-message", "text": "error"});
  });

  it("should call addMessage with ignore level and do nothing", () => {
    manager.addMessage("ignored", "ignore");
    expect(obsidianAdapter.notice).not.toHaveBeenCalled();
  });
});
