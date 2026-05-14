-- Persiste o cargo escolhido no cadastro (user_metadata) em profiles.role.
-- Antes disto, handle_new_user gravava sempre 'Visitante', quebrando o fluxo do Visualizador
-- e exigindo edição manual no painel.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role text;
  final_role text;
BEGIN
  meta_role := NULLIF(trim(NEW.raw_user_meta_data->>'role'), '');

  IF meta_role IN (
    'Master',
    'Planejador',
    'Gerenciador',
    'Executor',
    'Visualizador',
    'Visitante'
  ) THEN
    final_role := meta_role;
  ELSE
    final_role := 'Visitante';
  END IF;

  INSERT INTO public.profiles (id, username, full_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
    final_role,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Corrige perfis já criados: ainda estavam como Visitante no banco mesmo com role nos metadados do Auth.
UPDATE public.profiles p
SET role = trim(u.raw_user_meta_data->>'role')
FROM auth.users u
WHERE u.id = p.id
  AND p.role = 'Visitante'
  AND trim(u.raw_user_meta_data->>'role') IN (
    'Master',
    'Planejador',
    'Gerenciador',
    'Executor',
    'Visualizador'
  );
