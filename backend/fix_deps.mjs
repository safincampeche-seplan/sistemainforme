import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, 'data-backup.json');
const sqlPath = path.join(__dirname, '..', 'captura_informe.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const localData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const depsById = Object.fromEntries(localData.dependencies.map(d => [d.id, d]));

// Build userDepMap: user_id -> cat_dep_id from entities table
// Row format: (entity_id, 'name', skip, skip, 'status', 'source', 'nota', skip, USER_ID, skip, skip, CAT_DEP_ID, CAT_DEP_ID2, created, updated)
const userDepMap = {};
const entityLines = sql.split('\n').filter(l => l.includes("INSERT INTO `entities` VALUES"));

for (const line of entityLines) {
  // Extract all numbers before timestamps using regex
  // The line has format: (..., number, number, number, number, 'YYYY-MM-DD...', 'YYYY-MM-DD...')
  // We want the group of numbers near the end right before the timestamp strings
  const tailMatch = line.match(/,\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'(\d{4}-\d{2}-\d{2})/);
  // Also extract user_id from position after the notes/source string
  // Simple approach: extract first number (entity_id) and numbers in known positions
  const allNums = [...line.matchAll(/(?<=\s|,|\()(\d+)(?=\s*,|\s*\))/g)].map(m => parseInt(m[1]));
  if (allNums.length >= 9 && tailMatch) {
    // user_id is 9th number (index 8), cat_dep_id is 12th (index 11)
    const userId = allNums[8];
    const catDepId = parseInt(tailMatch[2]); // second-last before timestamp
    if (!isNaN(userId) && !isNaN(catDepId) && depsById[catDepId]) {
      if (!userDepMap[userId]) userDepMap[userId] = catDepId; // first assignment wins
    }
  }
}

console.log(`📋 Found ${Object.keys(userDepMap).length} user-dep mappings from entities table.`);

let enriched = 0;
(localData.users || []).forEach(u => {
  if (userDepMap[u.id] && depsById[userDepMap[u.id]]) {
    u.dependency = depsById[userDepMap[u.id]].name;
    u.dependency_id = userDepMap[u.id];
    enriched++;
  }
});

fs.writeFileSync(dataPath, JSON.stringify(localData, null, 2));
console.log(`✅ Enriched ${enriched}/${(localData.users || []).length} users.`);

// Show distribution
const dist = {};
(localData.users || []).forEach(u => {
  const dep = u.dependency || 'Sin dependencia';
  dist[dep] = (dist[dep] || 0) + 1;
});
Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, v]) => console.log(`  ${v} × ${k}`));
