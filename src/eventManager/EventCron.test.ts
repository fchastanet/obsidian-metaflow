import {MetaFlowSettings} from "@metaflow/settings/types";
import EventCron from "./EventCron";
import {FileOperationsService} from "@metaflow/services/FileOperationsService";
import {FileStateCache} from "./cache/FileStateCache";

describe('EventCron', () => {
  let eventCron: EventCron;
  let fileStateCache: jest.Mocked<FileStateCache>;
  let settings: MetaFlowSettings;
  let fileOperationsService: jest.Mocked<FileOperationsService>;
  let nowFn: jest.Mock;
  let spyInfo: jest.SpyInstance;
  let spyWarn: jest.SpyInstance;
  let spyError: jest.SpyInstance;
  let spyDebug: jest.SpyInstance;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    spyInfo = jest.spyOn(console, 'info').mockImplementation(() => { });
    spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { });
    spyError = jest.spyOn(console, 'error').mockImplementation(() => { });
    spyDebug = jest.spyOn(console, 'debug').mockImplementation(() => { });
    fileStateCache = {
      evictStaleEntries: jest.fn(),
      getDirtyFilePaths: jest.fn(),
      popState: jest.fn(),
      setState: jest.fn(),
    } as unknown as jest.Mocked<FileStateCache>;

    settings = {
      eventCronIntervalMs: 1000,
      cronMaxDurationMs: 500,
      debugMode: false,
    } as unknown as jest.Mocked<MetaFlowSettings>;

    fileOperationsService = {
      processFile: jest.fn(),
    } as unknown as jest.Mocked<FileOperationsService>;

    nowFn = jest.fn().mockReturnValue(1000);

    eventCron = new EventCron(fileStateCache, settings, fileOperationsService, nowFn);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    spyInfo.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
    spyDebug.mockRestore();
  });

  test('start sets up interval', () => {
    fileStateCache.getDirtyFilePaths.mockReturnValue([]);
    eventCron.start();
    jest.advanceTimersByTime(settings.eventCronIntervalMs + 100); // Advance time to trigger interval
    expect(fileStateCache.evictStaleEntries).toHaveBeenCalled();
    expect(fileOperationsService.processFile).not.toHaveBeenCalled(); // No dirty files yet
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });

  test('stop clears interval', () => {
    eventCron.start();
    eventCron.stop();
    expect((eventCron as any).cronInterval).toEqual(null);
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });

  test('run processes dirty files', async () => {
    fileStateCache.getDirtyFilePaths.mockReturnValue(['file1.md', 'file2.md']);
    fileStateCache.popState.mockReturnValue({fileMtime: 123, checksum: 'abc', isDirty: true, lastUpdateTime: 1000});
    fileOperationsService.processFile.
      mockResolvedValueOnce(
        {
          file: {path: 'file1.md'} as any,
          state: {fileMtime: 123, checksum: 'abc', isDirty: false, lastUpdateTime: 1000} as any
        }
      ).
      mockResolvedValueOnce(
        {
          file: {path: 'file2.md'} as any,
          state: {fileMtime: 123, checksum: 'abc', isDirty: false, lastUpdateTime: 1000} as any
        }
      )
      ;

    await eventCron['run']();

    expect(fileStateCache.evictStaleEntries).toHaveBeenCalled();
    expect(fileStateCache.getDirtyFilePaths).toHaveBeenCalled();
    expect(fileStateCache.setState).toHaveBeenCalledTimes(2);
    expect(fileStateCache.setState).toHaveBeenCalledWith('file1.md', expect.objectContaining({isDirty: false}), false);
    expect(fileStateCache.setState).toHaveBeenCalledWith('file2.md', expect.objectContaining({isDirty: false}), false);
    expect(fileOperationsService.processFile).toHaveBeenCalledTimes(2);
    expect(fileOperationsService.processFile).toHaveBeenCalledWith('file1.md', expect.any(Object));
    expect(fileOperationsService.processFile).toHaveBeenCalledWith('file2.md', expect.any(Object));
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });

  test('run handles no dirty files gracefully', async () => {
    fileStateCache.getDirtyFilePaths.mockReturnValue([]);

    await eventCron['run']();

    expect(fileStateCache.evictStaleEntries).toHaveBeenCalled();
    expect(fileStateCache.getDirtyFilePaths).toHaveBeenCalled();
    expect(fileOperationsService.processFile).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });

  test('run handles errors gracefully', async () => {
    fileStateCache.getDirtyFilePaths.mockImplementation(() => {throw new Error('Test error');});

    await expect(eventCron['run']()).resolves.not.toThrow();
    expect(fileStateCache.evictStaleEntries).toHaveBeenCalled();
    expect(fileStateCache.getDirtyFilePaths).toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalledWith("EventCron encountered an error during execution.", expect.any(Error));
  });

  test('run respects cron max duration', async () => {
    settings.eventCronIntervalMs = 1015;
    fileStateCache.getDirtyFilePaths.mockReturnValue(['file1.md', 'file2.md', 'file3.md']);
    fileStateCache.popState.mockReturnValue({fileMtime: 123, checksum: 'abc', isDirty: true, lastUpdateTime: 1000});
    nowFn.mockReturnValueOnce(1000).mockReturnValueOnce(1005).mockReturnValueOnce(1010).mockReturnValueOnce(1020); // Simulate time passing
    fileOperationsService.processFile.
      mockResolvedValueOnce(
        {
          file: {path: 'file1.md'} as any,
          state: {fileMtime: 123, checksum: 'abc', isDirty: false, lastUpdateTime: 1000} as any
        }
      ).
      mockResolvedValueOnce(
        {
          file: {path: 'file2.md'} as any,
          state: {fileMtime: 123, checksum: 'abc', isDirty: false, lastUpdateTime: 1000} as any
        }
      )
      ;

    await eventCron['run']();

    expect(fileOperationsService.processFile).toHaveBeenCalledTimes(2); // Should stop before processing the third file
    expect(spyWarn).toHaveBeenCalledWith("EventCron: Scheduled tasks are taking longer than the interval.");
    expect(spyError).not.toHaveBeenCalled();
  });
});
