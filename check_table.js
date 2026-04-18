import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('monitoring_rows').select('id').limit(1);
  if (error) {
    console.log("TABLE NOT FOUND OR ERROR:", error.message);
  } else {
    console.log("TABLE EXISTS! Row count approx:", data.length);
  }
}

check();
