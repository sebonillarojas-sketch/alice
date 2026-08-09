-- Multi-asignación: agrega assignees[] a la tabla tasks y backfillea desde el single `assignee`.
-- Correr en el SQL Editor de Supabase. Idempotente (se puede correr más de una vez sin daño).
-- Invariante del sistema: assignee = assignees[0]. El ERP y Alicia ya escriben `assignees`;
-- esta columna es lo único que faltaba para que multi-asignación PERSISTA.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignees jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE tasks
SET assignees = to_jsonb(ARRAY[assignee])
WHERE (assignees IS NULL OR assignees = '[]'::jsonb)
  AND assignee IS NOT NULL;
