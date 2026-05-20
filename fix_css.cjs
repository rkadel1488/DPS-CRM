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
      
      content = content.replace(/bg-white\/70 backdrop-blur-xl\/10 backdrop-blur-md/g, 'bg-white/10 backdrop-blur-md');
      content = content.replace(/bg-white\/70 backdrop-blur-xl\/70 backdrop-blur-3xl/g, 'bg-white/70 backdrop-blur-3xl');
      content = content.replace(/bg-white\/70 backdrop-blur-xl\/70 backdrop-blur-xl/g, 'bg-white/70 backdrop-blur-xl');
      content = content.replace(/bg-white\/70 backdrop-blur-xl\/50/g, 'bg-white/50');
      // more fixes for weird artifacts
      content = content.replace(/shadow-xl shadow-gray-200\/60/g, 'shadow-2xl shadow-gray-200/40');
      content = content.replace(/shadow-lg shadow-gray-200/g, 'shadow-xl shadow-gray-200/40');

      if (content !== fs.readFileSync(fullPath, 'utf8')) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed CSS in', fullPath);
      }
    }
  }
}

replaceInDir('src');
