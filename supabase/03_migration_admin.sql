-- =====================================================================
-- MIGRACIÓN: nombre/apellido en users, goles en matches, admin role
-- Ejecutar en Supabase SQL Editor DESPUÉS de 01_schema y 02_seed
-- =====================================================================

-- 1. Agregar nombre y apellido a users + campo is_admin
alter table public.users add column if not exists nombre text;
alter table public.users add column if not exists apellido text;
alter table public.users add column if not exists is_admin boolean not null default false;

-- 2. Agregar goles reales al partido (el admin carga esto)
alter table public.matches add column if not exists home_goals integer;
alter table public.matches add column if not exists away_goals integer;

-- 3. Actualizar el trigger de nuevo usuario para incluir nombre/apellido
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, username, email, nombre, apellido)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'apellido'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 4. Nuevo trigger: al finalizar partido, derivar actual_result de los goles
--    y recalcular puntos de TODOS los usuarios
create or replace function public.finish_match_and_recalc()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Solo actuar cuando el partido pasa a 'finished' y tiene goles cargados
  if new.status = 'finished' and new.home_goals is not null and new.away_goals is not null then
    -- Derivar actual_result de los goles
    if new.home_goals > new.away_goals then
      new.actual_result := '1';
    elsif new.away_goals > new.home_goals then
      new.actual_result := '2';
    else
      new.actual_result := 'X';
    end if;

    -- Recalcular total_points para TODOS los usuarios (simple y seguro)
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
  end if;
  return new;
end;
$$;

-- Reemplazar el trigger anterior
drop trigger if exists matches_recalc_points on public.matches;
create trigger matches_recalc_points
  before update on public.matches
  for each row
  when (new.status = 'finished')
  execute function public.finish_match_and_recalc();

-- 5. Policy para que el admin pueda actualizar partidos
create policy "matches_update_admin" on public.matches
  for update to authenticated
  using (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.users where id = auth.uid() and is_admin = true)
  );

-- 6. Crear / actualizar usuario admin "Panchiz"
--    (si ya existe en public.users, actualizar sus datos)
update public.users
set nombre = 'Francisco',
    apellido = 'Gonzalez',
    is_admin = true
where email = 'f83gon@gmail.com';

-- Si no existe aún, el admin se creará al loguearse con el trigger.
-- Pero dejamos este fallback por si acaso:
insert into public.users (id, username, email, nombre, apellido, is_admin)
select id, 'Panchiz', 'f83gon@gmail.com', 'Francisco', 'Gonzalez', true
from auth.users where email = 'f83gon@gmail.com'
on conflict (id) do update set
  nombre = 'Francisco',
  apellido = 'Gonzalez',
  is_admin = true;
