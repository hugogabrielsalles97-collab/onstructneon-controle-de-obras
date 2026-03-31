import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
});

async function list() {
  // Query a common table to see if we can connect
  const { data, error } = await supabase.from('tasks').select('id').limit(1);
  if (error) {
    console.log("TASKS TABLE ERROR (maybe check credentials):", error.message);
  } else {
    console.log("CONNECTED TO SUPABASE! Found tasks table.");
  }
}

list();
