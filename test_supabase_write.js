import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

async function test() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    // 1. Get a task ID
    const getRes = await fetch(`${url}/rest/v1/tasks?select=id&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const tasks = await getRes.json();
    if (tasks.length === 0) {
        console.log("No tasks found to test update.");
        return;
    }
    const id = tasks[0].id;
    console.log("Testing with task ID:", id);

    // 2. Try to update response
    const testMsg = "Test Response " + Date.now();
    const updateRes = await fetch(`${url}/rest/v1/tasks?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
            response: testMsg,
            response_user: "Test User",
            response_at: new Date().toISOString()
        })
    });

    if (!updateRes.ok) {
        const text = await updateRes.text();
        console.error("Update Error:", updateRes.status, text);
        return;
    }
    console.log("Update SUCCESS (requested)");

    // 3. Verify
    const verifyRes = await fetch(`${url}/rest/v1/tasks?id=eq.${id}&select=id,response,response_user,response_at`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const verifyData = await verifyRes.json();
    console.log("Verified Data:", verifyData);
    
    if (verifyData[0]?.response === testMsg) {
        console.log("COLUMN WORKS IN DB!");
    } else {
        console.log("COLUMN DOES NOT WORK OR NOT SAVED!");
    }
}

test();
