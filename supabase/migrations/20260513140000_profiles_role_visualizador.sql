-- Inclui o perfil Visualizador na constraint de profiles.role (cadastro + gestão de usuários)

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'Master',
    'Planejador',
    'Gerenciador',
    'Executor',
    'Visitante',
    'Visualizador'
  ));
