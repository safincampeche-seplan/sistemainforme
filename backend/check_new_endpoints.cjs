const axios = require('axios');

async function checkEndpoints() {
    const baseUrl = 'http://localhost:3001';
    // We need a token, but let's just see if they are defined (they should return 401 if not authenticated)
    const endpoints = [
        '/api/catalogs/narrative-titles',
        '/api/catalogs/localities/1'
    ];

    for (const endpoint of endpoints) {
        try {
            const res = await axios.get(baseUrl + endpoint);
            console.log(`Endpoint ${endpoint}: ${res.status}`);
        } catch (error) {
            console.log(`Endpoint ${endpoint}: ${error.response ? error.response.status : error.message}`);
        }
    }
}

checkEndpoints();
