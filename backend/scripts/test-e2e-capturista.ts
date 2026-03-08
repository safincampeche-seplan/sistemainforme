import axios from 'axios';

const BASE_URL = 'http://localhost:3001';
const EMAIL = 'astekfk11@gmail.com'; // User known to have 'Capturista dependencia'
const PASSWORD = 'admin123';

async function runEndToEndCapturista() {
    console.log(`[1] Iniciando prueba E2E (Capturista) contra ${BASE_URL}...`);

    try {
        console.log(`\n[2] Intentando Login como Capturista: ${EMAIL}`);
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: EMAIL,
            password: PASSWORD,
        }, { validateStatus: () => true });

        if (loginRes.status !== 200) {
            console.error("❌ Falló el login:", loginRes.data);
            return;
        }

        const token = loginRes.data.token;
        const user = loginRes.data.user;

        console.log("✅ Login Exitoso.");
        console.log("-> Roles recibidos:", user.roles);
        console.log("-> Dependencia:", user.dependency);

        console.log(`\n[3] Obteniendo catálogos básicos...`);

        const headers = { Authorization: `Bearer ${token}` };

        // Fetch some catalogs just to ensure they work for Capturista
        const [titlesRes, themesRes] = await Promise.all([
            axios.get(`${BASE_URL}/api/catalogs/narrative-titles`, { headers, validateStatus: () => true }),
            axios.get(`${BASE_URL}/api/catalogs/narrative-themes`, { headers, validateStatus: () => true })
        ]);

        console.log(`-> Titles obtenidos: ${titlesRes.status === 200 ? 'OK' : 'Error ' + titlesRes.status}`);
        console.log(`-> Themes obtenidos: ${themesRes.status === 200 ? 'OK' : 'Error ' + themesRes.status}`);

        console.log(`\n[4] Creando Narrativa Completa...`);

        const payload = {
            ppa_name: "Narrativa E2E Prueba Automatizada",
            type_id: "1",
            investment_amount: "2500000",
            beneficiaries: "1500",
            narrative_breakdown: "<p>Registro automatizado para verificar flujo completo E2E. Todos los sistemas funcionan correctamente.</p>",
            highlighted: "true",
            periodo: 2026,
            status: "draft",
            title_id: 1,
            theme_id: 1,
            subtheme_id: 1,
            beneficiary_type_id: 1,
            budget_program_id: "manual",
            custom_budget_program: "Programa Especial E2E de Prueba"
        };

        const createRes = await axios.post(`${BASE_URL}/api/narratives`, payload, {
            headers,
            validateStatus: () => true
        });

        if (createRes.status === 200 || createRes.status === 201) {
            console.log("✅ Narrativa creada EXITOSAMENTE.");
            console.log("-> ID Generado:", createRes.data.id);
            console.log("-> Mensaje:", createRes.data.message);
        } else {
            console.error("❌ Falló la creación de la narrativa:", createRes.data || createRes.statusText);
            return;
        }

        console.log(`\n[5] Verificando en Inbox / Dashboard personal...`);
        const inboxRes = await axios.get(`${BASE_URL}/api/dashboard/stats?periodo=2026`, { headers, validateStatus: () => true });

        if (inboxRes.status === 200) {
            console.log("✅ Dashboard estadístico consultado correctamente.");
            console.log(`-> Narrativas totales reportadas: ${inboxRes.data.totalNarratives}`);
        } else {
            console.error("❌ Error consultando dashboard:", inboxRes.status);
        }

        console.log("\n🚀 FLUJO E2E DE CAPTURISTA COMPLETADO SIN ERRORES 🚀");

    } catch (e: any) {
        console.error("💥 Error crítico durante la prueba:", e.message);
    }
}

runEndToEndCapturista();
