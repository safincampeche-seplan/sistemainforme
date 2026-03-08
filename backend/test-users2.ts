import axios from 'axios';
async function test() {
    try {
        const l = await axios.post('http://localhost:3001/api/auth/login', {email:'super@seplan.gob.mx',password:'super123'});
        const usr = await axios.post('http://localhost:3001/api/users', { name: "Test User", email: "test@test.com", password: "123", roles: ["Capturista"], dependency_id: 1, status: "Activo"}, {headers:{Authorization:`Bearer ${l.data.token}`}});
        console.log(`✅ OK: Usuario creado ${usr.data.name}`);
        const update = await axios.put(`http://localhost:3001/api/users/${usr.data.id}/status`, { status: "Suspendido" }, {headers:{Authorization:`Bearer ${l.data.token}`}});
        console.log(`✅ OK: Usuario suspendido ${update.data.status}`);
        const del = await axios.delete(`http://localhost:3001/api/users/${usr.data.id}`, {headers:{Authorization:`Bearer ${l.data.token}`}});
        console.log(`✅ OK: Usuario borrado ${del.data.message}`);
    } catch(e:any) { console.error("❌ FAIL:", e.response?.data || e.message); }
}
test();
