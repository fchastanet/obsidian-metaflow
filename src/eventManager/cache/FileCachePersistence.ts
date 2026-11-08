import {ObsidianAdapter} from "@metaflow/externalApi/ObsidianAdapter";
import {ICachePersistence} from "./types";
import {TYPES} from "@metaflow/di/types";
import {inject} from "inversify";

export default class FileCachePersistence<T> implements ICachePersistence<T> {
  constructor(
    @inject(TYPES.ObsidianAdapter) private obsidianAdapter: ObsidianAdapter,
  ) {
  }

  async saveCache(fileName: string, data: Map<string, T>): Promise<void> {
    const cacheData = Array.from(data.entries());
    await this.obsidianAdapter.saveToPluginDirectory(fileName, cacheData);
  }

  async loadCache(fileName: string): Promise<Map<string, T>> {
    try {
      const obj: [key: string, value: T][] = await this.obsidianAdapter.loadFromPluginDirectory(fileName) as [key: string, value: T][];
      const map = new Map<string, T>();
      obj.forEach(([key, value]) => {
        map.set(key, value);
      });
      return map;
    } catch (error) {
      console.error('Error loading cache:', error);
      // If the file doesn't exist or there's an error, return an empty map
      return new Map<string, T>();
    }
  }
}
