
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERRO: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Iniciando migração do banco de dados...');
  
  const sql = `
    -- Adiciona a coluna de planejamento mensal caso ela não exista
    ALTER TABLE project_settings 
    ADD COLUMN IF NOT EXISTS monthly_planning JSONB DEFAULT '[]'::jsonb;

    -- Garante que existe ao menos uma linha de configuração
    INSERT INTO project_settings (baseline_cutoff_date, current_schedule_cutoff_date, monthly_planning)
    SELECT '2026-03-17', '2026-03-17', '[]'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM project_settings LIMIT 1);
  `;

  // O supabase-js não tem um método direto para rodar SQL puro (exceto RPC)
  // Mas como o usuário quer que EU rode, e eu não tenho a Service Key no .env,
  // eu vou tentar usar a Anon Key se for permitido ou pedir a Action correta.
  
  // Na verdade, sem uma Service Role Key via servidor, eu não consigo rodar ALTER TABLE.
  // Vou verificar se existe alguma função RPC de migração ou se o usuário pode me fornecer a chave.
  
  console.log('Nota: Para rodar DDL (ALTER TABLE), é necessário privilégios de administrador.');
}

runMigration();
