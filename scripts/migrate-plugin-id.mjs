import fs from 'fs';
import path from 'path';

/**
 * One-shot migration of a vault from the legacy plugin id to the current one.
 *
 * The plugin id was renamed from "metaflow" to "metaflow-fchastanet" because an
 * unrelated community plugin registered the "metaflow" id, and Obsidian's updater
 * replaced this plugin's code with it.
 *
 * Usage (Obsidian must be closed):
 *   npm run migrate:plugin-id -- <vaultPath> [legacyId] [newId]
 *
 * Steps (idempotent):
 *   1. copy user data files (data.json, fileClassStateCache.json) to the new plugin folder
 *   2. replace legacy id by new id in .obsidian/community-plugins.json (enabled plugins)
 *   3. move the legacy plugin folder out of the plugins folder, as a timestamped backup
 */

const DATA_FILES = ['data.json', 'fileClassStateCache.json'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function copyDataFiles(legacyDir, newDir) {
  fs.mkdirSync(newDir, {recursive: true});
  for (const file of DATA_FILES) {
    const source = path.join(legacyDir, file);
    const destination = path.join(newDir, file);
    if (!fs.existsSync(source)) continue;
    if (fs.existsSync(destination)) {
      console.log(`Skipped ${file}: already present in ${newDir}`);
      continue;
    }
    fs.copyFileSync(source, destination);
    console.log(`Copied ${source} -> ${destination}`);
  }
}

function updateEnabledPlugins(configDir, legacyId, newId) {
  const communityPluginsFile = path.join(configDir, 'community-plugins.json');
  if (!fs.existsSync(communityPluginsFile)) {
    console.warn(`${communityPluginsFile} not found, enable the plugin manually in Obsidian`);
    return;
  }
  const enabledPlugins = readJson(communityPluginsFile);
  const wasEnabled = enabledPlugins.includes(legacyId) || enabledPlugins.includes(newId);
  const updated = enabledPlugins
    .map(id => id === legacyId ? newId : id)
    .filter((id, idx, ids) => ids.indexOf(id) === idx);
  if (!wasEnabled) {
    console.log(`${legacyId} was not enabled, ${newId} left disabled`);
  }
  fs.writeFileSync(communityPluginsFile, JSON.stringify(updated, null, 2));
  console.log(`Updated ${communityPluginsFile}`);
}

function backupLegacyDir(configDir, legacyDir, legacyId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(configDir, `${legacyId}-legacy-backup-${timestamp}`);
  fs.renameSync(legacyDir, backupDir);
  console.log(`Moved legacy plugin folder to ${backupDir} (delete it once everything works)`);
}

export function migratePluginId(vaultPath, legacyId = 'metaflow', newId = 'metaflow-fchastanet') {
  if (!vaultPath || !fs.existsSync(vaultPath)) {
    throw new Error(`Vault not found: ${vaultPath}`);
  }
  const configDir = path.join(vaultPath, '.obsidian');
  const legacyDir = path.join(configDir, 'plugins', legacyId);
  const newDir = path.join(configDir, 'plugins', newId);

  if (!fs.existsSync(legacyDir)) {
    console.log(`No legacy plugin folder ${legacyDir}, nothing to migrate`);
    return;
  }
  copyDataFiles(legacyDir, newDir);
  updateEnabledPlugins(configDir, legacyId, newId);
  backupLegacyDir(configDir, legacyDir, legacyId);
  console.log('Migration done. Deploy the plugin files into', newDir);
}

const [, , vaultPath, legacyId, newId] = process.argv;
try {
  migratePluginId(vaultPath, legacyId, newId);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
