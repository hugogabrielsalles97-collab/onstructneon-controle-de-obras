-- Índices para acelerar as buscas e reduzir leitura de disco (I/O)
-- Execute este script no SQL Editor do Supabase

-- Tabela de Tarefas Principal
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_discipline ON tasks(discipline);
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks("startDate");

-- Tabela de Baseline
CREATE INDEX IF NOT EXISTS idx_baseline_tasks_user_id ON baseline_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_baseline_tasks_discipline ON baseline_tasks(discipline);
CREATE INDEX IF NOT EXISTS idx_baseline_tasks_status ON baseline_tasks(status);

-- Tabela de Restrições
CREATE INDEX IF NOT EXISTS idx_restrictions_task_id ON restrictions(baseline_task_id);
CREATE INDEX IF NOT EXISTS idx_restrictions_status ON restrictions(status);

-- Logs de Checkout
CREATE INDEX IF NOT EXISTS idx_checkout_logs_task_id ON checkout_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_checkout_logs_created_at ON checkout_logs(created_at DESC);
