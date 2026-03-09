import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, '..', 'captura_informe.sql'), 'utf8');
const dataPath = path.join(__dirname, 'data-backup.json');
const localData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
// Build user map: id → { name, email }
const userMap = {};
(localData.users || []).forEach((u) => { userMap[u.id] = { name: u.name, email: u.email }; });
// Map action types from Laravel to our system types
const typeMap = {
    'Created': 'create', 'Updated': 'update', 'Deleted': 'delete',
    'Login': 'login', 'Logout': 'logout', 'Export': 'export',
    'Resource': 'resource', 'Access': 'access'
};
// Parse activity_log lines: (id, log_name, description, subject_type, event, subject_id, causer_type, causer_id, properties, updated_by, created_at, updated_at)
const logs = [];
let id = 1;
const activityLines = sql.split('\n').filter(l => l.includes("INSERT INTO `activity_log`"));
// Take last 500 for performance and relevance
const relevantLines = activityLines.slice(-500);
for (const line of relevantLines) {
    try {
        // Extract key fields with regex
        const mBasic = line.match(/VALUES \((\d+), '([^']*)', '([^']*)', (?:'([^']*)'|NULL), '([^']*)', (\d+|NULL)/);
        const mCauser = line.match(/, '?App\\\\Models\\\\User'?, (\d+|NULL), /);
        const mTimestamp = line.match(/, '(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', '(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'\);\s*$/);
        if (!mBasic)
            continue;
        const logName = mBasic[2] || 'Sistema';
        const description = mBasic[3] || 'Acción registrada';
        const subjectType = mBasic[4] || '';
        const event = mBasic[5] || 'event';
        const causerId = mCauser ? parseInt(mCauser[1]) : null;
        const timestamp = mTimestamp ? mTimestamp[1] : '2025-03-05 21:00:00';
        // Determine action type
        let actionType = 'system';
        if (description.toLowerCase().includes('login'))
            actionType = 'login';
        else if (description.toLowerCase().includes('logout'))
            actionType = 'logout';
        else if (description.toLowerCase().includes('export') || description.toLowerCase().includes('word') || description.toLowerCase().includes('excel'))
            actionType = 'export';
        else if (event === 'Created')
            actionType = 'create';
        else if (event === 'Updated')
            actionType = 'update';
        else if (event === 'Deleted')
            actionType = 'delete';
        else if (logName === 'Access')
            actionType = 'access';
        const causer = causerId && userMap[causerId] ? userMap[causerId] : { name: 'Sistema', email: 'sistema@seplan' };
        logs.push({
            id: id++,
            user_name: causer.name,
            user_email: causer.email,
            action: description,
            type: actionType,
            detail: `[${logName}] ${subjectType.replace('App\\Models\\', '')} → ${event}`,
            timestamp: new Date(timestamp).toISOString(),
            dependency: ''
        });
    }
    catch (e) {
        // skip malformed lines
    }
}
localData.logs = logs;
fs.writeFileSync(dataPath, JSON.stringify(localData, null, 2));
console.log(`✅ Importados ${logs.length} registros de actividad histórica como logs de bitácora.`);
console.log(`Tipos de eventos:`, [...new Set(logs.map((l) => l.type))]);
//# sourceMappingURL=seed_logs.js.map