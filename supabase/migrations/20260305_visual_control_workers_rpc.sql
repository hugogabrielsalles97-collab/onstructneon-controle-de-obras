-- ============================================================
-- RPC: get_visual_control_workers
-- Retorna resumo de trabalhadores por OAE para uma data específica.
-- Faz a agregação no banco, evitando transferir JSONB pesados.
-- ============================================================

CREATE OR REPLACE FUNCTION get_visual_control_workers(p_date DATE)
RETURNS TABLE (
    task_id UUID,
    task_title TEXT,
    task_location TEXT,
    task_assignee TEXT,
    task_support TEXT,
    task_shift TEXT,
    manpower_role TEXT,
    manpower_qty INT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        t.id          AS task_id,
        t.title       AS task_title,
        t.location    AS task_location,
        t.assignee    AS task_assignee,
        t.support     AS task_support,
        t.shift       AS task_shift,
        mp->>'role'   AS manpower_role,
        (mp->>'quantity')::INT AS manpower_qty
    FROM tasks t,
         jsonb_array_elements(t."plannedManpower") AS mp
    WHERE t.location IS NOT NULL
      AND t."startDate"::DATE <= p_date
      AND t."dueDate"::DATE   >= p_date
      AND mp->>'role' IS NOT NULL
      AND (mp->>'quantity')::INT > 0
$$;
