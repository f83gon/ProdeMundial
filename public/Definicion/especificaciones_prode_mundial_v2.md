# Especificaciones Técnicas: Proyecto Prode Mundialista (PWA + BaaS)

Este documento contiene la definición completa de requerimientos y arquitectura para el desarrollo de una aplicación web progresiva (PWA) de pronósticos deportivos (Prode) para el Mundial. Está diseñado para ser procesado por una IA de desarrollo para generar el código correspondiente.

---

## 1. Arquitectura y Stack Tecnológico
- **Frontend:** Framework moderno (React, Vue o Svelte) configurado como **PWA** para instalación en iOS/Android sin tiendas de aplicaciones.
- **Backend/BaaS:** **Supabase** (preferido) o **Firebase**. 
    - **Base de Datos:** Relacional (PostgreSQL en el caso de Supabase) para gestionar integridad de predicciones.
    - **Autenticación:** Sistema obligatorio de registro y login con **Email y Contraseña**.
- **Hosting:** Vercel o Netlify (Capa gratuita).

---

## 2. Autenticación y Seguridad
- **Login Obligatorio:** Todo usuario debe registrarse y loguearse con Email y Contraseña. 
- **Pronósticos Únicos:** Cada pronóstico está estrictamente vinculado al `user_id` de la persona logueada. Es imposible ver o alterar las predicciones de otros usuarios, asegurando que cada sesión y progreso sea privado e intransferible.

---

## 3. Modelo de Datos (Esquema Sugerido)

### Tablas Principales:
1.  **`users`**: `id`, `username`, `email`, `total_points`.
2.  **`matches`**: `id`, `home_team`, `away_team`, `match_order` (1-72), `actual_result` (1, X, 2), `status` (pending/finished), `match_date`, `match_time`.
3.  **`predictions`**: `user_id`, `match_id`, `predicted_result` (1, X, 2), `created_at`.
4.  **`friendships`**: `user_id`, `friend_id` (Relación bidireccional).

---

## 4. Especificaciones de Pantallas y Funcionalidad

### A. Formulario de Predicciones (Core Loop)
- **Lógica Secuencial Estricta:** El usuario solo puede predecir el partido `n` si ya predijo el `n-1`. 
- **Validación:** No se puede saltar el orden cronológico definido por `match_order`.
- **Inmutabilidad:** Una vez guardado el resultado de un partido, el input queda bloqueado (Read-only). No hay edición posterior.
- **Estado Parcial:** Se debe permitir guardar el progreso para continuar luego desde el último partido pendiente.

### B. Pantalla de "Partidos"
- Listado vertical de todos los encuentros del mundial.
- Visualización de: Equipos, Fecha/Hora, Resultado Real (si terminó) o "Pendiente".

### C. Tabla de Posiciones (Global)
- Ranking descendente basado en `total_points` (1 punto por acierto).
- **UX:** Resaltar la fila del usuario actual con un color distintivo.
- **Sistema de Amigos:** Botón en la última columna para cada fila:
    - Si no es amigo: "Agregar Amigo" (Icono +).
    - Si ya es amigo: "Quitar" (Icono x).

### D. Pantalla de "Amigos"
- Clona la lógica de la Tabla Global pero aplica un filtro: `WHERE user_id IN (lista_de_amigos)`.

### E. Pantalla de "Estadísticas" (Dashboard Visual)
- **Distribución de Predicciones:** Gráfico de torta (Pie Chart) con el % de Local, Empate y Visitante elegidos por el usuario.
- **Simulador de Grupos:** Basado *únicamente* en las predicciones del usuario, mostrar cómo quedaría la tabla de puntos de cada grupo.
- **Nivel de Consenso:**
    - **Top 5 Coincidentes:** Los 5 partidos donde la elección del usuario coincide con el mayor % de la base total de jugadores.
    - **Top 5 Diferenciales:** Los 5 partidos donde el usuario eligió un resultado que muy poca gente eligió.
- **Rachas:**
    - **Racha Actual:** Contador de aciertos consecutivos desde el último partido jugado hacia atrás.
    - **Mejor Racha:** Récord histórico de aciertos seguidos del usuario.

---

## 5. Seed Data: Lista de 72 Partidos (Fixture)
A continuación se detallan los 72 partidos en orden cronológico estricto que deben insertarse en la tabla `matches` al inicializar la base de datos:

| Partido | Local | Visitante | Fecha | Hora | Día |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | MEXICO | SUDAFRICA | 11/06/26 | 16:00:00 | Jueves |
| 2 | COREA | REP. CHECA | 11/06/26 | 23:00:00 | Jueves |
| 3 | CANADA | BOSNIA | 12/06/26 | 16:00:00 | Viernes |
| 4 | ESTADOS | PARAGUAY | 12/06/26 | 22:00:00 | Viernes |
| 5 | QATAR | SUIZA | 13/06/26 | 16:00:00 | Sábado |
| 6 | BRASIL | MARRUECOS | 13/06/26 | 19:00:00 | Sábado |
| 7 | HAITI | ESCOCIA | 13/06/26 | 22:00:00 | Sábado |
| 8 | AUSTRALIA | TURQUIA | 14/06/26 | 01:00:00 | Domingo |
| 9 | ALEMANIA | CURAZAO | 14/06/26 | 14:00:00 | Domingo |
| 10 | PAISES BAJOS | JAPON | 14/06/26 | 17:00:00 | Domingo |
| 11 | COSTA DE MARFIL | ECUADOR | 14/06/26 | 20:00:00 | Domingo |
| 12 | SUECIA | TUNEZ | 14/06/26 | 23:00:00 | Domingo |
| 13 | ESPAÑA | CABO VERDE | 15/06/26 | 13:00:00 | Lunes |
| 14 | BELGICA | EGIPTO | 15/06/26 | 16:00:00 | Lunes |
| 15 | ARABIA SAUDITA | URUGUAY | 15/06/26 | 19:00:00 | Lunes |
| 16 | IRAN | NUEVA ZELANDA | 15/06/26 | 22:00:00 | Lunes |
| 17 | FRANCIA | SENEGAL | 16/06/26 | 16:00:00 | Martes |
| 18 | IRAK | NORUEGA | 16/06/26 | 19:00:00 | Martes |
| 19 | ARGENTINA | ARGELIA | 16/06/26 | 22:00:00 | Martes |
| 20 | AUSTRIA | JORDANIA | 17/06/26 | 01:00:00 | Miércoles |
| 21 | PORTUGAL | CONGO | 17/06/26 | 14:00:00 | Miércoles |
| 22 | INGLATERRA | CROACIA | 17/06/26 | 17:00:00 | Miércoles |
| 23 | GHANA | PANAMA | 17/06/26 | 20:00:00 | Miércoles |
| 24 | UZBEKISTAN | COLOMBIA | 17/06/26 | 23:00:00 | Miércoles |
| 25 | SUDAFRICA | REP. CHECA | 18/06/26 | 13:00:00 | Jueves |
| 26 | BOSNIA | SUIZA | 18/06/26 | 16:00:00 | Jueves |
| 27 | CANADA | QATAR | 18/06/26 | 19:00:00 | Jueves |
| 28 | MEXICO | COREA | 18/06/26 | 22:00:00 | Jueves |
| 29 | ESTADOS UNIDOS | AUSTRALIA | 19/06/26 | 16:00:00 | Viernes |
| 30 | ESCOCIA | MARRUECOS | 19/06/26 | 19:00:00 | Viernes |
| 31 | BRASIL | HAITI | 19/06/26 | 22:00:00 | Viernes |
| 32 | TURQUIA | PARAGUAY | 20/06/26 | 01:00:00 | Sábado |
| 33 | PAISES BAJOS | SUECIA | 20/06/26 | 14:00:00 | Sábado |
| 34 | ALEMANIA | COSTA DE MARFIL | 20/06/26 | 17:00:00 | Sábado |
| 35 | ECUADOR | CURAZAO | 20/06/26 | 21:00:00 | Sábado |
| 36 | TUNEZ | JAPON | 21/06/26 | 01:00:00 | Domingo |
| 37 | ESPAÑA | ARABIA SAUDITA | 21/06/26 | 13:00:00 | Domingo |
| 38 | BELGICA | IRAN | 21/06/26 | 16:00:00 | Domingo |
| 39 | URUGUAY | CABO VERDE | 21/06/26 | 19:00:00 | Domingo |
| 40 | NUEVA ZELANDA | EGIPTO | 21/06/26 | 22:00:00 | Domingo |
| 41 | ARGENTINA | AUSTRIA | 22/06/26 | 14:00:00 | Lunes |
| 42 | FRANCIA | IRAK | 22/06/26 | 18:00:00 | Lunes |
| 43 | NORUEGA | SENEGAL | 22/06/26 | 21:00:00 | Lunes |
| 44 | JORDANIA | ARGELIA | 22/06/26 | 23:59:00 | Lunes |
| 45 | PORTUGAL | UZBEKISTAN | 23/06/26 | 14:00:00 | Martes |
| 46 | INGLATERRA | GHANA | 23/06/26 | 17:00:00 | Martes |
| 47 | PANAMA | CROACIA | 23/06/26 | 20:00:00 | Martes |
| 48 | COLOMBIA | CONGO | 23/06/26 | 23:00:00 | Martes |
| 49 | SUIZA | CANADA | 24/06/26 | 16:00:00 | Miércoles |
| 50 | BOSNIA | QATAR | 24/06/26 | 16:00:00 | Miércoles |
| 51 | ESCOCIA | BRASIL | 24/06/26 | 19:00:00 | Miércoles |
| 52 | MARRUECOS | HAITI | 24/06/26 | 19:00:00 | Miércoles |
| 53 | REP. CHECA | MEXICO | 24/06/26 | 22:00:00 | Miércoles |
| 54 | SUDAFRICA | COREA | 24/06/26 | 22:00:00 | Miércoles |
| 55 | ECUADOR | ALEMANIA | 25/06/16 | 17:00:00 | Jueves |
| 56 | CURAZAO | COSTA DE MARFIL | 25/06/26 | 17:00:00 | Jueves |
| 57 | TUNEZ | PAISES BAJOS | 25/06/26 | 20:00:00 | Jueves |
| 58 | JAPON | SUECIA | 25/06/26 | 20:00:00 | Jueves |
| 59 | TURQUIA | ESTADOS UNIDOS | 26/06/26 | 01:00:00 | Viernes |
| 60 | PARAGUAY | AUSTRALIA | 26/06/26 | 01:00:00 | Viernes |
| 61 | NORUEGA | FRANCIA | 26/06/26 | 16:00:00 | Viernes |
| 62 | SENEGAL | IRAK | 26/06/26 | 16:00:00 | Viernes |
| 63 | URUGUAY | ESPAÑA | 26/06/26 | 21:00:00 | Viernes |
| 64 | CABO VERDE | ARABIA SAUDITA | 26/06/26 | 21:00:00 | Viernes |
| 65 | NUEVA ZELANDA | BELGICA | 26/06/26 | 23:59:00 | Viernes |
| 66 | EGIPTO | IRAN | 26/06/26 | 23:59:00 | Viernes |
| 67 | PANAMA | INGLATERRA | 27/06/26 | 18:00:00 | Sábado |
| 68 | CROACIA | GHANA | 27/06/26 | 18:00:00 | Sábado |
| 69 | COLOMBIA | PORTUGAL | 27/06/26 | 20:30:00 | Sábado |
| 70 | CONGO | UZBEKISTAN | 27/06/26 | 20:30:00 | Sábado |
| 71 | JORDANIA | ARGENTINA | 28/06/26 | 01:00:00 | Domingo |
| 72 | ARGELIA | AUSTRIA | 28/06/26 | 01:00:00 | Domingo |
