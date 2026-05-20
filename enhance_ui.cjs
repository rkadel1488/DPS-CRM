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
      
      // Buttons
      content = content.replace(/bg-emerald-600/g, 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none');
      content = content.replace(/hover:bg-emerald-700/g, 'hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl hover:-translate-y-0.5');
      
      content = content.replace(/bg-blue-600/g, 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/20 border-none');
      content = content.replace(/hover:bg-blue-700/g, 'hover:from-blue-600 hover:to-indigo-600 hover:shadow-xl hover:-translate-y-0.5');

      content = content.replace(/bg-gray-900/g, 'bg-gradient-to-r from-slate-700 to-slate-900 shadow-lg shadow-slate-900/20 text-white border-none');
      content = content.replace(/hover:bg-gray-800/g, 'hover:from-slate-800 hover:to-slate-950 hover:shadow-xl hover:-translate-y-0.5');

      content = content.replace(/bg-indigo-600/g, 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/20 border-none');
      content = content.replace(/hover:bg-indigo-700/g, 'hover:from-indigo-600 hover:to-violet-600 hover:shadow-xl hover:-translate-y-0.5');
      
      // Inputs
      content = content.replace(/bg-gray-50/g, 'bg-white/60 backdrop-blur-md');
      content = content.replace(/bg-\[\#F1F5F9\]/g, 'bg-white/60 backdrop-blur-md');
      
      // Tables & Borders
      content = content.replace(/divide-black\/5/g, 'divide-gray-100/60');
      content = content.replace(/border-black\/5/g, 'border-gray-100/60');
      
      // Table Headers
      content = content.replace(/bg-gray-50 text-gray-400/g, 'bg-white/40 text-gray-500 backdrop-blur-md border-b border-gray-100/60');
      
      // Tr Hovers
      content = content.replace(/hover:bg-gray-50/g, 'hover:bg-white/60');

      if (content !== fs.readFileSync(fullPath, 'utf8')) {
        fs.writeFileSync(fullPath, content);
        console.log('Enhanced UI for', fullPath);
      }
    }
  }
}

replaceInDir('src');
