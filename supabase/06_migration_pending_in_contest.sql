-- =====================================================================
-- MIGRACIÓN: Pending predictions participan del concurso sin usuario asignado
-- =====================================================================

-- 1. Modificar get_all_predictions para incluir pending_predictions no asignadas
create or replace function public.get_all_predictions()
returns table (user_id uuid, username text, match_id integer, match_order integer, predicted_result text)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
    -- Predicciones normales (usuarios asignados)
    select p.user_id, u.username, p.match_id, m.match_order, p.predicted_result
    from public.predictions p
    join public.users u on u.id = p.user_id
    join public.matches m on m.id = p.match_id

    union all

    -- Pending predictions sin asignar (participan con su label como nombre)
    select 
      uuid_generate_v5('00000000-0000-0000-0000-000000000000'::uuid, pp.label) as user_id,
      pp.label as username,
      pp.match_id,
      m.match_order,
      pp.predicted_result
    from public.pending_predictions pp
    join public.matches m on m.id = pp.match_id
    where pp.assigned_to is null

    order by username, match_order;
end;
$$;

-- 2. Crear vista/función para ranking que incluya pending predictions no asignadas
create or replace function public.get_full_ranking()
returns table (user_id uuid, username text, total_points bigint, is_pending boolean)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
    -- Usuarios reales
    select u.id as user_id, u.username, u.total_points::bigint, false as is_pending
    from public.users u
    where u.is_approved = true

    union all

    -- Pending predictions no asignadas
    select
      uuid_generate_v5('00000000-0000-0000-0000-000000000000'::uuid, pp.label) as user_id,
      pp.label as username,
      count(*) filter (
        where pp.predicted_result = m.actual_result and m.status = 'finished'
      ) as total_points,
      true as is_pending
    from public.pending_predictions pp
    join public.matches m on m.id = pp.match_id
    where pp.assigned_to is null
    group by pp.label

    order by total_points desc, username;
end;
$$;

-- 3. Asegurar que uuid-ossp está habilitado (necesario para uuid_generate_v5)
create extension if not exists "uuid-ossp";
