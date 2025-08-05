import fs from 'fs';
import path from 'path';

/**
 * Reads the sync configuration from sync.config.json
 */
function readSyncConfig() {
  try {
    const configPath = path.join(process.cwd(), 'sync.config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.log('No sync.config.json found or invalid JSON. Skipping sync.');
    return null;
  }
}

/**
 * Ensures the target directory exists
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, {recursive: true});
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Copies a file from source to destination
 */
function copyFile(source, destination) {
  try {
    fs.copyFileSync(source, destination);
    console.log(`Synced: ${source} -> ${destination}`);
    return true;
  } catch (error) {
    console.error(`Failed to sync ${source}: ${error.message}`);
    return false;
  }
}

/**
 * Syncs files to the configured folder
 */
export function syncFiles() {
  const config = readSyncConfig();

  if (!config || !config.syncEnabled) {
    console.log('Sync disabled or no config found. Skipping sync.');
    return;
  }

  if (!config.syncPath) {
    console.error('Sync path not configured. Please set syncPath in sync.config.json');
    return;
  }

  console.log(`Starting sync to: ${config.syncPath}`);

  // Ensure the sync directory exists
  ensureDirectoryExists(config.syncPath);

  let syncedCount = 0;
  let totalFiles = config.filesToSync.length;

  // Sync each configured file
  for (const file of config.filesToSync) {
    const sourcePath = path.join(process.cwd(), file.src);
    const destinationPath = path.join(config.syncPath, file.dest);

    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      console.warn(`Source file not found: ${sourcePath}`);
      continue;
    }

    if (copyFile(sourcePath, destinationPath)) {
      syncedCount++;
    }
  }

  console.log(`Sync completed: ${syncedCount}/${totalFiles} files synced successfully.`);
}

/**
 * Watches for file changes and syncs automatically
 */
export function watchAndSync() {
  const config = readSyncConfig();

  if (!config || !config.syncEnabled) {
    return;
  }

  console.log('Setting up file watcher for auto-sync...');

  for (const file of config.filesToSync) {
    const filePath = path.join(process.cwd(), file.src);

    // Only watch files that exist
    if (fs.existsSync(filePath)) {
      fs.watchFile(filePath, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log(`File changed: ${file.src}`);
          const destinationPath = path.join(config.syncPath, file.dest);
          copyFile(filePath, destinationPath);
        }
      });
    }
  }
}
