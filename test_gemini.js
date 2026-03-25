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

async function testModelsViaProxy() {
    const models = [
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro',
        'gemini-pro',
        'gemini-1.0-pro'
    ];

    console.log("Using API Key:", apiKey);

    for (const model of models) {
        console.log("Testing model: " + model);
        const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
        
        try {
            const { data, error } = await supabase.rpc('gemini_proxy', {
                request_url: url,
                request_body: { contents: [{ parts: [{ text: "Hello" }] }] }
            });
            
            if (error) {
                console.log("=> RPC Error for " + model + ": " + error.message);
            } else if (data && data.error) {
                console.log("=> API Error for " + model + ": " + data.error.message);
            } else if (data && data.candidates) {
                console.log("=> SUCCESS using " + model + "!");
            } else {
                console.log("=> Unknown response for " + model + ": ", data);
            }
        } catch(e) {
            console.error("Crash:", e.message);
        }
    }
}

testModelsViaProxy();
