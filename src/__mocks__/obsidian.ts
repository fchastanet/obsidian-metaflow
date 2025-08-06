// Mock for Obsidian API
export class TFile {
  basename: string;
  extension: string;
  path: string;

  constructor(basename: string = 'test', extension: string = 'md', path?: string) {
    this.basename = basename;
    this.extension = extension;
    this.path = path || `${basename}.${extension}`;
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
