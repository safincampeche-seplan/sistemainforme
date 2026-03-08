const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../src');

const pattern1 = /const baseUrl = typeof window !== 'undefined' \? `\${window\.location\.protocol}\/\/\${window\.location\.hostname}:3001` : 'http:\/\/localhost:3001';/g;
const replacement1 = "const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\\/api\\/?$/, '') : (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');";

const pattern2 = /fetch\('http:\/\/localhost:3001\/api\//g;
const replacement2 = "fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/";

// Extra variant for multiline layout often found in Prettier formatted code
const pattern3 = /const baseUrl = typeof window !== 'undefined'\n\s*\? `\${window\.location\.protocol}\/\/\${window\.location\.hostname}:3001`\n\s*: 'http:\/\/localhost:3001';/g;

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(directoryPath);
let modifiedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    content = content.replace(pattern1, replacement1);
    content = content.replace(pattern3, replacement1);
    
    // For fetch('http://localhost:3001/api/...', we have to replace the closing quote carefully, 
    // it's easier to just assume they end with quotes, but the safest way is a regex that captures everything inside.
    content = content.replace(/fetch\(['"`]http:\/\/localhost:3001\/api\/(.+?)['"`]/g, "fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/$1`");

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
        modifiedCount++;
    }
});

console.log(`Done. Modified ${modifiedCount} files.`);
