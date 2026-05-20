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
      
      content = content.replace(/px-6 py-4/g, 'px-4 py-3 md:px-6 md:py-4');
      content = content.replace(/px-4 py-3 md:px-4 py-3 md:px-6 md:py-4/g, 'px-4 py-3 md:px-6 md:py-4');

      if (content !== fs.readFileSync(fullPath, 'utf8')) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed tables mobile layout in', fullPath);
      }
    }
  }
}

replaceInDir('src');
