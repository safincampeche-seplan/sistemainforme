import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const rootDir = '/Users/carlosf.caceres/Documents/PROYECTO SEPLAN/INFORME/capturainforme';
    const csvDir = path.join(rootDir, 'catalogos_csv');

    const importCSV = (filename: string, expectedFields: number) => {
        const filePath = path.join(csvDir, filename);
        // Usamos utf8 explícito para evitar problemas de codificación
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const data: any[] = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length === expectedFields) {
                // Caso normal
                data.push(parts);
            } else if (parts.length > expectedFields) {
                // Caso con comas extras en el nombre (asumimos campo 1 es el nombre y tiene comas)
                const id = parts[0];
                const lastIdxs = expectedFields - 2;
                const lastPart = parts.slice(-lastIdxs);
                const name = parts.slice(1, -lastIdxs).join(',').trim();
                data.push([id, name, ...lastPart]);
            }
        }
        return data;
    };

    console.log('--- Corrigiendo Municipios (UTF-8) ---');
    const munData = importCSV('cat_municipalities.csv', 5);
    for (const row of munData) {
        await prisma.cat_municipalities.upsert({
            where: { id: BigInt(row[0]) },
            update: { name: row[1] },
            create: { id: BigInt(row[0]), name: row[1] }
        });
    }

    console.log('--- Corrigiendo Localidades (UTF-8) ---');
    const locData = importCSV('cat_localities.csv', 7);
    let count = 0;
    for (const row of locData) {
        try {
            await prisma.cat_localities.upsert({
                where: { id: BigInt(row[0]) },
                update: {
                    name: row[1],
                    code: row[2],
                    municipality_id: BigInt(row[3])
                },
                create: {
                    id: BigInt(row[0]),
                    name: row[1],
                    code: row[2],
                    municipality_id: BigInt(row[3])
                }
            });
            count++;
            if (count % 1000 === 0) console.log(`Progreso: ${count}...`);
        } catch (err) { }
    }
    console.log(`Localidades corregidas: ${count}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
