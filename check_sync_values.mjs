import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = (envText.match(/VITE_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const SUPABASE_ANON_KEY = (envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();

async function checkValues() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/monitoring_rows?service=eq.ESTACA&oae=eq.S01&apoio=eq.P2`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    const data = await res.json();
    console.log("DATA FOR ESTACA S01 P2:", JSON.stringify(data[0].daily_data, null, 2));
}

checkValues();
