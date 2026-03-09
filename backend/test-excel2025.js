import axios from 'axios';
import fs from 'fs';
async function test() {
    const l = await axios.post('http://localhost:3001/api/auth/login', { email: 'admin@seplan.gob.mx', password: 'admin123' });
    try {
        const r = await axios.get('http://localhost:3001/api/export/consolidated/excel?periodo=2025', { headers: { Authorization: `Bearer ${l.data.token}` }, responseType: 'arraybuffer' });
        fs.writeFileSync('test_excel_2025.xlsx', r.data);
        console.log("✅ EXCEL 2025 OK");
    }
    catch (e) {
        console.error("❌ EXCEL 2025 FAIL:", e.response?.data || e.message);
    }
}
test();
//# sourceMappingURL=test-excel2025.js.map