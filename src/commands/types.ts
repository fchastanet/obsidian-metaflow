import {Editor, MarkdownView} from 'obsidian';

export interface BaseCommand {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(...args: any[]): Promise<void> | void;
}

export interface EditorCommand extends BaseCommand {
  execute(editor: Editor, view: MarkdownView): Promise<void> | void;
}

export interface SimpleCommand extends BaseCommand {
  execute(): Promise<void> | void;
}
