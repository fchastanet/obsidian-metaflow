export const mockLogManager = {
  addDebug: jest.fn(),
  addWarning: jest.fn(),
  addError: jest.fn(),
  addInfo: jest.fn(),
  addMessage: jest.fn(),
};

export const expectNoLogs = () => {
  expect(mockLogManager.addDebug).not.toHaveBeenCalled();
  expect(mockLogManager.addInfo).not.toHaveBeenCalled();
  expect(mockLogManager.addWarning).not.toHaveBeenCalled();
  expect(mockLogManager.addError).not.toHaveBeenCalled();
  expect(mockLogManager.addMessage).not.toHaveBeenCalled();
  mockLogManager.addDebug.mockRestore();
  mockLogManager.addInfo.mockRestore();
  mockLogManager.addWarning.mockRestore();
  mockLogManager.addError.mockRestore();
  mockLogManager.addMessage.mockRestore();
}
