const fs = require('fs');
const path = require('path');
const fileP = path.join(__dirname, 'src/app/admin/catalogos/[slug]/page.tsx');

let content = fs.readFileSync(fileP, 'utf8');

const replacement = `const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\\/api\\/?$/, '') + '/api/admin/catalogs' : (typeof window !== 'undefined' ? \`\${window.location.protocol}//\${window.location.hostname}:3001/api/admin/catalogs\` : 'http://localhost:3001/api/admin/catalogs');`;

content = content.replace(/const baseUrl = 'http:\/\/localhost:3001\/api\/admin\/catalogs';/, replacement);

fs.writeFileSync(fileP, content);
console.log("Fixed baseUrl in catalogos/[slug]/page.tsx");
