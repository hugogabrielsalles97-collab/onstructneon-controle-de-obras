import { createClient } from '@supabase/supabase-client';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = (envText.match(/VITE_SUPABASE_URL=(.*)/) || [])[1]?.trim();
const SUPABASE_ANON_KEY = (envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/) || [])[1]?.trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    const { count, error } = await supabase.from('monitoring_rows').select('*', { count: 'exact', head: true }).eq('service', 'TRANSVERSINAS');
    if (error) console.error(error);
    else console.log(`TOTAL TRANSVERSINAS ROWS: ${count}`);
    
    // Check one with data
    const { data } = await supabase.from('monitoring_rows').eq('id', 'TRANSVERSINAS_S01_P1-P2').single();
    console.log(`DATA FOR S01_P1-P2:`, JSON.stringify(data?.daily_data));
}

check();
