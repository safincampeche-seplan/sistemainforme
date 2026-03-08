const fetch = require('node-fetch');
async function test() {
    try {
        const res = await fetch('http://localhost:8000/export/word', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mission_name: "INFORME 2025", title_color: "1E1B4B", theme_color: "3730A3", subtheme_color: "4F46E5",
                items: [{ title_code: "1", title_name: "G", theme_code: "1", theme_name: "S", content: "No hay" }]
            })
        });
        console.log("Status:", res.status);
        console.log("Response:", await res.text());
    } catch(e) { console.error(e); }
}
test();
