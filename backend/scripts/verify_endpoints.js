import axios from 'axios';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API_URL = 'http://localhost:5001/api';
async function runTests() {
    console.log('🚀 Iniciando verificación de Endpoints API V2...\n');
    let token = '';
    // ==========================================
    // 1. AUTHENTICATION (Bypass generating token directly)
    // ==========================================
    try {
        console.log('🔄 Autenticando como SuperAdministrador...');
        const adminUser = await prisma.user.findFirst({
            where: { is_active: true }
        });
        if (!adminUser)
            throw new Error("No active users found");
        token = jwt.sign({ id: adminUser.id.toString(), email: adminUser.email, roles: ['SuperAdministrador'], name: adminUser.name }, process.env.JWT_SECRET || 'seplan_secret_key_2024_secure', { expiresIn: '1h' });
        console.log(`✅ Token de SuperAdministrador generado para ${adminUser.email}\n`);
    }
    catch (e) {
        console.error('❌ Falló la generación del token.', e.message);
        return;
    }
    const authConfig = { headers: { Authorization: `Bearer ${token}` } };
    let passed = 0;
    let failed = 0;
    const testEndpoint = async (method, path, data) => {
        try {
            console.log(`🔄 Probando: ${method.toUpperCase()} ${path}`);
            if (method === 'get') {
                await axios.get(`${API_URL}${path}`, authConfig);
            }
            else {
                await axios.post(`${API_URL}${path}`, data, authConfig);
            }
            console.log(`✅ OK: ${path}`);
            passed++;
        }
        catch (e) {
            console.error(`❌ ERROR: ${path} - Status: ${e.response?.status} - ${JSON.stringify(e.response?.data || e.message)}`);
            failed++;
        }
    };
    // ==========================================
    // 2. DASHBOARD & SYSTEM ROUTES
    // ==========================================
    console.log('--- RUTAS DE DASHBOARD Y SISTEMA ---');
    await testEndpoint('get', '/dashboard/stats');
    await testEndpoint('get', '/dashboard/search?q=gasto');
    await testEndpoint('get', '/stats/global');
    await testEndpoint('get', '/periods');
    await testEndpoint('get', '/logs');
    console.log('');
    // ==========================================
    // 3. CATALOGS & ENTITIES
    // ==========================================
    console.log('--- RUTAS DE CATÁLOGOS Y ENTIDADES ---');
    await testEndpoint('get', '/catalogs/sectors');
    await testEndpoint('get', '/catalogs/ped/missions');
    await testEndpoint('get', '/entities');
    await testEndpoint('get', '/catalogs/ods');
    console.log('');
    // ==========================================
    // 4. TRACKING & STATUS
    // ==========================================
    console.log('--- RUTAS DE SEGUIMIENTO Y CONSOLIDACIÓN ---');
    await testEndpoint('get', '/tracking/all?periodo=2026');
    await testEndpoint('get', '/consolidation/status?periodo=2026');
    console.log('');
    // ==========================================
    // 5. SECONT / SAFIN
    // ==========================================
    console.log('--- RUTAS SECONT ---');
    await testEndpoint('get', '/secont/narrativas?periodo=2026');
    await testEndpoint('get', '/secont/anexos?periodo=2026');
    await testEndpoint('get', '/secont/stats?periodo=2026');
    console.log('');
    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('==========================================');
    console.log(`🏁 PRUEBAS FINALIZADAS`);
    console.log(`✅ Exitosas: ${passed}`);
    console.log(`❌ Fallidas: ${failed}`);
    console.log('==========================================');
    process.exit(0);
}
runTests();
//# sourceMappingURL=verify_endpoints.js.map