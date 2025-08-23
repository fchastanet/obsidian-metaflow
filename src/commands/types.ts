import {Editor, MarkdownView, TFile, App} from 'obsidian';
import {MetaFlowSettings} from '../settings/types';
import {MetaFlowService} from '../services/MetaFlowService';
import {FileClassStateManager} from '../managers/FileClassStateManager';
import {ObsidianAdapter} from '../externalApi/ObsidianAdapter';
import {LogManagerInterface} from '../managers/types';
import {ServiceContainer} from '../services/ServiceContainer';

export interface CommandDependencies {
  app: App;
  settings: MetaFlowSettings;
  metaFlowService: MetaFlowService; // Keep for backward compatibility until fully removed
  serviceContainer: ServiceContainer;
  fileClassStateManager: FileClassStateManager;
  obsidianAdapter: ObsidianAdapter;
  saveSettings: () => Promise<void>;
}

export interface BaseCommand {
  execute(...args: any[]): Promise<void> | void;
}

export interface EditorCommand extends BaseCommand {
  execute(editor: Editor, view: MarkdownView, logManager: LogManagerInterface): Promise<void> | void;
}

export interface SimpleCommand extends BaseCommand {
  execute(logManager: LogManagerInterface): Promise<void> | void;
}
