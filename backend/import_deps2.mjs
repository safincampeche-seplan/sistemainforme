import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, 'data-backup.json');
const sqlPath = path.join(__dirname, '..', 'captura_informe.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const localData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Parse cat_dependencies
const deps = [];
const depLines = sql.split('\n').filter(l => l.includes("INSERT INTO `cat_dependencies`"));
for (const line of depLines) {
  const m = line.match(/VALUES\s*\((\d+),\s*'([^']+)',\s*'([^']+)'/);
  if (m) deps.push({ id: parseInt(m[1]), name: m[2], code: m[3] });
}
const depsById = Object.fromEntries(deps.map(d => [d.id, d]));

// Parse users: (id, name, last_name, second_lastname, profile_id, CAT_DEP_ID, ...)
// cols[0]=id, cols[1]=name, cols[2]=last_name, cols[3]=second_lastname, 
// cols[4]=profile_id, cols[5]=cat_dep_id, cols[6]=active, cols[7]=email
const userDepMap = {}; // userId -> cat_dep_id
const userLines = sql.split('\n').filter(l => l.includes("INSERT INTO `users` VALUES"));

for (const line of userLines) {
  // simple split on line (one INSERT per line)
  const afterValues = line.replace(/^INSERT INTO `users` VALUES /, '').replace(/;\s*$/, '');
  // tokenize respecting NULL and numbers
  const m = afterValues.match(/\((\d+),\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*(\d+|NULL),\s*(\d+|NULL)/);
  if (m) {
    const userId = parseInt(m[1]);
    const catDepId = parseInt(m[3]);
    if (!isNaN(userId) && !isNaN(catDepId)) userDepMap[userId] = catDepId;
  }
}

// Enrich users
let enriched = 0;
(localData.users || []).forEach(u => {
  const catDepId = userDepMap[u.id];
  if (catDepId && depsById[catDepId]) {
    u.dependency = depsById[catDepId].name;
    u.dependency_id = catDepId;
    enriched++;
  } else {
    // Clear wrong previous assignment
    u.dependency = null;
    u.dependency_id = null;
  }
});

localData.dependencies = deps;
fs.writeFileSync(dataPath, JSON.stringify(localData, null, 2));
console.log(`✅ ${deps.length} dependencias | ${enriched}/${localData.users.length} usuarios con dependencia real.`);
// Show sample
const sample = (localData.users || []).filter(u => u.dependency).slice(0, 5);
sample.forEach(u => console.log(`  ${u.name} → ${u.dependency}`));
