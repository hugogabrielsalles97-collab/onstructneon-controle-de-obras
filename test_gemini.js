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

async function testGemini() {
    console.log("Using API Key:", apiKey);
    
    // Direct REST API fetch to bypass CORS issues from SDK
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello, world!" }] }]
            })
        });
        
        const data = await response.text();
        console.log("HTTP STATUS:", response.status);
        console.log("RESPONSE:", data);
    } catch(err) {
        console.error("FATAL FETCH ERROR:", err.message);
    }
}

testGemini();
