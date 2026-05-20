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
      
      // Update backgrounds and buttons across UI panels to use glassmorphism
      content = content
        .replace(/className="bg-white/g, 'className="bg-white/70 backdrop-blur-xl')
        .replace(/className={`bg-white/g, 'className={`bg-white/70 backdrop-blur-xl')
        .replace(/bg-white p-8 rounded-\[2rem\] border border-white\/60 shadow-2xl shadow-gray-200\/50/g, 'bg-white/70 backdrop-blur-xl p-8 rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]')
        .replace(/bg-white rounded-\[2rem\] border border-white\/60 shadow-2xl shadow-gray-200\/50/g, 'bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]')
        .replace(/bg-white p-8 rounded-\[1\.5rem\] border border-white\/60 shadow-xl shadow-gray-200\/50/g, 'bg-white/70 backdrop-blur-xl p-8 rounded-[1.5rem] border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]')
        .replace(/bg-[#F1F5F9]/g, 'bg-white/50')
        .replace(/bg-gray-50/g, 'bg-white/50');
      
      // Fix double declarations if any
      content = content.replace(/bg-white\/70 backdrop-blur-xl\/70 backdrop-blur-2xl/g, 'bg-white/70 backdrop-blur-2xl');
      content = content.replace(/bg-white\/70 backdrop-blur-xl\/70 backdrop-blur-xl/g, 'bg-white/70 backdrop-blur-xl');

      if (content !== fs.readFileSync(fullPath, 'utf8')) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated Panels Layout for', fullPath);
      }
    }
  }
}

replaceInDir('src');
