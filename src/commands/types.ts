import {Editor, MarkdownView} from 'obsidian';
import {LogManagerInterface} from '../managers/types';

export interface BaseCommand {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(...args: any[]): Promise<void> | void;
}

export interface EditorCommand extends BaseCommand {
  execute(editor: Editor, view: MarkdownView, logManager: LogManagerInterface): Promise<void> | void;
}

export interface SimpleCommand extends BaseCommand {
  execute(logManager: LogManagerInterface): Promise<void> | void;
}
