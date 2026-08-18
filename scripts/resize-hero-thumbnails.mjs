/**
 * resize-hero-thumbnails.mjs
 * Resize hero images used in circular gallery to max 400px to reduce lag.
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HERO_DIR = path.join(ROOT, 'public', 'Assets', 'landing2', 'hero');

async function main() {
  console.log(`🖼️  Resizing WebP images in ${HERO_DIR} for better performance...`);
  
  if (!fs.existsSync(HERO_DIR)) {
    console.error("Directory not found!");
    process.exit(1);
  }

  const files = fs.readdirSync(HERO_DIR).filter(f => f.endsWith('.webp'));
  let totalSaved = 0;

  for (const file of files) {
    const fullPath = path.join(HERO_DIR, file);
    const tempPath = path.join(HERO_DIR, file.replace('.webp', '_sm.webp'));
    
    const originalSize = fs.statSync(fullPath).size;

    try {
      await sharp(fullPath)
        .resize({ width: 400, height: 400, fit: 'inside' })
        .webp({ quality: 75 })
        .toFile(tempPath);

      const newSize = fs.statSync(tempPath).size;
      
      // We skip renaming, just keep the _sm.webp file
      // fs.renameSync(tempPath, fullPath);
      
      const saved = originalSize - newSize;
      totalSaved += saved;
      
      console.log(`✅ Resized ${file}: ${(originalSize/1024).toFixed(1)}KB -> ${(newSize/1024).toFixed(1)}KB`);
    } catch (err) {
      console.error(`❌ Error processing ${file}: ${err.message}`);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  console.log(`\n🎉 Done! Saved a total of ${(totalSaved/1024/1024).toFixed(2)} MB!`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
