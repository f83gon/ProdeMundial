# Prode Mundial 2026 ⚽

PWA de pronósticos del Mundial 2026 con backend en **Supabase**.

## Stack
- React 18 + Vite + React Router
- Tailwind CSS
- Supabase (Postgres + Auth + RLS)
- vite-plugin-pwa (instalable en iOS/Android)
- Recharts

## Setup

### 1. Backend (Supabase)
1. Crear proyecto gratuito en https://supabase.com.
2. En **SQL Editor** ejecutar **en orden**:
   - `supabase/01_schema.sql`
   - `supabase/02_seed.sql`
3. En **Authentication → Providers** dejar habilitado *Email*. (Opcional: desactivar "Confirm email" para pruebas.)
4. Copiar **Project URL** y **anon public key** desde *Project Settings → API*.

### 2. Frontend
```powershell
cd c:\Users\fgonzalez\ProdeMundial
copy .env.example .env
# Editar .env y poner VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Abrir http://localhost:5173.

### 3. Cargar resultados (admin)
Para marcar un partido como finalizado y disparar el recálculo de puntos:

```sql
update public.matches
set actual_result = '1', status = 'finished'
where match_order = 1;
```
El trigger `matches_recalc_points` actualiza `users.total_points` automáticamente.

### 4. Build / Deploy
```powershell
npm run build
```
Subir la carpeta `dist/` a Vercel o Netlify (capa gratuita). El plugin PWA genera `manifest.webmanifest` y service worker.

## Reglas implementadas (resumen)
- **Auth obligatorio** (email + password). Trigger `handle_new_user` crea perfil en `public.users`.
- **Pronósticos privados**: RLS solo permite a cada usuario ver/insertar las suyas.
- **Inmutabilidad**: trigger `predictions_no_update` + ausencia de policy de UPDATE/DELETE.
- **Secuencialidad**: trigger `predictions_sequential` rechaza el pick #N si falta #N-1.
- **Puntos**: 1 acierto = 1 punto. Recalculado al cerrar un partido.
- **Amigos** bidireccionales (se insertan ambas filas).
- **Vista `match_consensus`** para Top 5 coincidentes / diferenciales sin exponer picks individuales.

## Notas
- Los grupos del simulador (`src/pages/Estadisticas.jsx`) se infirieron del fixture; ajustar si el sorteo oficial difiere.
- Para iconos PWA agregá `public/pwa-192x192.png` y `public/pwa-512x512.png` (cualquier PNG sirve para arrancar).
