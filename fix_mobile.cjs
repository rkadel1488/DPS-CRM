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
      
      // Make padding and border radius responsive
      content = content.replace(/p-8/g, 'p-5 md:p-8');
      content = content.replace(/rounded-\[2rem\]/g, 'rounded-3xl md:rounded-[2rem]');
      content = content.replace(/rounded-\[1\.5rem\]/g, 'rounded-2xl md:rounded-[1.5rem]');
      
      // Reduce header height on mobile in App.tsx
      content = content.replace(/h-24/g, 'h-16 md:h-24');
      
      // Fix double replacements if happened
      content = content.replace(/p-5 md:p-5 md:p-8/g, 'p-5 md:p-8');
      content = content.replace(/rounded-3xl md:rounded-3xl md:rounded-\[2rem\]/g, 'rounded-3xl md:rounded-[2rem]');
      content = content.replace(/rounded-2xl md:rounded-2xl md:rounded-\[1\.5rem\]/g, 'rounded-2xl md:rounded-[1.5rem]');

      if (content !== fs.readFileSync(fullPath, 'utf8')) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed mobile layout in', fullPath);
      }
    }
  }
}

replaceInDir('src');
