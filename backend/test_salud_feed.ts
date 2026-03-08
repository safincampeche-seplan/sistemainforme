import axios from 'axios';

async function main() {
    const baseURL = 'http://localhost:3001/api';
    try {
        const loginRes = await axios.post(`${baseURL}/auth/login`, {
            email: 'saluddemo@seplan.gob.mx',
            password: 'seplan123'
        });
        const token = loginRes.data.token;

        console.log("Login OK, fetching activities...");
        const actRes = await axios.get(`${baseURL}/activities`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("Activities for Salud Demo:", actRes.data);
    } catch (e: any) {
        console.error(e.response?.data || e.message);
    }
}
main();
