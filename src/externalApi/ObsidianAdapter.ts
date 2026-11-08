import {injectable, inject} from 'inversify';
import type {App, CachedMetadata, FrontMatterCache, PluginManifest} from 'obsidian';
import {FileStats, getFrontMatterInfo, normalizePath, Notice, parseYaml, TAbstractFile, TExternalFile, TFile, TFolder, Vault} from 'obsidian';
import type {MetaFlowSettings} from '@metaflow/settings/types';
import {TYPES} from '@metaflow/di/types';

@injectable()
export class ObsidianAdapter {
  private app: App;
  private settings: MetaFlowSettings;
  private manifest: PluginManifest;

  constructor(
    @inject(TYPES.App) app: App,
    @inject(TYPES.MetaFlowSettings) settings: MetaFlowSettings,
    @inject(TYPES.PluginManifest) manifest: PluginManifest
  ) {
    this.app = app;
    this.settings = settings;
    this.manifest = manifest;
  }

  /**
   * Directory of this plugin, derived from its manifest (never hardcode the plugin id)
   */
  getPluginDirectory(): string {
    return this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
  }

  /**
   * Check that the given object is a file stored inside the vault.
   * Since Obsidian 1.14.4, files opened from outside the vault are exposed as
   * `TExternalFile`, a subclass of `TFile`, so `instanceof TFile` alone is not enough.
   */
  isVaultFile(file: unknown): file is TFile {
    return file instanceof TFile && !(file instanceof TExternalFile);
  }

  /**
   * Check that the given object is a markdown file stored inside the vault.
   */
  isVaultMarkdownFile(file: unknown): file is TFile {
    return this.isVaultFile(file) && file.extension === 'md';
  }

  /**
   * Generate a markdown link to a file
   */
  generateMarkdownLink(targetFile: TFile | null, sourceFile?: TFile | null): string {
    const sourcePath = sourceFile ? sourceFile.path : '';
    if (!targetFile) {
      return '';
    }
    return this.app.fileManager.generateMarkdownLink(targetFile, sourcePath);
  }

  async moveNote(file: TFile, newPath: string): Promise<void> {
    if (this.settings.debugMode) console.info(`Moving note ${file.path} to ${newPath}`);
    if (file.path === newPath) {
      if (this.settings.debugMode) console.info(`Note ${file.path} is already at ${newPath}`);
      return;
    }
    return await this.app.fileManager.renameFile(file, newPath);
  }

  async renameNote(file: TFile, newName: string): Promise<TFile> {
    const newPath = file.parent ? `${file.parent.path}/${newName}` : newName;
    if (this.settings.debugMode) console.info(`Renaming note ${file.path} to ${newPath}`);
    await this.app.fileManager.renameFile(file, newPath);
    // Return the renamed file
    const renamedFile = this.app.vault.getAbstractFileByPath(newPath);
    if (this.isVaultFile(renamedFile)) {
      return renamedFile;
    }
    throw new Error(`Failed to get renamed file at ${newPath}`);
  }

  isFileExists(filePath: string): boolean {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    return this.isVaultFile(file);
  }

  isFolderExists(filePath: string): boolean {
    const folder = this.app.vault.getAbstractFileByPath(filePath);
    return !!folder && folder instanceof TFolder;
  }

  async createFolder(folderPath: string): Promise<TFolder> {
    return await this.app.vault.createFolder(folderPath);
  }

  getAbstractFileByPath(filePath: string): TAbstractFile | null {
    return this.app.vault.getAbstractFileByPath(filePath);
  }

  normalizePath(filePath: string): string {
    const sanitized = normalizePath(filePath);
    // Limit length to reasonable size (Obsidian has filesystem limits)
    return sanitized.substring(0, 255);
  }

  getCachedFile(file: TFile): CachedMetadata | null {
    return this.app.metadataCache.getFileCache(file);
  }

  async getFileFrontmatter(file: TFile): Promise<FrontMatterCache | null> {
    const fileContent = await this.app.vault.read(file);
    const frontMatterInfo = getFrontMatterInfo(fileContent);
    const yamlFrontmatter = parseYaml(frontMatterInfo.frontmatter);
    return yamlFrontmatter as FrontMatterCache;
  }

  folderPrefix(filePath: string): string {
    const normalizedPath = normalizePath(filePath);
    // remove first slash as first character if any
    const folderPath = normalizedPath.replace(/^\//, '');
    return folderPath + '/';
  }

  /**
   * Create a notice in Obsidian
   * @param message {string} The message to display in the notice
   * @param duration {number} Time in milliseconds to show the notice for.
   * If this is 0, the notice will stay visible until the user manually dismisses it.
   * @returns {Notice} The created notice instance
   */
  notice(message: string, duration: number): Notice {
    return new Notice(message, duration);
  }

  static createMockTFile(path: string): TFile {
    const file = {
      path,
      name: path.split('/').pop() || path,
      stat: {} as FileStats,
      basename: path.split('/').pop() || path,
      extension: 'md',
      vault: {} as Vault,
      parent: {} as TFolder,
    };
    Object.setPrototypeOf(file, TFile.prototype);
    // Ensure the returned object is actually a TFile instance
    if (file instanceof TFile) {
      return file;
    }
    throw new Error('Failed to create a mock TFile');
  }

  /**
   * Save data to a file in the plugin directory
   * @param fileName The name of the file to save
   * @param data The data to save (will be JSON stringified)
   */
  async saveToPluginDirectory(fileName: string, data: unknown): Promise<void> {
    try {
      const pluginDir = this.getPluginDirectory();
      const filePath = normalizePath(`${pluginDir}/${fileName}`);
      const jsonData = JSON.stringify(data, null, 2);

      // Ensure the plugin directory exists
      await this.app.vault.adapter.mkdir(pluginDir);

      // Write the file
      await this.app.vault.adapter.write(filePath, jsonData);
    } catch (error) {
      console.error(`ObsidianAdapter: Failed to save ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Load data from a file in the plugin directory
   * @param fileName The name of the file to load
   * @returns The parsed JSON data or null if file doesn't exist
   */
  async loadFromPluginDirectory(fileName: string): Promise<unknown | null> {
    try {
      const filePath = normalizePath(`${this.getPluginDirectory()}/${fileName}`);

      const jsonData = await this.app.vault.adapter.read(filePath);
      return JSON.parse(jsonData);
    } catch (error) {
      if (typeof error.message === 'string' && (error.message.includes('ENOENT') || error.message.includes('does not exist'))) {
        // File doesn't exist, return null
        return null;
      }
      console.error(`ObsidianAdapter: Failed to load ${fileName}:`, error);
      throw error;
    }
  }

}
