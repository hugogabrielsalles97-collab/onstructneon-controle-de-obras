import fs from 'fs';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const envText = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = (envText.match(/VITE_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const SUPABASE_ANON_KEY = (envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();

async function check() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/monitoring_rows?service=eq.TRANSVERSINAS&select=count`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const header = res.headers.get('Content-Range');
        console.log(`TOTAL TRANSVERSINAS: ${header}`);
        
        const res2 = await fetch(`${SUPABASE_URL}/rest/v1/monitoring_rows?id=eq.TRANSVERSINAS_S01_P1-P2&select=daily_data`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const d = await res2.json();
        console.log(`S01_P1-P2 DATA: ${JSON.stringify(d)}`);
    } catch(e) { console.error(e); }
}

check();
