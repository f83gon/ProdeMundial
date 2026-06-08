-- =====================================================================
-- SEED: 72 partidos del Mundial 2026 (orden cronológico estricto)
-- =====================================================================
truncate public.matches restart identity cascade;

insert into public.matches (match_order, home_team, away_team, match_date, match_time, match_day) values
 (1,'MEXICO','SUDAFRICA','2026-06-11','16:00:00','Jueves'),
 (2,'COREA','REP. CHECA','2026-06-11','23:00:00','Jueves'),
 (3,'CANADA','BOSNIA','2026-06-12','16:00:00','Viernes'),
 (4,'ESTADOS UNIDOS','PARAGUAY','2026-06-12','22:00:00','Viernes'),
 (5,'QATAR','SUIZA','2026-06-13','16:00:00','Sábado'),
 (6,'BRASIL','MARRUECOS','2026-06-13','19:00:00','Sábado'),
 (7,'HAITI','ESCOCIA','2026-06-13','22:00:00','Sábado'),
 (8,'AUSTRALIA','TURQUIA','2026-06-14','01:00:00','Domingo'),
 (9,'ALEMANIA','CURAZAO','2026-06-14','14:00:00','Domingo'),
 (10,'PAISES BAJOS','JAPON','2026-06-14','17:00:00','Domingo'),
 (11,'COSTA DE MARFIL','ECUADOR','2026-06-14','20:00:00','Domingo'),
 (12,'SUECIA','TUNEZ','2026-06-14','23:00:00','Domingo'),
 (13,'ESPAÑA','CABO VERDE','2026-06-15','13:00:00','Lunes'),
 (14,'BELGICA','EGIPTO','2026-06-15','16:00:00','Lunes'),
 (15,'ARABIA SAUDITA','URUGUAY','2026-06-15','19:00:00','Lunes'),
 (16,'IRAN','NUEVA ZELANDA','2026-06-15','22:00:00','Lunes'),
 (17,'FRANCIA','SENEGAL','2026-06-16','16:00:00','Martes'),
 (18,'IRAK','NORUEGA','2026-06-16','19:00:00','Martes'),
 (19,'ARGENTINA','ARGELIA','2026-06-16','22:00:00','Martes'),
 (20,'AUSTRIA','JORDANIA','2026-06-17','01:00:00','Miércoles'),
 (21,'PORTUGAL','CONGO','2026-06-17','14:00:00','Miércoles'),
 (22,'INGLATERRA','CROACIA','2026-06-17','17:00:00','Miércoles'),
 (23,'GHANA','PANAMA','2026-06-17','20:00:00','Miércoles'),
 (24,'UZBEKISTAN','COLOMBIA','2026-06-17','23:00:00','Miércoles'),
 (25,'SUDAFRICA','REP. CHECA','2026-06-18','13:00:00','Jueves'),
 (26,'BOSNIA','SUIZA','2026-06-18','16:00:00','Jueves'),
 (27,'CANADA','QATAR','2026-06-18','19:00:00','Jueves'),
 (28,'MEXICO','COREA','2026-06-18','22:00:00','Jueves'),
 (29,'ESTADOS UNIDOS','AUSTRALIA','2026-06-19','16:00:00','Viernes'),
 (30,'ESCOCIA','MARRUECOS','2026-06-19','19:00:00','Viernes'),
 (31,'BRASIL','HAITI','2026-06-19','22:00:00','Viernes'),
 (32,'TURQUIA','PARAGUAY','2026-06-20','01:00:00','Sábado'),
 (33,'PAISES BAJOS','SUECIA','2026-06-20','14:00:00','Sábado'),
 (34,'ALEMANIA','COSTA DE MARFIL','2026-06-20','17:00:00','Sábado'),
 (35,'ECUADOR','CURAZAO','2026-06-20','21:00:00','Sábado'),
 (36,'TUNEZ','JAPON','2026-06-21','01:00:00','Domingo'),
 (37,'ESPAÑA','ARABIA SAUDITA','2026-06-21','13:00:00','Domingo'),
 (38,'BELGICA','IRAN','2026-06-21','16:00:00','Domingo'),
 (39,'URUGUAY','CABO VERDE','2026-06-21','19:00:00','Domingo'),
 (40,'NUEVA ZELANDA','EGIPTO','2026-06-21','22:00:00','Domingo'),
 (41,'ARGENTINA','AUSTRIA','2026-06-22','14:00:00','Lunes'),
 (42,'FRANCIA','IRAK','2026-06-22','18:00:00','Lunes'),
 (43,'NORUEGA','SENEGAL','2026-06-22','21:00:00','Lunes'),
 (44,'JORDANIA','ARGELIA','2026-06-22','23:59:00','Lunes'),
 (45,'PORTUGAL','UZBEKISTAN','2026-06-23','14:00:00','Martes'),
 (46,'INGLATERRA','GHANA','2026-06-23','17:00:00','Martes'),
 (47,'PANAMA','CROACIA','2026-06-23','20:00:00','Martes'),
 (48,'COLOMBIA','CONGO','2026-06-23','23:00:00','Martes'),
 (49,'SUIZA','CANADA','2026-06-24','16:00:00','Miércoles'),
 (50,'BOSNIA','QATAR','2026-06-24','16:00:00','Miércoles'),
 (51,'ESCOCIA','BRASIL','2026-06-24','19:00:00','Miércoles'),
 (52,'MARRUECOS','HAITI','2026-06-24','19:00:00','Miércoles'),
 (53,'REP. CHECA','MEXICO','2026-06-24','22:00:00','Miércoles'),
 (54,'SUDAFRICA','COREA','2026-06-24','22:00:00','Miércoles'),
 (55,'ECUADOR','ALEMANIA','2026-06-25','17:00:00','Jueves'),
 (56,'CURAZAO','COSTA DE MARFIL','2026-06-25','17:00:00','Jueves'),
 (57,'TUNEZ','PAISES BAJOS','2026-06-25','20:00:00','Jueves'),
 (58,'JAPON','SUECIA','2026-06-25','20:00:00','Jueves'),
 (59,'TURQUIA','ESTADOS UNIDOS','2026-06-26','01:00:00','Viernes'),
 (60,'PARAGUAY','AUSTRALIA','2026-06-26','01:00:00','Viernes'),
 (61,'NORUEGA','FRANCIA','2026-06-26','16:00:00','Viernes'),
 (62,'SENEGAL','IRAK','2026-06-26','16:00:00','Viernes'),
 (63,'URUGUAY','ESPAÑA','2026-06-26','21:00:00','Viernes'),
 (64,'CABO VERDE','ARABIA SAUDITA','2026-06-26','21:00:00','Viernes'),
 (65,'NUEVA ZELANDA','BELGICA','2026-06-26','23:59:00','Viernes'),
 (66,'EGIPTO','IRAN','2026-06-26','23:59:00','Viernes'),
 (67,'PANAMA','INGLATERRA','2026-06-27','18:00:00','Sábado'),
 (68,'CROACIA','GHANA','2026-06-27','18:00:00','Sábado'),
 (69,'COLOMBIA','PORTUGAL','2026-06-27','20:30:00','Sábado'),
 (70,'CONGO','UZBEKISTAN','2026-06-27','20:30:00','Sábado'),
 (71,'JORDANIA','ARGENTINA','2026-06-28','01:00:00','Domingo'),
 (72,'ARGELIA','AUSTRIA','2026-06-28','01:00:00','Domingo');

-- =====================================================================
-- ADMIN: marcar usuario admin después de que se registre con email
-- f83gon@gmail.com (username: Panchiz, contraseña: Pirulaxia2026).
-- Ejecutar DESPUÉS de que el usuario se haya registrado vía la app,
-- o insertar manualmente si auth.users ya existe:
-- =====================================================================
-- Fallback: si el usuario ya existe en auth.users, asegurar que tenga
-- perfil en public.users y marcarlo como admin.
insert into public.users (id, username, email, nombre, apellido, is_admin)
select id, 'Panchiz', 'f83gon@gmail.com', 'Francisco', 'Gonzalez', true
from auth.users where email = 'f83gon@gmail.com'
on conflict (id) do update set
  nombre = 'Francisco',
  apellido = 'Gonzalez',
  is_admin = true;
