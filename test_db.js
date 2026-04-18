import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCols() {
  const { data, error } = await supabase.from('tasks').select('id, response').limit(1);
  if (error) {
    console.error("Error testing columns:", error);
  } else {
    console.log("Success! Columns exist. Data:", data);
  }
}

testCols();
