import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.join(__dirname, 'users_dump.txt');
const dataPath = path.join(__dirname, 'data-backup.json');

async function importUsers() {
    if (!fs.existsSync(sqlPath)) {
        console.error("No users_dump.txt found.");
        return;
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    const localData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // Add default users array if missing
    if (!localData.users) localData.users = [];

    const lines = sqlContent.split('\n');
    let importedCount = 0;

    for (const line of lines) {
        if (!line.includes('INSERT INTO `users` VALUES ')) continue;

        // Remove prefix and suffix
        const valuesStr = line.replace('INSERT INTO `users` VALUES ', '').replace(';', '');
        // Split by "),(" to get individual rows
        const rows = valuesStr.split('),(').map(r => r.replace(/^\(|\)$/g, ''));

        for (const row of rows) {
            // Split safely by comma respecting quotes
            const cols = row.match(/({".*?"|'.*?'|[^,]+)(?=\s*,|\s*$)/g) || [];
            if (cols.length >= 6) {
                const idStr = cols[0];
                const name = cols[1].replace(/'/g, '');
                const email = cols[2].replace(/'/g, '');

                // Skip already existing
                if (localData.users.find((u: any) => u.email === email)) continue;

                const hashedPassword = await bcrypt.hash('seplan123', 10);

                // Decide role simply
                let role = 'Capturista';
                if (email.includes('super') || name.toLowerCase().includes('admin')) role = 'SuperAdministrador';
                else if (name.toLowerCase().includes('validador')) role = 'Validador';

                localData.users.push({
                    id: parseInt(idStr) || Date.now() + importedCount,
                    name: name,
                    email: email,
                    password: hashedPassword,
                    roles: [role],
                    dependency_id: 1, // Default dependency, admins will assign exactly later if needed
                    status: 'Activo'
                });
                importedCount++;
            }
        }
    }

    fs.writeFileSync(dataPath, JSON.stringify(localData, null, 2));
    console.log(`✅ Importación completada. Se importaron ${importedCount} usuarios desde el SQL Original. Todos tienen la contraseña por defecto: seplan123`);
}

importUsers();
