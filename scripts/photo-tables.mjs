/**
 * Fonte única das tabelas que guardam URLs de foto.
 *
 * `tasks`, `baseline_tasks` e `current_schedule_tasks` têm coluna
 * `photos JSONB` (ver supabase/migrations/20260303_create_all_tables.sql).
 * Esquecer qualquer uma delas ao migrar significaria apagar do Supabase um
 * arquivo que ainda é referenciado — por isso a lista mora em um lugar só.
 */

export const PHOTO_TABLES = ['tasks', 'baseline_tasks', 'current_schedule_tasks'];

export const BUCKET = 'task-photos';
