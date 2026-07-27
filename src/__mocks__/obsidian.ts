
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

export class WorkspaceLeaf {
  view: any;

  constructor(view: any = null) {
    this.view = view;
  }
}

export class AbstractInputSuggest {
  constructor() { }
}

export class PluginSettingTab {
  constructor(
    private app: App,
    private plugin: any
  ) { }

  display(): void { }
}

export class Plugin {
  app: App;
  manifest: any;
  settings: any;

  constructor() {
    this.manifest = {};
    this.settings = {};
    this.app = {
      workspace: {
        getActiveLeaf: jest.fn(),
        onLayoutReady: jest.fn(),
        on: jest.fn(),
      },
    } as App;
  }
}

export class MarkdownView {
  file: TFile;

  constructor(file: TFile) {
    this.file = file;
  }
}

export class Modal {
  constructor(
    private app: App
  ) { }
}

export const Notice = jest.fn().mockImplementation((message: string) => ({
  message
}));

export const stringifyYaml = jest.fn();
export const parseYaml = jest.fn();
export const normalizePath = jest.fn().mockImplementation((path: string) => path);

// Mock getFrontMatterInfo
export const getFrontMatterInfo = jest.fn().mockImplementation((content: string) => {
  // Default mock implementation that parses frontmatter similar to Obsidian
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)---\n([\s\S]*)$/);
  if (frontmatterMatch) {
    const frontmatterContent = frontmatterMatch[1];
    const restContent = frontmatterMatch[2];
    const contentStart = content.length - restContent.length;

    // Check if frontmatter is effectively empty (only whitespace)
    const isEmpty = !frontmatterContent || frontmatterContent.trim() === '';

    return {
      exists: !isEmpty,
      frontmatter: isEmpty ? '' : frontmatterContent,
      from: 0,
      to: isEmpty ? 0 : contentStart,
      contentStart: contentStart, // Always point to after the frontmatter delimiters
    };
  }
  return {
    exists: false,
    frontmatter: '',
    from: 0,
    to: 0,
    contentStart: 0,
  };
});

export class Workspace {
  getActiveFile(): TFile | null {
    return null; // Default mock implementation
  }
}

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
  workspace: {
    getActiveLeaf: jest.Mock;
    onLayoutReady: jest.Mock;
    on: jest.Mock;
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
