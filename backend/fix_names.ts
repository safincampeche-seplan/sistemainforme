import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, '..', 'captura_informe.sql'), 'utf8');
const localData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data-backup.json'), 'utf8'));

// Build corrected map: user_id → { fullname, email }
// SQL format: (id, 'first_name', 'last_name', 'second_lastname', profile_id, cat_dep, active, 'email', ...)
const correctMap: Record<number, { fullName: string; email: string }> = {};
const userLines = sql.split('\n').filter(l => l.includes("INSERT INTO `users` VALUES"));

for (const line of userLines) {
    // Use a robust multi-step parse approach
    // Remove prefix and trailing semicolon
    const valuesPart = line.replace(/^INSERT INTO `users` VALUES /, '').replace(/;\s*$/, '');
    // Remove outer parens
    const inner = valuesPart.replace(/^\(|\)$/g, '');

    // Parse respecting quoted fields
    const cols: string[] = [];
    let inQuote = false, field = '';
    for (const ch of inner) {
        if (ch === "'") { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { cols.push(field.trim()); field = ''; }
        else { field += ch; }
    }
    cols.push(field.trim());

    if (cols.length >= 8) {
        const id = parseInt(cols[0] ?? '');
        const firstName = (cols[1] ?? '').trim();
        const lastName = (cols[2] ?? '').trim();
        const secondLastName = (cols[3] ?? '').trim();
        const email = (cols[7] ?? '').trim();

        if (!isNaN(id)) {
            correctMap[id] = {
                fullName: [firstName, lastName, secondLastName].filter(Boolean).join(' ').trim(),
                email
            };
        }
    }
}

let fixed = 0;
(localData.users || []).forEach((u: any) => {
    const correct = correctMap[u.id];
    if (correct) {
        if (correct.fullName) u.name = correct.fullName;
        if (correct.email) u.email = correct.email;
        fixed++;
    }
});

fs.writeFileSync(path.join(__dirname, 'data-backup.json'), JSON.stringify(localData, null, 2));
console.log(`✅ Fixed ${fixed} users.`);
(localData.users || []).slice(0, 5).forEach((u: any) => console.log(`  [${u.id}] ${u.name} | ${u.email}`));
