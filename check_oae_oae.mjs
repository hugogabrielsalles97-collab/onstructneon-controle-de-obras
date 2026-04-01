import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = (envText.match(/VITE_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const SUPABASE_ANON_KEY = (envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function checkValues() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/monitoring_rows?oae=eq.OAE`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });
    const data = await res.json();
    console.log("ROWS WITH OAE='OAE':", data.length);
}

checkValues();
