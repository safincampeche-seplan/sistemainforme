import axios from 'axios';
import fs from 'fs';

async function testExport() {
    const loginRes = await axios.post('http://localhost:3001/api/auth/login', {
        email: 'admin@seplan.gob.mx',
        password: 'admin123'
    });

    const token = loginRes.data.token;

    try {
        console.log("Iniciando exportación de misión 1...");
        const res = await axios.get('http://localhost:3001/api/export/word/1', {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'arraybuffer'
        });

        fs.writeFileSync('test_real_export.docx', res.data);
        console.log("✅ Exportación exitosa: test_real_export.docx generado.");
    } catch (error) {
        console.error("❌ Error en exportación:", error.response?.data || error.message);
    }
}

testExport();
