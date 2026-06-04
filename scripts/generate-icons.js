#!/usr/bin/env node

/**
 * Generate PWA icons using Sharp
 * Install with: npm install --save-dev sharp
 * Run with: node scripts/generate-icons.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

/**
 * Create a simple SVG and convert to PNG using Sharp
 */
async function generateIconsWithSharp() {
  try {
    const sharp = (await import('sharp')).default;
    
    const sizes = [96, 192, 512];
    const svgContent = fs.readFileSync(path.join(publicDir, 'icon.svg'), 'utf-8');
    
    for (const size of sizes) {
      // Regular icon
      await sharp(Buffer.from(svgContent))
        .resize(size, size)
        .png()
        .toFile(path.join(publicDir, `icon-${size}x${size}.png`));
      
      console.log(`✓ Generated icon-${size}x${size}.png`);
      
      // Maskable icon (same as regular for this design)
      await sharp(Buffer.from(svgContent))
        .resize(size, size)
        .png()
        .toFile(path.join(publicDir, `icon-${size}x${size}-maskable.png`));
      
      console.log(`✓ Generated icon-${size}x${size}-maskable.png`);
    }
    
    return true;
  } catch (err) {
    console.error('Sharp generation failed:', err.message);
    return false;
  }
}

/**
 * Fallback: create minimal PNG placeholder
 */
function createFallbackPNG() {
  // Minimal 1x1 white PNG
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xff, 0xff, 0x3f,
    0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82
  ]);
  
  const sizes = [96, 192, 512];
  for (const size of sizes) {
    fs.writeFileSync(path.join(publicDir, `icon-${size}x${size}.png`), png);
    fs.writeFileSync(path.join(publicDir, `icon-${size}x${size}-maskable.png`), png);
  }
  
  console.log('✓ Created placeholder PNG icons (1x1)');
}

async function main() {
  console.log('Generating PWA icons...\n');
  
  // Check if SVG exists
  const svgPath = path.join(publicDir, 'icon.svg');
  if (!fs.existsSync(svgPath)) {
    console.error('Error: icon.svg not found in public/');
    process.exit(1);
  }
  
  // Try Sharp first, fall back to placeholder
  const success = await generateIconsWithSharp();
  
  if (!success) {
    console.log('\nUsing fallback placeholder PNG icons...');
    createFallbackPNG();
  }
  
  console.log('\n✅ Icon generation complete!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

