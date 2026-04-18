import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

async function test() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    // Check baseline_tasks
    const resB = await fetch(`${url}/rest/v1/baseline_tasks?select=id&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const b = await resB.json();
    console.log("Baseline Tasks Count check:", b.length);

    // Check current_schedule_tasks
    const resC = await fetch(`${url}/rest/v1/current_schedule_tasks?select=id&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const c = await resC.json();
    console.log("Current Schedule Tasks Count check:", c.length);

    // Check tasks
    const resT = await fetch(`${url}/rest/v1/tasks?select=id&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const t = await resT.json();
    console.log("Tasks Count check:", t.length);
}

test();
