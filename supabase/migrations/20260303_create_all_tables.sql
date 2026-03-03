-- ============================================================
-- LEAN SOLUTION - Script Completo de Criação de Tabelas
-- Execute este script no SQL Editor do Supabase
-- Ele usa CREATE TABLE IF NOT EXISTS, então NÃO apaga dados existentes
-- ============================================================

-- 1. PROFILES (autenticação e perfil de usuário)
-- Esta tabela geralmente já é criada pelo Supabase Auth, mas vamos garantir
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'Visitante' CHECK (role IN ('Master', 'Planejador', 'Gerenciador', 'Executor', 'Visitante')),
    whatsapp TEXT,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_select_all') THEN
        CREATE POLICY profiles_select_all ON profiles FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_insert_own') THEN
        CREATE POLICY profiles_insert_own ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_update_all') THEN
        CREATE POLICY profiles_update_all ON profiles FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_delete_all') THEN
        CREATE POLICY profiles_delete_all ON profiles FOR DELETE USING (true);
    END IF;
END $$;


-- 2. TASKS (programação semanal / tarefas de execução)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'A Iniciar',
    assignee TEXT DEFAULT '',
    discipline TEXT DEFAULT '',
    level TEXT DEFAULT '',
    "startDate" DATE,
    "dueDate" DATE,
    "actualStartDate" DATE,
    "actualEndDate" DATE,
    location TEXT DEFAULT '',
    support TEXT DEFAULT '',
    side TEXT,
    corte TEXT,
    shift TEXT,
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT '',
    "actualQuantity" NUMERIC DEFAULT 0,
    progress NUMERIC DEFAULT 0,
    "plannedManpower" JSONB DEFAULT '[]'::jsonb,
    "plannedMachinery" JSONB DEFAULT '[]'::jsonb,
    "actualManpower" JSONB DEFAULT '[]'::jsonb,
    "actualMachinery" JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    observations TEXT DEFAULT '',
    baseline_id TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'tasks_all_access') THEN
        CREATE POLICY tasks_all_access ON tasks FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 3. BASELINE_TASKS (linha de base / macro cronograma)
CREATE TABLE IF NOT EXISTS baseline_tasks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'A Iniciar',
    assignee TEXT DEFAULT '',
    discipline TEXT DEFAULT '',
    level TEXT DEFAULT '',
    "startDate" DATE,
    "dueDate" DATE,
    "actualStartDate" DATE,
    "actualEndDate" DATE,
    location TEXT DEFAULT '',
    support TEXT DEFAULT '',
    side TEXT,
    corte TEXT,
    shift TEXT,
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT '',
    "actualQuantity" NUMERIC DEFAULT 0,
    progress NUMERIC DEFAULT 0,
    "plannedManpower" JSONB DEFAULT '[]'::jsonb,
    "plannedMachinery" JSONB DEFAULT '[]'::jsonb,
    "actualManpower" JSONB DEFAULT '[]'::jsonb,
    "actualMachinery" JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    observations TEXT DEFAULT '',
    baseline_id TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE baseline_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'baseline_tasks' AND policyname = 'baseline_tasks_all_access') THEN
        CREATE POLICY baseline_tasks_all_access ON baseline_tasks FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 4. CURRENT_SCHEDULE_TASKS (cronograma vigente)
CREATE TABLE IF NOT EXISTS current_schedule_tasks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'A Iniciar',
    assignee TEXT DEFAULT '',
    discipline TEXT DEFAULT '',
    level TEXT DEFAULT '',
    "startDate" DATE,
    "dueDate" DATE,
    "actualStartDate" DATE,
    "actualEndDate" DATE,
    location TEXT DEFAULT '',
    support TEXT DEFAULT '',
    side TEXT,
    corte TEXT,
    shift TEXT,
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT '',
    "actualQuantity" NUMERIC DEFAULT 0,
    progress NUMERIC DEFAULT 0,
    "plannedManpower" JSONB DEFAULT '[]'::jsonb,
    "plannedMachinery" JSONB DEFAULT '[]'::jsonb,
    "actualManpower" JSONB DEFAULT '[]'::jsonb,
    "actualMachinery" JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    observations TEXT DEFAULT '',
    baseline_id TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE current_schedule_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'current_schedule_tasks' AND policyname = 'current_schedule_tasks_all_access') THEN
        CREATE POLICY current_schedule_tasks_all_access ON current_schedule_tasks FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 5. RESTRICTIONS (restrições do Lean Construction)
CREATE TABLE IF NOT EXISTS restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baseline_task_id TEXT,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'Pendente',
    priority TEXT DEFAULT 'Média',
    responsible TEXT DEFAULT '',
    department TEXT,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    actual_start_date TIMESTAMP WITH TIME ZONE,
    actual_completion_date TIMESTAMP WITH TIME ZONE,
    user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE restrictions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'restrictions' AND policyname = 'restrictions_all_access') THEN
        CREATE POLICY restrictions_all_access ON restrictions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 6. LEAN_TASKS (tarefas do módulo Lean Construction / Análise de Ritmo)
CREATE TABLE IF NOT EXISTS lean_tasks (
    id TEXT PRIMARY KEY,
    task_data JSONB NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE lean_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lean_tasks' AND policyname = 'lean_tasks_all_access') THEN
        CREATE POLICY lean_tasks_all_access ON lean_tasks FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 7. CHECKOUT_LOGS (logs de alterações nas tarefas)
CREATE TABLE IF NOT EXISTS checkout_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT,
    task_title TEXT,
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT,
    changes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE checkout_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'checkout_logs' AND policyname = 'checkout_logs_all_access') THEN
        CREATE POLICY checkout_logs_all_access ON checkout_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 8. ORG_MEMBERS (organograma / membros da equipe)
CREATE TABLE IF NOT EXISTS org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    parent_id UUID,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_members' AND policyname = 'org_members_all_access') THEN
        CREATE POLICY org_members_all_access ON org_members FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 9. ACTIVITY_CATALOGS (catálogo de atividades)
CREATE TABLE IF NOT EXISTS activity_catalogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discipline TEXT NOT NULL,
    level TEXT,
    activity_title TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE activity_catalogs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_catalogs' AND policyname = 'activity_catalogs_all_access') THEN
        CREATE POLICY activity_catalogs_all_access ON activity_catalogs FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 10. PROJECT_SETTINGS (configurações do projeto)
CREATE TABLE IF NOT EXISTS project_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baseline_cutoff_date DATE DEFAULT '2026-01-10',
    current_schedule_cutoff_date DATE DEFAULT '2026-01-10',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_settings' AND policyname = 'project_settings_all_access') THEN
        CREATE POLICY project_settings_all_access ON project_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Inserir uma linha padrão se a tabela estiver vazia
INSERT INTO project_settings (baseline_cutoff_date, current_schedule_cutoff_date)
SELECT '2026-01-10', '2026-01-10'
WHERE NOT EXISTS (SELECT 1 FROM project_settings LIMIT 1);


-- 11. OAE_POSITIONS (posições do controle visual de OAE)
CREATE TABLE IF NOT EXISTS oae_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT,
    element_key TEXT,
    x NUMERIC DEFAULT 0,
    y NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE oae_positions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'oae_positions' AND policyname = 'oae_positions_all_access') THEN
        CREATE POLICY oae_positions_all_access ON oae_positions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- ============================================================
-- TRIGGER para criar perfil automaticamente quando um novo usuário se registra
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, role, is_approved)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'Visitante',
        false
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o trigger apenas se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;


-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
