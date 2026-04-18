import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function count() {
  const { count, error } = await supabase
    .from('monitoring_rows')
    .select('*', { count: 'exact', head: true });
    
  if (error) console.error(error);
  else console.log("Current row count in Supabase:", count);
}

count();
