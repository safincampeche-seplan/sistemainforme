import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Sembrando Dependencias Históricas...");

    // We expect the script to be run from the current directory
    const dataPath = path.join(__dirname, 'data-backup.json');
    if (!fs.existsSync(dataPath)) {
        console.error("No se encontró data-backup.json en " + dataPath);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    if (!data.dependencies || data.dependencies.length === 0) {
        console.error("El JSON no tiene el arreglo de 'dependencies' requerido.");
        process.exit(1);
    }

    console.log(`Encontradas ${data.dependencies.length} dependencias en el archivo histórico.`);

    // Ignoramos la id: 1 ("Secretaría de Planeación") ya que ya la insertamos en el paso anterior de seed-local
    const depsToInsert = data.dependencies.filter((d: any) => d.id !== 1);

    for (const dep of depsToInsert) {
        await prisma.dependency.upsert({
            where: { id: dep.id },
            update: {
                name: dep.name,
                acronym: dep.code || null
            },
            create: {
                id: dep.id,
                name: dep.name,
                acronym: dep.code || null,
                is_trust: false,
                is_secretary: false,
                is_deconcentrated: false,
                is_decentralized: false,
                is_company: false
            }
        });
    }

    console.log(`✅ ¡${depsToInsert.length} dependencias históricas importadas exitosamente!`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
