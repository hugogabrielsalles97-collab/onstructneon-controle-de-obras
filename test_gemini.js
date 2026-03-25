import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envObj = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        envObj[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const apiKey = envObj['VITE_GOOGLE_GENAI_API_KEY'];
const targetUrl = encodeURIComponent(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`);

const proxies = [
    `https://api.allorigins.win/raw?url=${targetUrl}`,
    `https://thingproxy.freeboard.io/fetch/${decodeURIComponent(targetUrl)}`,
    `https://api.codetabs.com/v1/proxy/?quest=${targetUrl}`
];

async function testProxies() {
    for (const url of proxies) {
        console.log("Testing:", url.substring(0, 40));
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Hello proxy" }] }]
                })
            });
            const text = await response.text();
            console.log("STATUS:", response.status);
            console.log("PREVIEW:", text.substring(0, 100));
            if (response.status === 200 && !text.includes('Acesso Restringido')) {
                console.log("SUCCESS WITH PROXY:", url.substring(0, 40));
                return;
            }
        } catch(e) {
            console.error("fetch failed:", e.message);
        }
    }
}
testProxies();
