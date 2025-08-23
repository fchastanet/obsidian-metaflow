import {App, CachedMetadata, MarkdownView, TAbstractFile, TFile, WorkspaceLeaf} from "obsidian";
import {MetaFlowService} from "../services/MetaFlowService";
import {MetaFlowSettings} from "../settings/types";
import {LogManagerInterface} from "./types";
import {ViewUpdate} from '@codemirror/view';
import {Transaction} from '@codemirror/state';

export type FileClassChangedCallback = (
  file: TFile, cache: CachedMetadata | null, oldFileClass: string, newFileClass: string
) => Promise<void>;

/**
 * Detects when fileClass is manually changed by the user.
 */
export class FileClassStateManager {
  private app: App;
  private metaFlowService: MetaFlowService;
  private settings: MetaFlowSettings;
  private fileClassChangedCallback?: FileClassChangedCallback;
  private logManager: LogManagerInterface;

  private fileClassMap: Map<string, string>;
  private fileModifiedMap: Map<string, boolean>;
  private fileRenamedMap: Map<string, string>;
  private enabled: boolean;

  // List of user events considered as manual edits
  private static manualEditEvents = [
    "set",
    "input", "input.type", "input.paste", "cut", "input.drop",
    "delete.backward", "delete.forward", "undo", "redo", "input.complete"
  ];


  constructor(
    app: App,
    settings: MetaFlowSettings,
    logManager: LogManagerInterface,
    fileClassChangedCallback?: FileClassChangedCallback,
  ) {
    this.app = app;
    this.settings = settings;
    this.logManager = logManager;
    this.fileClassChangedCallback = fileClassChangedCallback;

    this.metaFlowService = new MetaFlowService(app, settings);
    this.fileClassMap = new Map<string, string>();
    this.fileModifiedMap = new Map<string, boolean>();
    this.fileRenamedMap = new Map<string, string>();
    this.enabled = true;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // ensure all file states are cleared in case handle is called a little bit after mass update
      this.fileClassMap.clear();
      this.fileModifiedMap.clear();
      this.fileRenamedMap.clear();
    }
  }

  public handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
    if (!this.enabled) {
      if (this.settings.debugMode) console.debug('FileClassStateManager is disabled, skipping handleActiveLeafChange');
      return;
    }
    if (this.settings.debugMode) console.debug(`FileClassStateManager: handleActiveLeafChange`, leaf);
    if (!this.settings.autoMetadataInsertion) {
      return;
    }
    if (!leaf || !leaf.view || !(leaf.view instanceof MarkdownView)) {
      if (this.settings.debugMode) console.debug('Active leaf is not a Markdown view or is null');
      return;
    }
    const file = leaf?.view?.file;
    if (!file) {
      if (this.settings.debugMode) console.debug('No file associated with the active view');
      return;
    }

    if (!(file instanceof TFile)) {
      if (this.settings.debugMode) console.debug('Active view does not have a valid file');
      return;
    }
    this.registerFileClass(file);
  }

  private registerFileClass(file: TFile): {fileClass: string; fileCache: CachedMetadata | null} {
    if (this.settings.debugMode) console.debug(`FileClassStateManager: registerFileClass for ${file.path}`, file);
    const fileCache = this.app.metadataCache.getFileCache(file);
    let fileClass = '';
    if (fileCache?.frontmatter) {
      fileClass = this.metaFlowService.getFileClassFromMetadata(fileCache.frontmatter) || '';
    }
    if (this.settings.debugMode) console.debug(`FileClassStateManager: registerFileClass ${fileClass} for ${file.path}`, file);
    this.fileClassMap.set(file.path, fileClass);
    return {
      fileClass,
      fileCache,
    };
  }

  public handleMetadataChanged(file: TFile, data: string, cache: CachedMetadata): void {
    if (!this.enabled) {
      if (this.settings.debugMode) console.debug('FileClassStateManager is disabled, skipping handleMetadataChanged');
      return;
    }
    if (this.settings.debugMode) console.debug(`FileClassStateManager: handleMetadataChanged for ${file.path}`, file, data, cache);
    if (data === "") {
      // ignore metadata changes for new files
      return;
    }
    if (!this.fileModifiedMap.get(file.path)) {
      if (this.settings.debugMode) console.debug(`File ${file.path} modified without prior typing or create event`);
      return;
    }
    const oldFileClass = this.fileClassMap.get(file.path) || '';
    const fileClass = this.metaFlowService.getFileClassFromMetadata(cache?.frontmatter) || '';
    this.fileClassMap.set(file.path, fileClass);
    if (fileClass === oldFileClass) {
      if (this.settings.debugMode) console.debug(`File class for ${file.path} did not change: ${oldFileClass}`);
      return;
    } else {
      console.info(`File class changed for ${file.path}: ${oldFileClass} -> ${fileClass}`);
      if (this.fileClassChangedCallback) {
        this.fileClassChangedCallback(file, cache, oldFileClass, fileClass);
      }
    }
  }

  private isManualEditEvent(vu: ViewUpdate): boolean {
    return vu.docChanged && vu.transactions.some(tr => {
      const event = tr.annotation && tr.annotation(Transaction.userEvent);
      return event && FileClassStateManager.manualEditEvents.some(e => event.includes(e));
    });
  }

  /**
   * When receiving an editor event, we update the last modified time for the file.
   * This is used to determine if the file has been modified manually recently.
   */
  public handleTypingEvent(vu: ViewUpdate) {
    if (!this.enabled) {
      if (this.settings.debugMode) console.debug('FileClassStateManager is disabled, skipping handleTypingEvent');
      return;
    }
    const file = this.app.workspace.getActiveFile()
    if (!(file instanceof TFile)) {
      return;
    }
    if (this.isManualEditEvent(vu)) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: manual edit detected`, vu.transactions);
      this.fileModifiedMap.set(file.path, true);
    }
  }

  public handleCreateFileEvent(file: TAbstractFile) {
    if (!this.enabled) {
      if (this.settings.debugMode) console.debug('FileClassStateManager is disabled, skipping handleCreateFileEvent');
      return;
    }
    if (this.settings.debugMode) console.debug(`FileClassStateManager: handleCreateFileEvent for ${file.path}`, file);
    if (!(file instanceof TFile)) {
      return;
    }
    if (this.fileRenamedMap.has(file.path)) {
      if (this.settings.debugMode) console.debug(`FileClassStateManager: handleCreateFileEvent ignored ${file.path} (renamed)`, file);
      return;
    }
    this.fileModifiedMap.set(file.path, true);
  }

  public handleModifyFileEvent(file: TAbstractFile) {
    if (!this.enabled) {
      if (this.settings.debugMode) console.debug('FileClassStateManager is disabled, skipping handleModifyFileEvent');
      return;
    }
    if (this.settings.debugMode) console.debug(`FileClassStateManager: handleModifyFileEvent for ${file.path}`, file);
    if (!(file instanceof TFile) || file.saving) {
      return;
    }
    if (!this.fileModifiedMap.get(file.path)) {
      if (this.settings.debugMode) console.debug(`File ${file.path} modified without prior typing or create event`);
      return;
    }
    const oldFileClass = this.fileClassMap.get(file.path) || '';
    const {fileClass, fileCache} = this.registerFileClass(file);
    if (this.fileClassChangedCallback) {
      this.fileClassChangedCallback(file, fileCache, oldFileClass, fileClass);
    }
  }

  public handleDeleteFileEvent(file: TAbstractFile) {
    if (!this.enabled) {
      if (this.settings.debugMode) console.debug('FileClassStateManager is disabled, skipping handleDeleteFileEvent');
      return;
    }
    if (this.settings.debugMode) console.debug(`FileClassStateManager: handleDeleteFileEvent for ${file.path}`, file);
    if (!(file instanceof TFile)) {
      return;
    }
    this.fileModifiedMap.delete(file.path);
    this.fileClassMap.delete(file.path);
    this.fileRenamedMap.delete(file.path);
  }

  public handleRenameFileEvent(file: TAbstractFile, oldPath: string) {
    if (!this.enabled) {
      if (this.settings.debugMode) console.debug('FileClassStateManager is disabled, skipping handleRenameFileEvent');
      return;
    }
    if (this.settings.debugMode) console.debug(`FileClassStateManager: handleRenameFileEvent for ${file.path}`, file, oldPath);
    if (!(file instanceof TFile)) {
      return;
    }
    this.fileRenamedMap.set(file.path, oldPath);
    if (!this.fileModifiedMap.has(oldPath)) {
      if (this.settings.debugMode) console.debug(`File ${oldPath} renamed without prior typing or create event`);
      return;
    } else {
      this.fileModifiedMap.delete(oldPath);
      this.fileModifiedMap.set(file.path, true);
    }
    if (!this.fileClassMap.has(oldPath)) {
      this.logManager.addWarning(`File class for ${oldPath} not found in fileClassMap`);
      return;
    }
    const oldFileClass = this.fileClassMap.get(oldPath) || '';
    this.fileClassMap.delete(oldPath);
    this.fileClassMap.set(file.path, oldFileClass);
  }
}
