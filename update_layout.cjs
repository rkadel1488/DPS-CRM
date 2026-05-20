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
      
      // Update padding/styles to be more airy
      content = content
        .replace(/bg-white p-6 rounded-\[1\.5rem\]/g, 'bg-white p-8 rounded-[2rem]')
        .replace(/bg-white p-6 rounded-\[1rem\]/g, 'bg-white p-8 rounded-[1.5rem]')
        .replace(/bg-white rounded-\[1\.5rem\]/g, 'bg-white rounded-[2rem]')
        .replace(/bg-white rounded-\[1rem\]/g, 'bg-white rounded-[1.5rem]')
        .replace(/shadow-md shadow-gray-200\/40/g, 'shadow-2xl shadow-gray-200/50')
        .replace(/shadow-sm/g, 'shadow-xl shadow-gray-200/50')
        // Enhance some headings
        .replace(/text-3xl font-bold/g, 'text-[2.25rem] font-extrabold tracking-tight')
        .replace(/text-2xl font-bold/g, 'text-2xl font-extrabold tracking-tight')
        .replace(/text-xl font-bold/g, 'text-[1.35rem] font-extrabold tracking-tight')
        // Modern borders
        .replace(/border-black\/5/g, 'border-[#E2E8F0]/60')
        .replace(/border-gray-200\/60/g, 'border-white/60')
        .replace(/border-gray-200/g, 'border-white/60')
        .replace(/border-gray-100/g, 'border-white/80')
        .replace(/divide-[#E2E8F0]/g, 'divide-gray-100/80')
        .replace(/divide-gray-200\/60/g, 'divide-gray-100/80');

      if (content !== fs.readFileSync(fullPath, 'utf8')) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated Layout for', fullPath);
      }
    }
  }
}

replaceInDir('src');
