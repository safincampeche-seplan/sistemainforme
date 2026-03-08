import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
    console.log("Creando datos de prueba para exportación...");

    // Asegurar dependencia y misión
    const dep = await prisma.dependency.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, name: "Secretaría de Planeación", acronym: "SEPLAN" }
    });

    const mission = await prisma.mission.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, name: "Gobernanza y Seguridad", code: "M1" }
    });

    // Crear narrativa real
    await prisma.narrativeCapture.create({
        data: {
            narrative_breakdown: "Durante el presente periodo, se ha fortalecido el sistema de videovigilancia estatal mediante la adquisición de 500 nuevas cámaras de alta definición. Esta acción ha permitido reducir el tiempo de respuesta ante incidentes en un 30%, garantizando una mayor seguridad para la ciudadanía en las zonas de mayor índice delictivo.",
            highlighted: "Reducción del 30% en tiempos de respuesta policial mediante tecnología de vanguardia.",
            status: "Aprobado",
            dependency_id: 1,
            mission_id: 1
        }
    });

    console.log("✅ Datos de prueba creados. Intenta exportar de nuevo.");
}

seed();
