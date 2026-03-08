import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const baseURL = 'http://localhost:3001/api';

async function setupDemoUser() {
    console.log("🛠️ Asegurando que saluddemo@seplan.gob.mx exista en la BD y tenga contraseña correcta...");
    const dep = await prisma.dependency.findFirst({
        where: { name: { contains: 'Salud' } }
    });

    const depId = dep ? dep.id : 1;
    let saludUser = await prisma.user.findUnique({
        where: { email: 'saluddemo@seplan.gob.mx' }
    });

    const hashedPassword = await bcrypt.hash('seplan123', 10);

    if (!saludUser) {
        saludUser = await prisma.user.create({
            data: {
                name: 'Salud Demo (Capturista)',
                email: 'saluddemo@seplan.gob.mx',
                password: hashedPassword,
                dependency_id: depId,
                is_active: true
            }
        });

        const capturistaRole = await prisma.role.findFirst({
            where: { name: 'Capturista' }
        });
        if (capturistaRole) {
            await prisma.userHasRole.create({
                data: {
                    role_id: capturistaRole.id,
                    model_id: saludUser.id,
                    model_type: 'App\\Models\\User'
                }
            });
        }
        console.log("✅ Usuario saluddemo@seplan.gob.mx creado exitosamente (Contraseña: seplan123).");
    } else {
        await prisma.user.update({
            where: { id: saludUser.id },
            data: {
                password: hashedPassword,
                dependency_id: depId
            }
        });
        console.log("✅ Contraseña restablecida a 'seplan123' para saluddemo@seplan.gob.mx.");
    }
}

async function runE2E() {
    await setupDemoUser();
    try {
        console.log("\n1. Intentando hacer login como saluddemo@seplan.gob.mx...");
        let loginRes;
        try {
            loginRes = await axios.post(`${baseURL}/auth/login`, {
                email: 'saluddemo@seplan.gob.mx',
                password: 'seplan123' // Contraseña forzada arriba
            });
        } catch (err: any) {
            console.error("❌ No se pudo iniciar sesión. Error:", err.response?.data || err.message);
            return;
        }

        const capturistaToken = loginRes.data.token;
        const capturistaData = loginRes.data.user;
        console.log("✅ Login exitoso como Capturista:", capturistaData.name);

        console.log("\n2. Creando una nueva narrativa de prueba...");
        const newNarrative = {
            ppa_name: "FLUJO E2E SALUD DEMO TEST PPA",
            investment_amount: "500000",
            beneficiaries: "150",
            narrative_breakdown: "Esta es una narrativa de prueba E2E automatizada.",
            highlighted: "Destacado E2E",
            periodo: 2026,
            status: "En Validación",
            mission_id: 1,
            title_id: 1,
            theme_id: 1,
            subtheme_id: 1
        };

        const createRes = await axios.post(`${baseURL}/narratives`, newNarrative, {
            headers: { Authorization: `Bearer ${capturistaToken}` }
        });

        const narrativeId = createRes.data.id;
        console.log("✅ Narrativa creada con ID:", narrativeId);

        console.log("\n3. Intentando hacer login como administrador general (admin@seplan.gob.mx)...");
        const adminLoginRes = await axios.post(`${baseURL}/auth/login`, {
            email: 'admin@seplan.gob.mx',
            password: 'admin123'
        });
        const adminToken = adminLoginRes.data.token;
        console.log("✅ Login exitoso como Admin.");

        console.log("\n4. Verificando si el Admin puede ver la nueva narrativa en su buscador (/api/dashboard/search)...");
        const searchRes = await axios.get(`${baseURL}/dashboard/search?q=FLUJO E2E`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        const found = searchRes.data.find((n: any) => n.id === narrativeId);
        if (found) {
            console.log("✅ ¡Éxito! El Admin encontró la narrativa en su búsqueda:", found.title);
        } else {
            console.log("❌ Error: La narrativa no apareció en la búsqueda del Admin.");
        }

        console.log("\n5. Verificando el feed de actividades globales del Admin (/api/activities)...");
        const activitiesRes = await axios.get(`${baseURL}/activities`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        const inFeed = activitiesRes.data.find((a: any) => a.id === narrativeId);
        if (inFeed) {
            console.log("✅ ¡Éxito! La narrativa aparece en las actividades recientes del Admin.");
            console.log("⭐ Estado de la narrativa vista por el Admin:", inFeed.status);
        } else {
            console.log("❌ Error: La narrativa no está en las actividades recientes del Admin.");
        }

    } catch (error: any) {
        console.error("❌ Flujo falló:", error?.response?.data || error.message);
    } finally {
        await prisma.$disconnect();
    }
}

runE2E();
