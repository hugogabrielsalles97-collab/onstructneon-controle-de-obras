-- ============================================================
-- CONFIGURAÇÃO DO STORAGE PARA FOTOS
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Criar o Bucket se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Permitir que qualquer pessoa veja as fotos (Acesso Público)
CREATE POLICY "Fotos de Tarefas - Acesso Público"
ON storage.objects FOR SELECT
USING ( bucket_id = 'task-photos' );

-- 3. Permitir que usuários autenticados façam upload
CREATE POLICY "Fotos de Tarefas - Upload Autenticado"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'task-photos'
    AND auth.role() = 'authenticated'
);

-- 4. Permitir que usuários autenticados excluam suas fotos
CREATE POLICY "Fotos de Tarefas - Exclusão Autenticada"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'task-photos'
    AND auth.role() = 'authenticated'
);
