-- =====================================================================
-- MIGRACIÓN: Push Subscriptions para notificaciones PWA
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

-- Cada usuario gestiona sus propias suscripciones
create policy "push_select_own" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);
create policy "push_insert_own" on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "push_delete_own" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

-- Admin puede leer todas (para enviar notificaciones)
create policy "push_select_admin" on public.push_subscriptions
  for select to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));
