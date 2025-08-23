import {Editor, MarkdownView} from 'obsidian';
import {LogManagerInterface} from '../managers/types';

export interface BaseCommand {
  execute(...args: any[]): Promise<void> | void;
}

export interface EditorCommand extends BaseCommand {
  execute(editor: Editor, view: MarkdownView, logManager: LogManagerInterface): Promise<void> | void;
}

export interface SimpleCommand extends BaseCommand {
  execute(logManager: LogManagerInterface): Promise<void> | void;
}
