const fs = require('fs');
const path = require('path');

// Source directory for asset files
const assetsSourceDir = path.join(__dirname, '..', 'assets');

// Destination directory
const distDir = path.join(__dirname, '..', 'dist');

// File extensions to copy (add more as needed)
const ASSET_EXTENSIONS = ['.py', '.json', '.html', '.css', '.svg', '.png', '.jpg', '.jpeg', '.gif'];

/**
 * Recursively copy asset files from source to destination
 * @param {string} sourceDir - Source directory
 * @param {string} destDir - Destination directory
 */
function copyAssetFiles(sourceDir, destDir) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Read all files and directories in the source directory
  const items = fs.readdirSync(sourceDir);

  for (const item of items) {
    const sourcePath = path.join(sourceDir, item);
    const destPath = path.join(destDir, item);
    
    // Check if it's a directory
    if (fs.statSync(sourcePath).isDirectory()) {
      // Recursively copy files from subdirectory
      copyAssetFiles(sourcePath, destPath);
    } 
    // Copy asset files with supported extensions
    else {
      const ext = path.extname(item).toLowerCase();
      if (ASSET_EXTENSIONS.includes(ext)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`Copied: ${sourcePath} -> ${destPath}`);
      }
    }
  }
}

try {
  // Start copying asset files
  copyAssetFiles(assetsSourceDir, path.join(distDir, 'assets'));
  console.log('Successfully copied all asset files');
} catch (err) {
  console.error(`Error copying asset files: ${err.message}`);
  process.exit(1);
} 