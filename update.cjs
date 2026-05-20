const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let newContent = content
        .replace(/rounded-3xl/g, 'rounded-[1.5rem]')
        .replace(/rounded-2xl/g, 'rounded-[1rem]')
        .replace(/shadow-sm/g, 'shadow-md shadow-gray-200/40')
        .replace(/shadow-xl/g, 'shadow-xl shadow-gray-200/60')
        .replace(/bg-gray-50/g, 'bg-[#F1F5F9]');
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log('Updated', fullPath);
      }
    }
  }
}

replaceInDir('src');
