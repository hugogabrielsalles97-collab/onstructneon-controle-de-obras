import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

async function test() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    // Check columns of 'tasks' table via REST API (which uses PostgREST and information_schema internally)
    // We can't query information_schema directly via REST easily, but we can check if the column is accepted in select.
    const res = await fetch(`${url}/rest/v1/tasks?select=response,response_user,response_at&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("HTTP Error:", res.status, text);
        return;
    }

    const data = await res.json();
    console.log("Success! Columns exist in PostgREST schema. Data:", data);
}

test();
