-- ============================================================
-- OTIMIZAÇÃO DE MEMÓRIA — Supabase Free Tier
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. AUTO-LIMPEZA: Apagar checkout_logs com mais de 90 dias
--    Isso evita crescimento ilimitado da tabela
-- ═══════════════════════════════════════════════════════════════
DELETE FROM checkout_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- ═══════════════════════════════════════════════════════════════
-- 2. VACUUM ANALYZE em todas as tabelas
--    Libera espaço de dead tuples e atualiza estatísticas
-- ═══════════════════════════════════════════════════════════════
VACUUM ANALYZE tasks;
VACUUM ANALYZE baseline_tasks;
VACUUM ANALYZE current_schedule_tasks;
VACUUM ANALYZE checkout_logs;
VACUUM ANALYZE restrictions;
VACUUM ANALYZE lean_tasks;
VACUUM ANALYZE org_members;
VACUUM ANALYZE oae_positions;
VACUUM ANALYZE activity_catalogs;
VACUUM ANALYZE profiles;

-- ═══════════════════════════════════════════════════════════════
-- 3. ÍNDICES FALTANTES para queries frequentes
-- ═══════════════════════════════════════════════════════════════

-- Índice composto para filtros de data (usado em quase todas as telas)
CREATE INDEX IF NOT EXISTS idx_tasks_date_range
    ON tasks ("startDate", "dueDate");

-- Índice para location (usado no Controle Visual)
CREATE INDEX IF NOT EXISTS idx_tasks_location
    ON tasks (location)
    WHERE location IS NOT NULL AND location != '';

-- Índice para dueDate (usado em filtros de data nos dashboards)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
    ON tasks ("dueDate");

-- Índice para baseline_tasks date range
CREATE INDEX IF NOT EXISTS idx_baseline_tasks_date_range
    ON baseline_tasks ("startDate", "dueDate");

-- Índice para current_schedule date range
CREATE INDEX IF NOT EXISTS idx_current_schedule_date_range
    ON current_schedule_tasks ("startDate", "dueDate");

-- Índice para checkout_logs user_id (filtros por usuário)
CREATE INDEX IF NOT EXISTS idx_checkout_logs_user_id
    ON checkout_logs (user_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. FUNÇÃO DE AUTO-LIMPEZA PROGRAMADA
--    Cria uma função que pode ser chamada periodicamente
--    (via pg_cron ou manualmente) para manter o banco limpo
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION maintenance_cleanup()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_logs INT;
BEGIN
    -- Apagar checkout_logs com mais de 90 dias
    DELETE FROM checkout_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_logs = ROW_COUNT;

    -- Retornar resumo
    RETURN format('Manutenção concluída: %s logs antigos removidos.', deleted_logs);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. VERIFICAÇÃO: Tamanho atual das tabelas
-- ═══════════════════════════════════════════════════════════════
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS data_size,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename) - pg_relation_size(schemaname || '.' || tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
