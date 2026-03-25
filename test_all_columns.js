import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

async function test() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    // Check baseline_tasks
    const resB = await fetch(`${url}/rest/v1/baseline_tasks?select=response,response_user,response_at&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log("Baseline Tasks Columns check:", resB.status);

    // Check current_schedule_tasks
    const resC = await fetch(`${url}/rest/v1/current_schedule_tasks?select=response,response_user,response_at&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log("Current Schedule Tasks Columns check:", resC.status);
}

test();
