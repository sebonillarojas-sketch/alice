-- ALICE · rental_comps — comparables de alquiler para el módulo Cotización
-- ────────────────────────────────────────────────────────────────────────────
-- Sirve a la sección "Retorno" de la Cotización: alquiler tradicional de la
-- zona vs. corta estadía (Airbnb, Wynwood House, etc). Data 100% real cargada
-- a mano por comercial/José a partir de listings que efectivamente miraron —
-- NUNCA estimaciones inventadas (ver CLAUDE.md: "cero data falsa/hardcodeada").
--
-- Dos formas de cargar un comparable:
--   - Alquiler tradicional: monthly_rent (mensual directo)
--   - Corta estadía (Airbnb/Wynwood House): daily_rate + occupancy_pct
--     (revenue mensual estimado = daily_rate * occupancy_pct/100 * 30, lo
--     calcula el frontend — acá solo se guarda el dato crudo observado)
--
-- CÓMO CORRERLO: Supabase Dashboard → SQL Editor → pegar todo → Run.
-- Es idempotente (create if not exists / drop policy if exists). Seguro re-correrlo.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.rental_comps (
  id             text primary key,
  district       text not null,
  tipologia      text,
  source         text not null default 'alquiler_tradicional', -- alquiler_tradicional | airbnb | wynwood_house
  currency       text not null default 'PEN',
  monthly_rent   numeric,      -- alquiler tradicional: S/ o USD por mes
  daily_rate     numeric,      -- corta estadía: tarifa por noche observada
  occupancy_pct  numeric,      -- corta estadía: ocupación estimada 0-100 (dato observado, no inventado)
  area_m2        numeric,
  url            text,
  notes          text,
  entered_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_rental_comps_district on public.rental_comps (district);
create index if not exists idx_rental_comps_source   on public.rental_comps (source);

-- ── RLS · mismo criterio que tasks/terrenos: todo el equipo autenticado lee y escribe ──
alter table public.rental_comps enable row level security;

drop policy if exists "team_read_rental_comps"   on public.rental_comps;
drop policy if exists "team_insert_rental_comps" on public.rental_comps;
drop policy if exists "team_update_rental_comps" on public.rental_comps;
drop policy if exists "team_delete_rental_comps" on public.rental_comps;

create policy "team_read_rental_comps"   on public.rental_comps for select to authenticated using (true);
create policy "team_insert_rental_comps" on public.rental_comps for insert to authenticated with check (true);
create policy "team_update_rental_comps" on public.rental_comps for update to authenticated using (true) with check (true);
create policy "team_delete_rental_comps" on public.rental_comps for delete to authenticated using (true);
