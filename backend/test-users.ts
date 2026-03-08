import axios from 'axios';
async function test() {
    try {
        const l = await axios.post('http://localhost:3001/api/auth/login', {email:'super@seplan.gob.mx',password:'super123'});
        const users = await axios.get('http://localhost:3001/api/users', {headers:{Authorization:`Bearer ${l.data.token}`}});
        const deps = await axios.get('http://localhost:3001/api/dependencies', {headers:{Authorization:`Bearer ${l.data.token}`}});
        console.log(`✅ OK: Obtenidos ${users.data.length} usuarios y ${deps.data.length} dependencias con SuperAdministrador.`);
    } catch(e:any) { console.error("❌ FAIL:", e.response?.data || e.message); }
}
test();
