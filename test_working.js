import { createClient } from '@supabase/supabase-js';
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
const supabase = createClient(envObj['VITE_SUPABASE_URL'], envObj['VITE_SUPABASE_ANON_KEY']);

async function testWorkingProxyPayload() {
    const model = 'gemini-1.5-flash';
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
    
    // Explicitly manually mapping the exact GenerateContent request schema!
    const validBody = {
        contents: [{ role: "user", parts: [{ text: "Hello" }] }]
    };

    console.log("Testing with validBody...");
    try {
        const { data, error } = await supabase.rpc('gemini_proxy', {
            request_url: url,
            request_body: validBody
        });
        console.log("Error:", error?.message);
        console.log("Data:", JSON.stringify(data, null, 2));
    } catch(e) {
        console.error("Crash:", e.message);
    }
}

testWorkingProxyPayload();
