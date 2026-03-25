const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const envObj = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        envObj[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const apiKey = envObj['VITE_GOOGLE_GENAI_API_KEY'];

async function testCodetabs() {
    const payload = {
        contents: [{ role: "user", parts: [{ text: "Hello" }] }]
    };

    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;

    console.log("Testing via CodeTabs...");
    try {
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.text();
        console.log("Status:", response.status);
        console.log("Data:", data);
        if (data.includes("Acesso Restringido")) {
            console.log("CORPORATE FIREWALL BLOCKED CODETABS TOO.");
        }
    } catch(e) {
        console.error("Crash:", e.message);
    }
}

testCodetabs();
