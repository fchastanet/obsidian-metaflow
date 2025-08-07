// Mock for Obsidian API
export class TFile {
  basename: string;
  extension: string;
  path: string;
  name: string;
  stat: {ctime: number; mtime: number; size: number};
  vault: any;
  parent: any;

  constructor(basename: string = 'test', extension: string = 'md', path?: string) {
    this.basename = basename;
    this.extension = extension;
    this.path = path || `${basename}.${extension}`;
    this.name = this.path.split('/').pop() || this.path;
    this.stat = {ctime: 0, mtime: 0, size: 0};
    this.vault = {} as any;
    this.parent = {} as any;
  }
}

export class TAbstractFile {
  name: string;
  path: string;

  constructor(name: string, path: string) {
    this.name = name;
    this.path = path;
  }
}

export function createTFile(path: string): TFile {
  const file = {
    path,
    name: path.split('/').pop() || path,
    stat: {ctime: 0, mtime: 0, size: 0},
    basename: path.split('/').pop()?.split('.')[0] || path,
    extension: path.split('.').pop() || 'md',
    vault: {} as any,
    parent: {} as any,
  } as TFile;
  Object.setPrototypeOf(file, TFile.prototype);
  return file;
}


export const Notice = jest.fn().mockImplementation((message: string) => ({
  message
}));

export class App {
  vault: {
    read: jest.Mock;
    modify: jest.Mock;
    getMarkdownFiles: jest.Mock;
    getAbstractFileByPath: jest.Mock;
  };
  plugins: {
    plugins: Record<string, any>;
  };

  constructor() {
    this.vault = {
      read: jest.fn(),
      modify: jest.fn(),
      getMarkdownFiles: jest.fn(),
      getAbstractFileByPath: jest.fn()
    };
    this.plugins = {
      plugins: {}
    };
  }
}
