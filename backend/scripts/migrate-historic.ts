import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

async function migrate() {
    console.log('--- Iniciando Migración de Datos Históricos 2025 ---');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const sqlPath = path.resolve(__dirname, '../../captura_informe.sql');
    const outputPath = path.resolve(__dirname, '../data-historic-2025.json');

    console.log(`Buscando SQL en: ${sqlPath}`);
    if (!fs.existsSync(sqlPath)) {
        console.error('Error: No se encontró captura_informe.sql');
        return;
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    const result: any = {
        users: [],
        dependencies: [],
        entities: [],
        properties: [],
        entries: [],
        missions: [],
        narratives: [],
        activities: []
    };

    // Función auxiliar para extraer INSERTs de una tabla específica
    const extractInserts = (tableName: string) => {
        const regex = new RegExp(`INSERT INTO \`${tableName}\` VALUES \\((.*?)\\);`, 'g');
        const matches = [];
        let match;
        while ((match = regex.exec(sqlContent)) !== null) {
            matches.push(match[1]);
        }
        return matches;
    };

    const parseValues = (valStr: string) => {
        const parts = [];
        let current = '';
        let inString = false;
        for (let i = 0; i < valStr.length; i++) {
            const char = valStr[i];
            if (char === "'" && (i === 0 || valStr[i - 1] !== '\\')) {
                inString = !inString;
            } else if (char === ',' && !inString) {
                parts.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current.trim());
        return parts.map(p => {
            if (p === 'NULL') return null;
            if (p.startsWith("'") && p.endsWith("'")) return p.slice(1, -1).replace(/\\'/g, "'");
            return p;
        });
    };

    try {
        // 1. Migrar Usuarios
        console.log('Migrando usuarios...');
        const userInserts = extractInserts('users');
        for (const u of userInserts) {
            const v = parseValues(u);
            result.users.push({
                id: parseInt(v[0]!),
                name: `${v[1]} ${v[2] || ''} ${v[3] || ''}`.trim(),
                email: v[7],
                password: v[9],
                roles: v[14] === '1' ? ['SuperAdministrador'] : ['Capturista'],
                dependency_id: v[13] ? parseInt(v[13]) : 1
            });
        }

        // 2. Migrar Dependencias
        console.log('Migrando dependencias...');
        const depInserts = extractInserts('cat_dependencies');
        for (const d of depInserts) {
            const v = parseValues(d);
            result.dependencies.push({
                id: parseInt(v[0]!),
                name: v[1],
                code: v[2],
                sector_id: v[3] ? parseInt(v[3]) : 1,
                periodo: 2025
            });
        }

        // 3. Migrar Entidades (Anexo Estadístico)
        console.log('Migrando entidades estadisticas...');
        const entityInserts = extractInserts('entities');
        for (const e of entityInserts) {
            const v = parseValues(e);
            result.entities.push({
                id: parseInt(v[0]!),
                name: v[1],
                dependency_id: parseInt(v[3]!),
                status: v[4] === 'approved' ? 'Sincronizado' : 'Pendiente',
                periodo: 2025
            });
        }

        // 4. Migrar Propiedades
        console.log('Migrando propiedades de tablas...');
        const propInserts = extractInserts('properties');
        for (const p of propInserts) {
            const v = parseValues(p);
            result.properties.push({
                id: parseInt(v[0]!),
                entity_id: parseInt(v[1]!),
                name: v[2],
                type: v[3]
            });
        }

        // 5. Migrar Entradas (Entries)
        console.log('Migrando registros de datos...');
        const entryInserts = extractInserts('entries');
        for (const en of entryInserts) {
            const v = parseValues(en);
            result.entries.push({
                id: parseInt(v[0]!),
                entity_id: parseInt(v[1]!),
                periodo: 2025,
                rows: []
            });
        }

        // 6. Migrar Valores y reconstruir filas
        console.log('Migrando valores individuales...');
        const valueInserts = extractInserts('values');
        const entryRows: Record<number, any> = {};

        for (const val of valueInserts) {
            const v = parseValues(val);
            const entryId = parseInt(v[1]!);
            const propId = v[2] as string;
            const value = v[3];

            if (!entryRows[entryId]) entryRows[entryId] = {};
            entryRows[entryId][propId] = value;
        }

        for (const entry of result.entries) {
            if (entryRows[entry.id]) {
                entry.rows = [entryRows[entry.id]];
            }
        }

        // 7. Migrar Capturas Narrativas
        console.log('Migrando misiones y capturas narrativas...');
        const missionInserts = extractInserts('cat_missions');
        for (const m of missionInserts) {
            const v = parseValues(m);
            result.missions.push({ id: parseInt(v[0]!), name: v[1], periodo: 2025 });
        }

        const narrativeInserts = extractInserts('narrative_captures');
        for (const n of narrativeInserts) {
            const v = parseValues(n);
            result.narratives.push({
                id: parseInt(v[0]!),
                ppa_name: v[8],
                narrative_breakdown: v[20],
                investment_amount: v[12] ? parseFloat(v[12]) : 0,
                beneficiaries: v[13] ? parseInt(v[13]) : 0,
                status: 'Sincronizado',
                periodo: 2025,
                dependency_id: v[3] ? parseInt(v[3]) : 1,
                mission_id: 1
            });
        }

        // 8. Actividades (Logs)
        console.log('Migrando logs de actividad...');
        const logInserts = extractInserts('activity_log');
        for (const l of logInserts) {
            const v = parseValues(l);
            result.activities.push({
                id: parseInt(v[0]!),
                user_name: v[2] || 'Sistema',
                action: v[4],
                type: v[3] === 'Access' ? 'login' : 'update',
                detail: v[8],
                timestamp: v[10],
                status: 'Sincronizado',
                periodo: 2025
            });
        }

        console.log(`Guardando resultados en: ${outputPath}`);
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log('--- Migración completada con éxito (JSON generado) ---');
    } catch (error) {
        console.error('Error durante la migración:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
