-- Linhas adicionais: Solo Grampeado, FT = NA, Eng. João Lucas
-- IDs: SOLO_GRAMPEADO_<oae sem espaços>_NA (espaços no corte viram _ só no id)

INSERT INTO public.monitoring_rows (id, service, oae, apoio, responsible, daily_data)
VALUES
  ('SOLO_GRAMPEADO_CS09_NA', 'SOLO GRAMPEADO', 'CS09', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_PRAÇA26_NA', 'SOLO GRAMPEADO', 'PRAÇA26', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_CS07XP_NA', 'SOLO GRAMPEADO', 'CS07XP', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_CS24_NA', 'SOLO GRAMPEADO', 'CS24', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_CD26_NA', 'SOLO GRAMPEADO', 'CD26', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_CS21-R1_NA', 'SOLO GRAMPEADO', 'CS21-R1', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_CS03_NA', 'SOLO GRAMPEADO', 'CS03', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_CD34_NA', 'SOLO GRAMPEADO', 'CD34', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_PRACA27_NA', 'SOLO GRAMPEADO', 'PRACA27', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_TD27_NA', 'SOLO GRAMPEADO', 'TD27', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_D20_P3_NA', 'SOLO GRAMPEADO', 'D20 P3', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_D20_P5_NA', 'SOLO GRAMPEADO', 'D20 P5', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_D21_P3_NA', 'SOLO GRAMPEADO', 'D21 P3', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_D21_P4_NA', 'SOLO GRAMPEADO', 'D21 P4', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_CD29_NA', 'SOLO GRAMPEADO', 'CD29', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_CS10XP_NA', 'SOLO GRAMPEADO', 'CS10XP', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_D15_NA', 'SOLO GRAMPEADO', 'D15', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_D18_NA', 'SOLO GRAMPEADO', 'D18', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_D19_NA', 'SOLO GRAMPEADO', 'D19', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_D22_NA', 'SOLO GRAMPEADO', 'D22', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_S01_NA', 'SOLO GRAMPEADO', 'S01', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_TD25_NA', 'SOLO GRAMPEADO', 'TD25', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_TS02_NA', 'SOLO GRAMPEADO', 'TS02', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_TS03_NA', 'SOLO GRAMPEADO', 'TS03', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_TS05_NA', 'SOLO GRAMPEADO', 'TS05', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_TS11_NA', 'SOLO GRAMPEADO', 'TS11', 'NA', 'João Lucas', '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  service = EXCLUDED.service,
  oae = EXCLUDED.oae,
  apoio = EXCLUDED.apoio,
  responsible = EXCLUDED.responsible;
