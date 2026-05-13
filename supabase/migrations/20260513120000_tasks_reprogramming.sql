-- Planejamento inicial e histórico de reprogramação (Programação Semanal)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "originalStartDate" DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "originalDueDate" DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "rescheduleHistory" JSONB DEFAULT '[]'::jsonb;

ALTER TABLE baseline_tasks ADD COLUMN IF NOT EXISTS "originalStartDate" DATE;
ALTER TABLE baseline_tasks ADD COLUMN IF NOT EXISTS "originalDueDate" DATE;
ALTER TABLE baseline_tasks ADD COLUMN IF NOT EXISTS "rescheduleHistory" JSONB DEFAULT '[]'::jsonb;

ALTER TABLE current_schedule_tasks ADD COLUMN IF NOT EXISTS "originalStartDate" DATE;
ALTER TABLE current_schedule_tasks ADD COLUMN IF NOT EXISTS "originalDueDate" DATE;
ALTER TABLE current_schedule_tasks ADD COLUMN IF NOT EXISTS "rescheduleHistory" JSONB DEFAULT '[]'::jsonb;
