declare type AceModule = typeof import("ace-builds");
import * as Ace from "ace-builds";
declare const ace: AceModule;

import {App} from 'obsidian';
import {MetadataMenuAdapter} from '../externalApi/MetadataMenuAdapter';

export interface ScriptEditorConfig {
  enableDateFunctions?: boolean; // Enable now(), tomorrow(), yesterday() functions
  enablePromptFunction?: boolean; // Enable prompt() function
  additionalCompletions?: Ace.Ace.ValueCompletion[];
}

export class ScriptEditor {
  private editor: Ace.Editor | null = null;
  private textarea: HTMLTextAreaElement;
  private completions: Ace.Ace.ValueCompletion[] = [];
  private fileCompletions: Ace.Ace.ValueCompletion[] = [];
  private metadataCompletions: Ace.Ace.ValueCompletion[] = [];

  constructor(
    private app: App,
    private metadataMenuAdapter: MetadataMenuAdapter,
    private config: ScriptEditorConfig = {}
  ) {
    this.initializeCompletions();
  }

  private initializeCompletions(): void {
    // Base completions that are always available
    this.completions = [
      {value: 'file', score: 1, meta: 'TFile', docHTML: 'the obsidian TFile object currently being edited'},
      {value: 'fileClass', score: 2, meta: 'string', docHTML: 'the deduced or forced fileClass for the current file'},
      {value: 'metadata', score: 1, meta: 'object', docHTML: 'the metadata for the current file'},
      {value: 'generateMarkdownLink(file)', score: 1, meta: 'string', docHTML: 'generate a markdown link to the file'},
      {value: 'detectLanguage(text)', score: 1, meta: 'string', docHTML: 'simple language detection of the given text'},
      {value: 'getParentFile()', score: 1, meta: 'string', docHTML: 'get the parent file of the current file'},
      {value: "formatDate(date, 'YYYY-MM-DD')", score: 1, meta: 'string', docHTML: 'format javascript date with the moment library\'s format'},
    ];

    // Add date functions if enabled
    if (this.config.enableDateFunctions) {
      this.completions.push(
        {value: "now()", score: 1, meta: 'string', docHTML: 'current date with default ISO format'},
        {value: "now('YYYY-MM-DD')", score: 1, meta: 'string', docHTML: 'current date with the moment library\'s format'},
        {value: "tomorrow()", score: 1, meta: 'string', docHTML: 'date of tomorrow with default ISO format'},
        {value: "tomorrow('YYYY-MM-DD')", score: 1, meta: 'string', docHTML: 'date of tomorrow with the moment library\'s format'},
        {value: "yesterday()", score: 1, meta: 'string', docHTML: 'date of yesterday with default ISO format'},
        {value: "yesterday('YYYY-MM-DD')", score: 1, meta: 'string', docHTML: 'date of yesterday with the moment library\'s format'}
      );
    }

    // Add prompt function if enabled
    if (this.config.enablePromptFunction) {
      this.completions.push(
        {value: 'prompt("Your prompt here", "defaultValue")', score: 1, meta: 'string: show prompt dialog', docHTML: 'show a prompt dialog to the user and return the input value, defaultValue will be used in case of mass update'}
      );
    }

    // Add additional completions if provided
    if (this.config.additionalCompletions) {
      this.completions.push(...this.config.additionalCompletions);
    }

    // File completions
    this.fileCompletions = [
      {value: 'name', score: 1, meta: 'filename', docHTML: 'obsidian TFile object - file name without the path'},
      {value: 'basename', score: 1, meta: 'file\'s basename', docHTML: 'obsidian TFile object - file name without path and extension'},
      {value: 'extension', score: 1, meta: 'file extension', docHTML: 'obsidian TFile object - file extension without the dot'},
      {value: 'parent.path', score: 1, meta: 'folder path', docHTML: 'obsidian TFile object - parent folder path'},
      {value: 'path', score: 1, meta: 'file path', docHTML: 'obsidian TFile object - full file path'},
    ];

    // Metadata completions from MetadataMenu
    this.metadataCompletions = [];
    if (this.metadataMenuAdapter.isMetadataMenuAvailable()) {
      this.metadataMenuAdapter.getAllFields().forEach(field => {
        this.metadataCompletions.push({
          value: field.name,
          score: 1,
          meta: `Metadata`,
          docHTML: `Metadata field: ${field.name}.<br>Type: ${field.type}.<br>Description: ${field?.tooltip || 'No description available.'}`,
        });
      });
    }
  }

  createEditor(container: HTMLElement, placeholder: string = 'return "";', initialValue: string = ''): HTMLTextAreaElement {
    this.textarea = container.createEl('textarea', {
      placeholder: placeholder,
      cls: 'metaflow-settings-script-textarea'
    });
    this.textarea.value = initialValue;

    if (typeof ace !== 'undefined') {
      this.editor = ace.edit(this.textarea);
      this.editor.setTheme("ace/theme/dracula");
      this.editor.session.setMode("ace/mode/javascript");
      this.editor.session.setUseWrapMode(true);
      this.editor.setHighlightActiveLine(true);

      this.editor.completers = [
        {
          getCompletions: (Editor: any, session: any, pos: any, prefix: any, callback: any) => {
            const linePrefix = session.getLine(pos.row).substring(0, pos.column);
            if (/metadata\./.exec(linePrefix)) {
              callback(null, this.metadataCompletions);
              return;
            } else if (/file\./.exec(linePrefix)) {
              callback(null, this.fileCompletions);
              return;
            }
            callback(null, this.completions);
          },
        }
      ];

      this.editor.setOptions({
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true,
        useWorker: false,
        showLineNumbers: true,
        fontSize: "14px",
        wrap: true,
        autoScrollEditorIntoView: true,
        minLines: 5,
        maxLines: 20,
        tabSize: 2,
        useSoftTabs: true,
        highlightActiveLine: true,
        highlightGutterLine: true,
      });
      this.editor.resize();
    }

    return this.textarea;
  }

  getValue(): string {
    if (this.editor) {
      return this.editor.getValue();
    }
    return this.textarea.value;
  }

  setValue(value: string): void {
    if (this.editor) {
      this.editor.setValue(value);
    } else {
      this.textarea.value = value;
    }
  }

  getCompletions(): Ace.Ace.ValueCompletion[] {
    return this.completions;
  }

  destroy(): void {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }
}
