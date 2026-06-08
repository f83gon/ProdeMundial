-- =====================================================================
-- MIGRACIÓN: Sistema de aprobación de usuarios + pronósticos pendientes
-- Ejecutar en Supabase SQL Editor después de 01_schema + 02_seed
-- =====================================================================

-- 1. Agregar columna is_approved a users (admin auto-aprobado)
alter table public.users add column if not exists is_approved boolean not null default false;

-- Aprobar automáticamente al admin existente
update public.users set is_approved = true where is_admin = true;

-- Actualizar el trigger de registro para que nuevos usuarios NO estén aprobados
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

-- 2. Tabla de pronósticos pendientes (staging para importación Excel)
create table if not exists public.pending_predictions (
  id bigserial primary key,
  label text not null, -- nombre descriptivo del set (ej: "Pronóstico Juan Excel")
  match_id integer not null references public.matches(id) on delete cascade,
  predicted_result text not null check (predicted_result in ('1','X','2')),
  created_at timestamptz not null default now(),
  assigned_to uuid references public.users(id) on delete set null -- null = sin asignar
);

-- Índice para buscar por label rápido
create index if not exists idx_pending_label on public.pending_predictions(label);

-- RLS para pending_predictions: solo admin
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

-- 3. RPC: Admin aprueba un usuario
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

-- 4. RPC: Admin asigna un set de pending_predictions a un usuario
--    Copia los pronósticos del set al usuario, deshabilitando triggers de secuencialidad/inmutabilidad
create or replace function public.assign_predictions(p_label text, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  -- Solo admin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;

  -- Verificar que el usuario no tenga pronósticos ya cargados
  select count(*) into v_count from public.predictions where user_id = p_user_id;
  if v_count > 0 then
    raise exception 'El usuario ya tiene % pronósticos cargados. Solo se puede asignar a usuarios sin pronósticos.', v_count;
  end if;

  -- Verificar que el set tenga exactamente 72 pronósticos
  select count(*) into v_count from public.pending_predictions where label = p_label;
  if v_count <> 72 then
    raise exception 'El set "%" tiene % pronósticos, se necesitan exactamente 72.', p_label, v_count;
  end if;

  -- Insertar predicciones (bypass de triggers via security definer)
  -- Desactivamos triggers temporalmente
  alter table public.predictions disable trigger predictions_sequential;
  alter table public.predictions disable trigger predictions_no_update;

  insert into public.predictions (user_id, match_id, predicted_result)
  select p_user_id, pp.match_id, pp.predicted_result
  from public.pending_predictions pp
  where pp.label = p_label
  on conflict (user_id, match_id) do nothing;

  alter table public.predictions enable trigger predictions_sequential;
  alter table public.predictions enable trigger predictions_no_update;

  -- Marcar el set como asignado
  update public.pending_predictions set assigned_to = p_user_id where label = p_label;
end;
$$;

-- 5. Permitir al admin actualizar is_approved de otros usuarios
-- Ya existe policy users_update_self; agregamos una para admin
create policy "users_update_admin" on public.users
  for update to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.users where id = auth.uid() and is_admin = true));
