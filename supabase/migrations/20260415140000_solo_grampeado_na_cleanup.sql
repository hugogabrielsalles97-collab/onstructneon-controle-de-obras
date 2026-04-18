-- Solo Grampeado (NA): remove linhas duplicadas zeradas, renomeia CS09->CS09A, novos cortes

DELETE FROM public.monitoring_rows
WHERE id IN (
  'SOLO_GRAMPEADO_CD26_NA',
  'SOLO_GRAMPEADO_CD34_NA',
  'SOLO_GRAMPEADO_CS03_NA'
);

UPDATE public.monitoring_rows
SET id = 'SOLO_GRAMPEADO_CS09A_NA', oae = 'CS09A'
WHERE id = 'SOLO_GRAMPEADO_CS09_NA';

INSERT INTO public.monitoring_rows (id, service, oae, apoio, responsible, daily_data)
VALUES
  ('SOLO_GRAMPEADO_D20_P6_NA', 'SOLO GRAMPEADO', 'D20 P6', 'NA', 'João Lucas', '{}'::jsonb),
  ('SOLO_GRAMPEADO_S12_P5_NA', 'SOLO GRAMPEADO', 'S12 P5', 'NA', 'João Lucas', '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  service = EXCLUDED.service,
  oae = EXCLUDED.oae,
  apoio = EXCLUDED.apoio,
  responsible = EXCLUDED.responsible;
