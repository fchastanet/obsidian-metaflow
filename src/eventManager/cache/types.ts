export type ICachePersistence<T> = {
  saveCache(fileName: string, data: Map<string, T>): Promise<void>;
  loadCache(fileName: string): Promise<Map<string, T>>;
};

export class FileState {
  fileMtime: number
  fileClass?: string
  checksum?: string
}

export class InternalFileState extends FileState {
  isDirty: boolean = false
  lastUpdateTime: number
}
