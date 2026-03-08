import axios from 'axios';

const BASE_URL = 'http://localhost:3001';
const EMAIL = 'admin@seplan.gob.mx';
const PASSWORD = 'admin123'; // Based on previous tests, or adjust if needed

async function runEndToEndTest() {
    console.log(`[1] Iniciando prueba E2E contra ${BASE_URL}...`);

    try {
        console.log(`\n[2] Intentando Login como ${EMAIL}`);
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: EMAIL,
            password: PASSWORD,
        }, {
            validateStatus: () => true // No lanzar excepción, inspeccionar status
        });

        console.log(`Status de Login: ${loginRes.status}`);

        if (loginRes.status !== 200) {
            console.error("❌ Falló el login:", loginRes.data);
            return;
        }

        const token = loginRes.data.token;
        const user = loginRes.data.user;

        console.log("✅ Login Exitoso.");
        console.log("-> Roles recibidos:", user.roles);
        console.log("-> Token Extraído:", token ? "Presente" : "Missing");

        console.log(`\n[3] Solicitando /api/dependencies con Token...`);
        const depsRes = await axios.get(`${BASE_URL}/api/dependencies`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            validateStatus: () => true
        });

        console.log(`Status de Dependencias: ${depsRes.status}`);

        if (depsRes.status !== 200) {
            console.error("❌ Falló la carga de dependencias:", depsRes.data);
            return;
        }

        const deps = depsRes.data;
        console.log(`✅ Carga de dependencias exitosa. Total recibido: ${deps.length}`);

        if (deps.length > 0) {
            console.log("Muestra de las primeras 3 dependencias:");
            console.log(JSON.stringify(deps.slice(0, 3), null, 2));
        }

        console.log("\n🚀 PRUEBA E2E COMPLETADA EXITOSAMENTE 🚀");

    } catch (e: any) {
        console.error("💥 Error crítico durante la prueba:", e.message);
    }
}

runEndToEndTest();
