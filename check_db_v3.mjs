import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const envText = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = (envText.match(/VITE_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const SUPABASE_ANON_KEY = (envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    try {
        const { count, error } = await supabase.from('monitoring_rows').select('*', { count: 'exact', head: true }).eq('service', 'TRANSVERSINAS');
        if (error) console.error(error);
        else console.log(`TOTAL TRANSVERSINAS ROWS: ${count}`);
        
        const { data: d1 } = await supabase.from('monitoring_rows').eq('id', 'TRANSVERSINAS_S01_P1-P2').single();
        console.log(`DATA FOR S01_P1-P2:`, JSON.stringify(d1?.daily_data).slice(0, 500));
    } catch(e) { console.error(e); }
}

check();
