import axios from 'axios';
import jwt from 'jsonwebtoken';
async function t() {
    const token = jwt.sign({ id: 1, email: 'admin@admin', roles: ['SuperAdministrador'], name: 'admin' }, process.env.JWT_SECRET || 'seplan_secret_key_2024_secure', { expiresIn: '1h' });
    try {
        await axios.get('http://localhost:5001/api/consolidation/status?periodo=2026', {
            headers: { Authorization: `Bearer ${token}` }
        });
    }
    catch (e) {
        console.error(e.response?.data || e.message);
    }
}
t();
//# sourceMappingURL=test_status.js.map