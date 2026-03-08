import http from 'http';

const data = JSON.stringify({
    mission_name: "INFORME 2025", title_color: "1E1B4B", theme_color: "3730A3", subtheme_color: "4F46E5",
    items: [{ title_code: "1", title_name: "G", theme_code: "1", theme_name: "S", content: "No hay" }]
});

const req = http.request({
    hostname: 'localhost', port: 8000, path: '/export/word', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, res => {
    let body = '';
    console.log("Status:", res.statusCode);
    res.on('data', d => body += d);
    res.on('end', () => console.log("Response:", body.length > 500 ? "Binary Blob Received" : body));
});

req.on('error', e => console.error("Error:", e));
req.write(data);
req.end();
