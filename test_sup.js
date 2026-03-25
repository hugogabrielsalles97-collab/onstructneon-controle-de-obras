import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envObj = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        envObj[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabase = createClient(envObj['VITE_SUPABASE_URL'], envObj['VITE_SUPABASE_ANON_KEY']);

async function clean() {
  const { error } = await supabase.from('notifications').delete().eq('user_name', 'system');
  if (error) console.error("DELETE ERROR:", error.message);
  else console.log("Removed dummy notifications.");
}

clean();
