import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, 'data-backup.json');
const sqlPath = path.join(__dirname, '..', 'captura_informe.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const localData = JSON.parse(fs.readFileSync(dataPath,'utf8'));

// Parse cat_dependencies: VALUES (id, name, short_name, ...)
const deps = [];
const lines = sql.split('\n').filter(l => l.includes("INSERT INTO `cat_dependencies`"));
for (const line of lines) {
  const m = line.match(/VALUES\s*\((\d+),\s*'([^']+)',\s*'([^']+)'/);
  if (m) deps.push({ id: parseInt(m[1]), name: m[2], code: m[3] });
}

// Parse model_has_roles to get user->role and user->profile(dependency)
// Also parse users to get profile_id 
const profileMap = {}; // userId -> profile_id (dependency)
const userLines = sql.split('\n').filter(l => l.includes("INSERT INTO `users`"));
for (const line of userLines) {
  const rows = line.replace("INSERT INTO `users` VALUES ", "").replace(/;\s*$/,"").split("),(").map(r=>r.replace(/^\(|\)$/g,''));
  for (const row of rows) {
    const cols = row.match(/([^,]+)/g) || [];
    if (cols.length >= 8) {
      const id = parseInt(cols[0]);
      const profileId = parseInt(cols[7]); // profile_id column (8th)
      if (!isNaN(id) && !isNaN(profileId)) profileMap[id] = profileId;
    }
  }
}

// Look up dep name by profileId (profile_id usually maps to dependency id)
const depsById = Object.fromEntries(deps.map(d => [d.id, d]));

// Enrich users with dependency name  
let enriched = 0;
(localData.users || []).forEach(u => {
  if (!u.dependency) {
    const profId = profileMap[u.id];
    const dep = depsById[profId] || depsById[u.dependency_id];
    if (dep) {
      u.dependency = dep.name;
      u.dependency_id = dep.id;
      enriched++;
    }
  }
});

localData.dependencies = deps;
fs.writeFileSync(dataPath, JSON.stringify(localData, null, 2));
console.log(`✅ ${deps.length} dependencias importadas. ${enriched} usuarios enriquecidos con su dependencia real.`);
