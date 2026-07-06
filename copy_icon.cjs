const fs = require('fs');
const path = require('path');

const srcIcon = 'C:\\Users\\TEST\\.gemini\\antigravity-cli\\brain\\7200069c-2a22-4ec5-ac51-ec8a5ed9a65d\\esg_app_icon_1783349901848.jpg';
const dest512 = path.resolve(__dirname, './public/icon-512.jpg');
const dest192 = path.resolve(__dirname, './public/icon-192.jpg');

function main() {
  if (!fs.existsSync(srcIcon)) {
    console.error(`Source icon not found at: ${srcIcon}`);
    process.exit(1);
  }

  // Create public dir if it doesn't exist
  const publicDir = path.dirname(dest512);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.copyFileSync(srcIcon, dest512);
  fs.copyFileSync(srcIcon, dest192);
  console.log('PWA application icons (icon-192.jpg, icon-512.jpg) copied successfully!');
}

main();
