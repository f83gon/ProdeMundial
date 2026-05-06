-- =====================================================================
-- PRODE MUNDIAL 2026 - SCHEMA + RLS + TRIGGERS
-- Ejecutar en Supabase SQL Editor (en este orden: 01_schema, 02_seed)
-- =====================================================================

-- Limpieza opcional (cuidado en prod)
drop table if exists public.predictions cascade;
drop table if exists public.friendships cascade;
drop table if exists public.matches cascade;
drop table if exists public.users cascade;

-- ---------------------------------------------------------------------
-- USERS (perfil público vinculado a auth.users)
-- ---------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text unique not null,
  nombre text,
  apellido text,
  is_admin boolean not null default false,
  is_approved boolean not null default false,
  total_points integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- MATCHES (72 partidos del fixture)
-- ---------------------------------------------------------------------
create table public.matches (
  id serial primary key,
  match_order integer unique not null check (match_order between 1 and 72),
  home_team text not null,
  away_team text not null,
  match_date date not null,
  match_time time not null,
  match_day text,
  home_goals integer,
  away_goals integer,
  actual_result text check (actual_result in ('1','X','2')),
  status text not null default 'pending' check (status in ('pending','in_progress','finished'))
);

-- ---------------------------------------------------------------------
-- PREDICTIONS (1 por usuario por partido, inmutables)
-- ---------------------------------------------------------------------
create table public.predictions (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  match_id integer not null references public.matches(id) on delete cascade,
  predicted_result text not null check (predicted_result in ('1','X','2')),
  created_at timestamptz not null default now(),
  unique (user_id, match_id)
);

-- ---------------------------------------------------------------------
-- FRIENDSHIPS (bidireccional: insertamos ambas filas)
-- ---------------------------------------------------------------------
create table public.friendships (
  user_id uuid not null references public.users(id) on delete cascade,
  friend_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Crear perfil en public.users al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, username, email, nombre, apellido, is_approved)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'apellido',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Inmutabilidad de predicciones: no permitir UPDATE
create or replace function public.prevent_prediction_update()
returns trigger language plpgsql as $$
begin
  raise exception 'Las predicciones son inmutables una vez guardadas.';
end;
$$;

drop trigger if exists predictions_no_update on public.predictions;
create trigger predictions_no_update
  before update on public.predictions
  for each row execute function public.prevent_prediction_update();

-- Validación secuencial: no se puede predecir match_order=N si falta N-1
create or replace function public.enforce_sequential_predictions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_order integer;
  v_prev_count integer;
begin
  select match_order into v_order from public.matches where id = new.match_id;
  if v_order is null then
    raise exception 'Partido inexistente';
  end if;
  if v_order > 1 then
    select count(*) into v_prev_count
    from public.predictions p
    join public.matches m on m.id = p.match_id
    where p.user_id = new.user_id and m.match_order < v_order;
    if v_prev_count < (v_order - 1) then
      raise exception 'Debés predecir los partidos anteriores antes del #%', v_order;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists predictions_sequential on public.predictions;
create trigger predictions_sequential
  before insert on public.predictions
  for each row execute function public.enforce_sequential_predictions();

-- Finalizar partido: derivar actual_result de goles y recalcular puntos
-- Usa dos funciones: BEFORE para setear actual_result, AFTER para recalcular puntos.

create or replace function public.derive_match_result()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'finished' and new.home_goals is not null and new.away_goals is not null then
    if new.home_goals > new.away_goals then
      new.actual_result := '1';
    elsif new.away_goals > new.home_goals then
      new.actual_result := '2';
    else
      new.actual_result := 'X';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.recalc_all_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.users u
  set total_points = coalesce(sub.pts, 0)
  from (
    select p.user_id,
           count(*) filter (
             where p.predicted_result = m.actual_result and m.status = 'finished'
           ) as pts
    from public.predictions p
    join public.matches m on m.id = p.match_id
    group by p.user_id
  ) sub
  where u.id = sub.user_id;
  return null;
end;
$$;

drop trigger if exists matches_recalc_points on public.matches;
drop trigger if exists matches_derive_result on public.matches;
drop trigger if exists matches_recalc_after on public.matches;

create trigger matches_derive_result
  before update on public.matches
  for each row
  when (new.status = 'finished')
  execute function public.derive_match_result();

create trigger matches_recalc_after
  after update on public.matches
  for each row
  when (new.status = 'finished')
  execute function public.recalc_all_points();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.users enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.friendships enable row level security;

-- USERS: cualquier autenticado lee (para ranking), solo el dueño actualiza su username
create policy "users_select_all" on public.users
  for select to authenticated using (true);
create policy "users_update_self" on public.users
  for update to authenticated using (auth.uid() = id);

-- MATCHES: lectura pública; updates solo admin
create policy "matches_select_all" on public.matches
  for select to authenticated using (true);
create policy "matches_update_admin" on public.matches
  for update to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

-- PREDICTIONS: cada usuario solo ve y crea las suyas (privacidad estricta)
create policy "predictions_select_own" on public.predictions
  for select to authenticated using (auth.uid() = user_id);
create policy "predictions_insert_own" on public.predictions
  for insert to authenticated with check (auth.uid() = user_id);
-- Sin policy de UPDATE/DELETE => inmutables vía RLS también

-- FRIENDSHIPS: el usuario gestiona sus propias relaciones
create policy "friendships_select_own" on public.friendships
  for select to authenticated using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "friendships_insert_own" on public.friendships
  for insert to authenticated with check (auth.uid() = user_id);
create policy "friendships_delete_own" on public.friendships
  for delete to authenticated using (auth.uid() = user_id);

-- =====================================================================
-- VISTA: agregados de consenso (sin exponer predicciones individuales)
-- =====================================================================
create or replace view public.match_consensus as
select
  m.id as match_id,
  m.match_order,
  count(p.*) filter (where p.predicted_result = '1')::int as votes_1,
  count(p.*) filter (where p.predicted_result = 'X')::int as votes_x,
  count(p.*) filter (where p.predicted_result = '2')::int as votes_2,
  count(p.*)::int as votes_total
from public.matches m
left join public.predictions p on p.match_id = m.id
group by m.id, m.match_order;

grant select on public.match_consensus to authenticated;

-- =====================================================================
-- RPC: admin puede ver predicciones de todos para un partido
-- =====================================================================
create or replace function public.get_match_predictions(p_match_id integer)
returns table (user_id uuid, username text, predicted_result text)
language plpgsql
security definer set search_path = public
as $$
begin
  -- Solo admins pueden llamar esta función
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
  return query
    select p.user_id, u.username, p.predicted_result
    from public.predictions p
    join public.users u on u.id = p.user_id
    where p.match_id = p_match_id
    order by u.username;
end;
$$;

-- RPC: cualquier autenticado puede ver TODAS las predicciones (para matriz)
create or replace function public.get_all_predictions()
returns table (user_id uuid, username text, match_id integer, match_order integer, predicted_result text)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
    select p.user_id, u.username, p.match_id, m.match_order, p.predicted_result
    from public.predictions p
    join public.users u on u.id = p.user_id
    join public.matches m on m.id = p.match_id
    order by u.username, m.match_order;
end;
$$;

-- =====================================================================
-- PENDING PREDICTIONS (staging para importación Excel)
-- =====================================================================
create table if not exists public.pending_predictions (
  id bigserial primary key,
  label text not null,
  match_id integer not null references public.matches(id) on delete cascade,
  predicted_result text not null check (predicted_result in ('1','X','2')),
  created_at timestamptz not null default now(),
  assigned_to uuid references public.users(id) on delete set null
);

create index if not exists idx_pending_label on public.pending_predictions(label);

alter table public.pending_predictions enable row level security;

create policy "pending_select_admin" on public.pending_predictions
  for select to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));
create policy "pending_insert_admin" on public.pending_predictions
  for insert to authenticated
  with check (exists (select 1 from public.users where id = auth.uid() and is_admin = true));
create policy "pending_delete_admin" on public.pending_predictions
  for delete to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));
create policy "pending_update_admin" on public.pending_predictions
  for update to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

-- =====================================================================
-- RPC: Admin aprueba un usuario
-- =====================================================================
create or replace function public.approve_user(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
  update public.users set is_approved = true where id = p_user_id;
end;
$$;

-- =====================================================================
-- RPC: Admin asigna un set de pending_predictions a un usuario
-- =====================================================================
create or replace function public.assign_predictions(p_label text, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;

  select count(*) into v_count from public.predictions where user_id = p_user_id;
  if v_count > 0 then
    raise exception 'El usuario ya tiene % pronósticos cargados. Solo se puede asignar a usuarios sin pronósticos.', v_count;
  end if;

  select count(*) into v_count from public.pending_predictions where label = p_label;
  if v_count <> 72 then
    raise exception 'El set "%" tiene % pronósticos, se necesitan exactamente 72.', p_label, v_count;
  end if;

  alter table public.predictions disable trigger predictions_sequential;
  alter table public.predictions disable trigger predictions_no_update;

  insert into public.predictions (user_id, match_id, predicted_result)
  select p_user_id, pp.match_id, pp.predicted_result
  from public.pending_predictions pp
  where pp.label = p_label
  on conflict (user_id, match_id) do nothing;

  alter table public.predictions enable trigger predictions_sequential;
  alter table public.predictions enable trigger predictions_no_update;

  update public.pending_predictions set assigned_to = p_user_id where label = p_label;
end;
$$;

-- Policy: admin puede actualizar cualquier usuario (para aprobar)
create policy "users_update_admin" on public.users
  for update to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

-- =====================================================================
-- PUSH SUBSCRIPTIONS (para notificaciones PWA)
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

create policy "push_select_own" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);
create policy "push_insert_own" on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "push_delete_own" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);
create policy "push_select_admin" on public.push_subscriptions
  for select to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));
