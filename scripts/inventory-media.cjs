/* Read-only inventory of local media before an object-storage migration. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.cwd(), 'public/uploads');
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile()) {
      const stat = fs.statSync(absolute);
      files.push({ key: path.relative(root, absolute).split(path.sep).join('/'), bytes: stat.size });
    }
  }
}
walk(root);
console.log(JSON.stringify({ root, files, count: files.length, databaseReferences: 'Not queried (read-only filesystem inventory; use application exports to map DB URLs).' }, null, 2));
