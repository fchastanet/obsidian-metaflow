export const mockLogNoticeManager = {
  addDebug: jest.fn(),
  addWarning: jest.fn(),
  addError: jest.fn(),
  addInfo: jest.fn(),
  addMessage: jest.fn(),
};

export const expectNoLogs = () => {
  expect(mockLogNoticeManager.addDebug).not.toHaveBeenCalled();
  expect(mockLogNoticeManager.addInfo).not.toHaveBeenCalled();
  expect(mockLogNoticeManager.addWarning).not.toHaveBeenCalled();
  expect(mockLogNoticeManager.addError).not.toHaveBeenCalled();
  expect(mockLogNoticeManager.addMessage).not.toHaveBeenCalled();
  mockLogNoticeManager.addDebug.mockRestore();
  mockLogNoticeManager.addInfo.mockRestore();
  mockLogNoticeManager.addWarning.mockRestore();
  mockLogNoticeManager.addError.mockRestore();
  mockLogNoticeManager.addMessage.mockRestore();
}
