import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

async function test() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    // Let's count tasks and maybe select one to see what it has
    const res = await fetch(`${url}/rest/v1/tasks?select=*&limit=1`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("HTTP Error:", res.status, text);
        return;
    }

    const data = await res.json();
    console.log("Success! Task 1 data keys:", Object.keys(data[0] || {}));
    
    // Also try to reload the schema via REST? We can't do that easily via REST unless we have a postgres function.
}

test();
