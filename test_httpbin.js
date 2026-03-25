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

const supabase = createClient(envObj['VITE_SUPABASE_URL'], envObj['VITE_SUPABASE_ANON_KEY']);

async function testHttpBin() {
    console.log("Testing payload structure...");
    try {
        const { data, error } = await supabase.rpc('gemini_proxy', {
            request_url: "https://httpbin.org/post?key=123",
            request_body: { contents: [{ parts: [{ text: "Hello HTTP BIN" }] }] }
        });
        
        console.log("Error:", error?.message);
        console.log("Response from HTTPBIN:");
        console.log(JSON.stringify(data, null, 2));
    } catch(e) {
        console.error("Crash:", e.message);
    }
}

testHttpBin();
