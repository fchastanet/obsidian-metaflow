import 'obsidian';

declare module 'obsidian' {
  interface App {
    plugins?: {
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
  }
}
