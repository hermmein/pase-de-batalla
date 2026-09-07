# Pase de Batalla — Sistema de Economía de Fichas

App web para registrar tus conductas diarias, ver progreso acumulado hacia 5 hitos,
historial semanal con gráficos, rachas y recordatorios push a las 8:00 PM.
Protegida con contraseña.

Ciclo configurado: **6 sept 2026 → 12 dic 2026**.

### Cómo funciona el registro

- Puedes registrar **hoy o hasta 3 días atrás** (pestañas de fecha arriba del formulario),
  por si algún día no alcanzaste a anotar tus puntos.
- Cada día entre semana (lun-vie) la app pregunta si fue **día de ejercicio** o **día de
  descanso**:
  - Día de ejercicio → 3 conductas x **1 punto** c/u (ejercicio, 2 comidas, plan nutricional).
  - Día de descanso → 2 conductas x **1.5 puntos** c/u (2 comidas, plan nutricional). Sin
    conducta de ejercicio ese día.
  - Máximo **2 días de descanso por semana** (lun-vie): en cuanto los usas, los días
    restantes de esa semana quedan asignados automáticamente como día de ejercicio.
  - Sábado y domingo siempre son día de descanso, no se pregunta.
  - El máximo diario siempre es 3 puntos, sea cual sea el tipo de día.

## Arquitectura (desplegada en Netlify)

Esta app corre **sin servidor propio** (no depende de que tu PC esté encendida):

| Pieza | Tecnología |
|---|---|
| Frontend | HTML/CSS/JS estático en `public/` (PWA instalable) |
| Backend | Netlify Functions (JavaScript) en `netlify/functions/` |
| Base de datos | Netlify Blobs (incluido gratis en Netlify, sin cuenta externa) |
| Recordatorio 8 PM | Netlify Scheduled Function (`netlify/functions/reminder.js`), cron `0 2 * * *` UTC = 8:00 PM Guatemala (UTC-6 fijo, sin horario de verano) |
| Autenticación | Cookie firmada con HMAC (sin sesiones de servidor) |
| Hosting | Netlify (plan gratuito, sin tarjeta) |

La lógica de negocio (hitos, streak, reglas de día de ejercicio/descanso) vive en
[netlify/functions/lib/domain.js](netlify/functions/lib/domain.js) — es el equivalente
directo de lo que antes estaba en `config.py` y `app.py`.

### Estructura del proyecto

```
pase-de-batalla/
  netlify.toml              # config de build/redirects de Netlify
  package.json               # dependencias de las funciones (web-push, @netlify/blobs)
  netlify/functions/
    lib/domain.js             # fechas del ciclo, hitos, reglas de ejercicio/descanso, streak
    lib/store.js               # lectura/escritura en Netlify Blobs
    lib/auth.js                 # cookie de sesión firmada (HMAC)
    lib/password.js              # verificación del hash de contraseña (scrypt)
    login.js, logout.js           # POST /api/login, /api/logout
    state.js                       # GET /api/state (datos de la página "Hoy")
    log.js                          # POST /api/log (guardar registro diario)
    history.js                       # GET /api/history (historial semanal + streak)
    subscribe.js, unsubscribe.js      # POST /api/subscribe, /api/unsubscribe
    reminder.js                        # Scheduled Function: recordatorio 8 PM
  public/
    index.html, login.html, historial.html
    manifest.json, sw.js
    css/style.css, js/app.js
  scripts/
    generate_password_hash.py  # genera APP_PASSWORD_HASH (Python, sin instalar nada nuevo)
    generate_secret.py          # genera SESSION_SECRET
  generate_vapid_keys.py     # genera VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (ya existía)
```

### Variables de entorno (se configuran en Netlify, no en un archivo `.env`)

| Variable | Cómo generarla |
|---|---|
| `APP_PASSWORD_HASH` | `python scripts/generate_password_hash.py` |
| `SESSION_SECRET` | `python scripts/generate_secret.py` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `python generate_vapid_keys.py` |
| `VAPID_CLAIM_EMAIL` | tu correo, formato `mailto:tu-correo@ejemplo.com` |

### Editar hitos, fechas o reglas de ejercicio

Todo el ciclo, las conductas, los 5 hitos, `RETROACTIVE_DAYS` y `REST_DAYS_MAX_PER_WEEK`
están en [netlify/functions/lib/domain.js](netlify/functions/lib/domain.js) — edítalos
ahí y vuelve a desplegar (con Git conectado, un simple `git push` re-despliega solo).

### Cambiar la contraseña o la hora del recordatorio

- Contraseña: corre `python scripts/generate_password_hash.py` de nuevo y reemplaza
  `APP_PASSWORD_HASH` en las variables de entorno de Netlify (Site settings → Environment
  variables), luego re-despliega.
- Hora del recordatorio: edita el `schedule` en
  [netlify/functions/reminder.js](netlify/functions/reminder.js). Recuerda que Guatemala es
  siempre UTC-6, así que `hora_utc = (hora_guatemala + 6) % 24`.

## Uso local de la app Flask original (opcional, referencia)

La versión Flask original (`app.py`, `models.py`, `templates/`, `static/`) se mantiene
en el proyecto sin cambios, por si quieres seguir probando en tu PC con SQLite antes de
tocar la versión de Netlify. Ver instrucciones en la sección siguiente.

```bash
cd pase-de-batalla
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python generate_vapid_keys.py
python generate_password.py
python app.py
```

Abre `http://localhost:5000`. Esta versión no se despliega a Netlify (Netlify Functions
no soporta Python) — es solo para pruebas locales. La versión que se publica en internet
es la de `netlify/functions/` + `public/`.
