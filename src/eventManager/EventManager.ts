import {CachedMetadata, MarkdownView, TAbstractFile, TFile, WorkspaceLeaf} from "obsidian";
import type {MetaFlowSettings} from "src/settings/types";
import {FileFilter} from "./FileFilter";
import {FileStateCache} from "./cache/FileStateCache";
import {TYPES} from "@metaflow/di/types";
import {inject} from "inversify";
import {Utils} from "@metaflow/utils/Utils";

export interface EventManagerInterface {
  handleActiveLeafChange(leaf: WorkspaceLeaf | null): void;
  handleMetadataChanged(file: TFile, data: string, cache: CachedMetadata): void;
  handleCreateFileEvent(file: TAbstractFile): void;
  handleModifyFileEvent(file: TAbstractFile): void;
  handleDeleteFileEvent(file: TAbstractFile): void;
  handleRenameFileEvent(file: TAbstractFile, oldPath: string): void;
}

export default class EventManager implements EventManagerInterface {
  constructor(
    @inject(TYPES.MetaFlowSettings) private settings: MetaFlowSettings,
    @inject(TYPES.FileFilter) private filter: FileFilter,
    @inject(TYPES.FileStateCache) private fileStateCache: FileStateCache,
  ) {
  }

  public async init() {
    if (this.settings.debugMode) console.debug('FileClassStateManager: init - initializing file state cache');
    await this.fileStateCache.loadCache();
  }

  public handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
    if (!(leaf?.view instanceof MarkdownView)) return;
    const file = leaf.view.file;
    if (!this.filter.isApplicable(file)) return;

    if (this.settings.debugMode) console.debug('FileClassStateManager: handleActiveLeafChange', {stack: Utils.stackTrace().stack, leaf, file});
    this.fileStateCache.updateState(file.path, {
      fileMtime: file.stat.mtime,
    });
  }

  public handleMetadataChanged(file: TFile, data: string, cache: CachedMetadata): void {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleMetadataChanged', {stack: Utils.stackTrace().stack, file, data, cache});
    this.fileStateCache.updateState(file.path, {
      fileMtime: file.stat.mtime,
    });
  }

  public handleCreateFileEvent(file: TAbstractFile) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleCreateFileEvent', {stack: Utils.stackTrace().stack, file});
    this.fileStateCache.updateState(file.path, {
      fileMtime: file.stat.mtime,
    });
  }

  public handleModifyFileEvent(file: TAbstractFile) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleModifyFileEvent', {stack: Utils.stackTrace().stack, file});
    this.fileStateCache.updateState(file.path, {
      fileMtime: file.stat.mtime,
    });
  }

  public handleDeleteFileEvent(file: TAbstractFile) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleDeleteFileEvent', {stack: Utils.stackTrace().stack, file});
    this.fileStateCache.popState(file.path);
  }

  public handleRenameFileEvent(file: TAbstractFile, oldPath: string) {
    if (!this.filter.isApplicable(file)) return;
    if (this.settings.debugMode) console.debug('FileClassStateManager: handleRenameFileEvent', {stack: Utils.stackTrace().stack, file, oldPath});

    this.fileStateCache.renameState(oldPath, file.path);
    this.fileStateCache.updateState(file.path, {
      fileMtime: file.stat.mtime,
    });
  }

}
