import {ObsidianAdapter} from "@metaflow/externalApi/ObsidianAdapter";
import CachePersistence from "./FileCachePersistence";

describe('CachePersistence', () => {
  let cachePersistence: CachePersistence<any>;
  let mockObsidianAdapter: jest.Mocked<ObsidianAdapter>;

  // Mock console.error to avoid cluttering test output
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockObsidianAdapter = {
      saveToPluginDirectory: jest.fn(),
      loadFromPluginDirectory: jest.fn()
    } as any;

    cachePersistence = new CachePersistence<any>(mockObsidianAdapter);
  });

  it('should save cache data to plugin directory', async () => {
    const data = new Map<string, any>([['key1', {value: 1}], ['key2', {value: 2}]]);
    await cachePersistence.saveCache('testCache.json', data);
    expect(mockObsidianAdapter.saveToPluginDirectory).toHaveBeenCalledWith(
      'testCache.json',
      Array.from(data.entries())
    );
  });

  it('should load cache data from plugin directory', async () => {
    const mockData = [['key1', {value: 1}], ['key2', {value: 2}]];
    mockObsidianAdapter.loadFromPluginDirectory.mockResolvedValue(mockData);

    const result = await cachePersistence.loadCache('testCache.json');
    expect(result.size).toBe(2);
    expect(result.get('key1')).toEqual({value: 1});
    expect(result.get('key2')).toEqual({value: 2});
    expect(mockObsidianAdapter.loadFromPluginDirectory).toHaveBeenCalledWith('testCache.json');
  });

  it('should return empty map if loading fails', async () => {
    mockObsidianAdapter.loadFromPluginDirectory.mockRejectedValue(new Error('File not found'));

    const result = await cachePersistence.loadCache('testCache.json');
    expect(result.size).toBe(0);
  });
});
