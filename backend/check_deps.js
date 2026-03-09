import axios from 'axios';
import jwt from 'jsonwebtoken';
const API_URL = 'http://localhost:3001/api';
const JWT_SECRET = 'seplan_captura_informe_2026_secret_key';
async function testDeps() {
    const token = jwt.sign({ id: 1, roles: ['SuperAdministrador'], email: 'admin@test.com' }, JWT_SECRET);
    try {
        console.log("🔍 Fetching dependencies for sector 1...");
        const res = await axios.get(`${API_URL}/catalogs/dependencies?sectorId=1&periodo=2026&withProgress=true`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const deps = res.data;
        if (deps.length > 0) {
            console.log("✅ Sample Dependency Data:");
            console.log(JSON.stringify(deps[0], (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
        }
        else {
            console.log("⚠️ No dependencies found.");
        }
    }
    catch (error) {
        console.error("❌ Error:", error.response?.data || error.message);
    }
}
testDeps();
//# sourceMappingURL=check_deps.js.map