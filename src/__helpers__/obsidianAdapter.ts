import {TFile} from 'obsidian';

/**
 * Vault file guards for ObsidianAdapter mocks.
 * Uses the (possibly mocked) `TFile` of the current test module registry,
 * mirroring ObsidianAdapter.isVaultFile / isVaultMarkdownFile.
 */
export const vaultFileGuards = {
  isVaultFile: (file: unknown): file is TFile => file instanceof TFile,
  isVaultMarkdownFile: (file: unknown): file is TFile => file instanceof TFile && file.extension === 'md',
};

/**
 * Plugin manifest used to build ObsidianAdapter instances in tests
 */
export const testPluginManifest = {
  id: 'metaflow-fchastanet',
  name: 'MetaFlow',
  version: '1.0.0',
  minAppVersion: '1.15.0',
  description: 'test',
  author: 'test',
};
