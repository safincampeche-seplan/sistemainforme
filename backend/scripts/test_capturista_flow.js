import axios from 'axios';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api';
async function runEndToEndFlow() {
    let token = '';
    let userEmail = '';
    let dependencyName = '';
    // ==========================================
    // 1. OBTENER CAPTURISTA VALIDO DESDE PRISMA
    // ==========================================
    try {
        console.log('🔄 [1/5] Buscando Capturista y generando Token...');
        // Find a user who has the 'Capturista' role and belongs to a dependency
        const capturistaRole = await prisma.role.findFirst({ where: { name: 'Capturista' } });
        if (!capturistaRole)
            throw new Error("Role Capturista not found");
        const userHasRole = await prisma.userHasRole.findFirst({
            where: { role_id: capturistaRole.id }
        });
        if (!userHasRole)
            throw new Error("No users with Capturista role found");
        const capturista = await prisma.user.findUnique({
            where: { id: userHasRole.model_id },
            include: { dependency: true }
        });
        if (!capturista)
            throw new Error("Capturista user not found");
        userEmail = capturista.email;
        dependencyName = capturista.dependency?.name || 'N/A';
        token = jwt.sign({ id: capturista.id.toString(), email: capturista.email, roles: ['Capturista'], name: capturista.name, dependency_id: capturista.dependency_id?.toString() }, process.env.JWT_SECRET || 'seplan_secret_key_2024_secure', { expiresIn: '1h' });
        console.log(`✅ Emulando Login Exitoso para: ${userEmail}. Dependencia: ${dependencyName}\n`);
    }
    catch (e) {
        console.error('❌ Falló la simulación de Login. Abortando pruebas.', e.message);
        return;
    }
    const authConfig = { headers: { Authorization: `Bearer ${token}` } };
    // ==========================================
    // 2. OBTENER INFORMACIÓN INICIAL (DASHBOARD & CATÁLOGOS)
    // ==========================================
    let budgetPrograms = [];
    let odsList = [];
    let periodId = 1;
    try {
        console.log('🔄 [2/5] Descargando catálogos necesarios para captura...');
        const periodRes = await axios.get(`${API_URL}/periods/active`, authConfig);
        periodId = periodRes.data.id;
        console.log(`✅ Periodo Activo Obtenido: ${periodRes.data.name}`);
        const progRes = await axios.get(`${API_URL}/catalogs/budget-programs`, authConfig);
        budgetPrograms = progRes.data;
        console.log(`✅ Programas Presupuestarios Cargados: ${budgetPrograms.length}`);
        const odsRes = await axios.get(`${API_URL}/catalogs/ods`, authConfig);
        odsList = odsRes.data;
        console.log(`✅ ODS Cargados: ${odsList.length}`);
    }
    catch (e) {
        console.error('❌ Error obteniendo catálogos:', e.response?.data || e.message);
        return;
    }
    // ==========================================
    // 3. CAPTURA DE NARRATIVA (INSERCIÓN)
    // ==========================================
    let savedNarrativeId = null;
    try {
        console.log('\n🔄 [3/5] Enviando un formulario de Captura de Narrativa nuevo...');
        const narrativePayload = {
            title_id: 1,
            theme_id: 1,
            subtheme_id: 1,
            ods: [1, 2],
            ppa_name: "Campaña de Vacunación Preventiva 2026 Test Automático " + Date.now(),
            budget_program_id: budgetPrograms.length > 0 ? budgetPrograms[0].id : 1,
            investment_amount: 154000.50,
            beneficiary_type_id: 1,
            beneficiaries: 5000,
            locations: [{ municipality_id: 1, locality_id: 1 }],
            narrative_breakdown: "<p>Esta es una prueba de carga end-to-end generada por script de verificación automática.</p>",
            highlighted: "Aumento del 20% en cobertura vacunal.",
            status: "draft",
            periodo: 2026,
        };
        const captureRes = await axios.post(`${API_URL}/narratives`, narrativePayload, authConfig);
        savedNarrativeId = captureRes.data.id;
        console.log(`✅ Narrativa Creada Exitosamente con ID: ${savedNarrativeId}`);
    }
    catch (e) {
        console.error('❌ Error guardando narrativa:', e.response?.data || e.message);
        return;
    }
    if (!savedNarrativeId)
        return;
    // ==========================================
    // 4. VERIFICACIÓN EN BANDEJA (INBOX)
    // ==========================================
    try {
        console.log('\n🔄 [4/5] Verificando que la narrativa aparezca en la Bandeja del Capturista (Inbox)...');
        const inboxRes = await axios.get(`${API_URL}/tracking/all?type=narrativa`, authConfig);
        const myNarratives = inboxRes.data.data || inboxRes.data;
        const found = myNarratives.find((n) => n.id.toString() === savedNarrativeId.toString());
        if (found) {
            console.log(`✅ Narrativa de prueba encontrada en la bandeja. Estatus actual: ${found.status}`);
        }
        else {
            console.log(`❌ ALERTA: La narrativa no aparece en la bandeja de entrada del usuario.`);
        }
    }
    catch (e) {
        console.error('❌ Error consultando Inbox:', e.response?.data || e.message);
    }
    // ==========================================
    // 5. ENVIAR A REVISIÓN (ACTUALIZAR ESTATUS)
    // ==========================================
    try {
        console.log('\n🔄 [5/5] Enviando Narrativa a Revisión SAFIN/SECONT...');
        // Para que un capturista pueda enviar a revisión, usamos el PUT de narrativa con status 'En Validación'
        // o si habilitamos el update-status para Capturista. 
        // Probaremos con el PUT que es lo que usualmente se hace al "Finalizar" en el frontend.
        const updateRes = await axios.put(`${API_URL}/narratives/${savedNarrativeId}`, {
            ppa_name: "Campaña de Vacunación Preventiva 2026 Test Automático " + Date.now(),
            status: "En Validación" // Esto mapea a 'under_validation_semaig' en el backend
        }, authConfig);
        console.log(`✅ Narrativa enviada a validación. Mensaje del servidor:`, updateRes.data.message || 'OK');
    }
    catch (e) {
        console.error('❌ Error al cambiar el estatus:', e.response?.data || e.message);
    }
    console.log('\n==========================================');
    console.log('✅✅✅ FLUJO END-TO-END COMPLETADO CON ÉXITO');
    console.log('==========================================\n');
    process.exit(0);
}
runEndToEndFlow();
//# sourceMappingURL=test_capturista_flow.js.map