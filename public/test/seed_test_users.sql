-- =====================================================================
-- TEST: Crear 10 usuarios fake + pronósticos random para los 72 partidos
-- NO incorporar a producción. Ejecutar en Supabase SQL Editor.
-- =====================================================================

-- 1. Insertar 10 usuarios fake en auth.users primero (para satisfacer FK)
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
values
  ('a0000001-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','carlos@test.com',crypt('TestPass123!',gen_salt('bf')),now(),now(),now(),'authenticated','authenticated'),
  ('a0000001-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','maria@test.com',crypt('TestPass123!',gen_salt('bf')),now(),now(),now(),'authenticated','authenticated'),
  ('a0000001-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','juan@test.com',crypt('TestPass123!',gen_salt('bf')),now(),now(),now(),'authenticated','authenticated'),
  ('a0000001-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','lucia@test.com',crypt('TestPass123!',gen_salt('bf')),now(),now(),now(),'authenticated','authenticated'),
  ('a0000001-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','diego@test.com',crypt('TestPass123!',gen_salt('bf')),now(),now(),now(),'authenticated','authenticated'),
  ('a0000001-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','vale@test.com',crypt('TestPass123!',gen_salt('bf')),now(),now(),now(),'authenticated','authenticated'),
  ('a0000001-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000000','tomas@test.com',crypt('TestPass123!',gen_salt('bf')),now(),now(),now(),'authenticated','authenticated'),
  ('a0000001-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000000','sofia@test.com',crypt('TestPass123!',gen_salt('bf')),now(),now(),now(),'authenticated','authenticated'),
  ('a0000001-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000000','nicolas@test.com',crypt('TestPass123!',gen_salt('bf')),now(),now(),now(),'authenticated','authenticated'),
  ('a0000001-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000000','camila@test.com',crypt('TestPass123!',gen_salt('bf')),now(),now(),now(),'authenticated','authenticated')
on conflict (id) do nothing;

-- 2. Insertar perfiles en public.users
insert into public.users (id, username, email, nombre, apellido) values
  ('a0000001-0000-0000-0000-000000000001', 'carlos_gol',   'carlos@test.com',   'Carlos',   'López'),
  ('a0000001-0000-0000-0000-000000000002', 'maria_fut',    'maria@test.com',    'María',    'García'),
  ('a0000001-0000-0000-0000-000000000003', 'juancho10',    'juan@test.com',     'Juan',     'Martínez'),
  ('a0000001-0000-0000-0000-000000000004', 'lu_predice',   'lucia@test.com',    'Lucía',    'Fernández'),
  ('a0000001-0000-0000-0000-000000000005', 'diegote',      'diego@test.com',    'Diego',    'Rodríguez'),
  ('a0000001-0000-0000-0000-000000000006', 'vale_mundial', 'vale@test.com',     'Valentina','Pérez'),
  ('a0000001-0000-0000-0000-000000000007', 'tomi_crack',   'tomas@test.com',    'Tomás',    'Sánchez'),
  ('a0000001-0000-0000-0000-000000000008', 'sofi_prode',   'sofia@test.com',    'Sofía',    'Ramírez'),
  ('a0000001-0000-0000-0000-000000000009', 'nico_bet',     'nicolas@test.com',  'Nicolás',  'Torres'),
  ('a0000001-0000-0000-0000-000000000010', 'cami_score',   'camila@test.com',   'Camila',   'Díaz')
on conflict (id) do nothing;

-- 2. Insertar pronósticos random (1/X/2) para cada usuario × cada partido
--    Desactivamos temporalmente el trigger de secuencialidad
alter table public.predictions disable trigger predictions_sequential;
alter table public.predictions disable trigger predictions_no_update;

insert into public.predictions (user_id, match_id, predicted_result)
select
  u.id,
  m.id,
  (array['1','X','2'])[1 + floor(random()*3)::int]
from public.users u
cross join public.matches m
where u.id in (
  'a0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000002',
  'a0000001-0000-0000-0000-000000000003',
  'a0000001-0000-0000-0000-000000000004',
  'a0000001-0000-0000-0000-000000000005',
  'a0000001-0000-0000-0000-000000000006',
  'a0000001-0000-0000-0000-000000000007',
  'a0000001-0000-0000-0000-000000000008',
  'a0000001-0000-0000-0000-000000000009',
  'a0000001-0000-0000-0000-000000000010'
)
on conflict (user_id, match_id) do nothing;

-- Reactivar trigger
alter table public.predictions enable trigger predictions_sequential;
alter table public.predictions enable trigger predictions_no_update;

-- 3. Recalcular puntos por si hay partidos finalizados
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
