import 'obsidian';

declare module 'obsidian' {
  interface App {
    plugins?: {
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins?: Record<string, any>;
      enabledPlugins?: Set<string>;
    };
  }

  interface Workspace {
    lastActiveFile?: string;
    recentFileTracker?: {
      lastOpenFiles?: string[];
    };
  }

  interface TAbstractFile {
    saving: boolean;
    deleted: boolean;
  }
}
