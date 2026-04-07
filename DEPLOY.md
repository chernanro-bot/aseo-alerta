# 🧹 Aseo Alerta — Guía de Deploy

> Tiempo estimado: ~45 minutos la primera vez.

---

## Arquitectura

```
Netlify (frontend React)
    ↕  REST API
Railway (backend Node.js)
    ↕  Supabase SDK
Supabase (BD + Auth)

WhatsApp → Kapso.ai
Pagos    → Toku
```

---

## PASO 1: Supabase (Base de datos + Auth)

1. Crea cuenta en **https://supabase.com** (gratis)
2. Crea un nuevo proyecto
3. Ve a **SQL Editor** y ejecuta el archivo:
   `supabase/migrations/001_initial_schema.sql`
4. Ve a **Authentication → Email Templates** y personaliza el Magic Link en español
5. Ve a **Project Settings → API** y anota:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Solo para el backend

### Auth: habilitar Magic Link

En **Authentication → Providers → Email**:
- ✅ Enable Email provider
- ✅ Enable Magic link (OTP)
- En **Site URL**: pon tu URL de Netlify (ej: `https://aseo-alerta.netlify.app`)
- En **Redirect URLs**: agrega `https://tu-app.netlify.app/auth/callback`

---

## PASO 2: Backend en Railway

1. Crea cuenta en **https://railway.app**
2. Nuevo proyecto → Deploy from GitHub → Sube el código
3. En **Settings → Variables**, agrega:

```env
PORT=4000
NODE_ENV=production
ENABLE_CRON=true

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

FRONTEND_URL=https://tu-app.netlify.app

# Dejar vacío por ahora, configurar cuando tengas Kapso
KAPSO_API_KEY=
KAPSO_PHONE_ID=

# Dejar vacío por ahora, configurar cuando tengas Toku
TOKU_API_KEY=
TOKU_PLAN_ID=
TOKU_WEBHOOK_SECRET=

CRON_SECRET=genera_una_clave_aleatoria_segura
```

4. Railway desplegará automáticamente. Anota la URL del servicio (ej: `https://aseo-alerta.railway.app`)
5. Verifica que funciona: `https://tu-backend.railway.app/health`

---

## PASO 3: Frontend en Netlify

### Opción A: Conectar con el sitio existente (lighthearted-lolly-9248da.netlify.app)

1. Ve a tu sitio en Netlify
2. **Site settings → Build & deploy → Continuous deployment**
3. Conecta tu repo de GitHub
4. En **Build settings**:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`

### Variables de entorno en Netlify:
En **Site settings → Environment variables**, agrega:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://tu-backend.railway.app/api
```

5. Redeploy el sitio

---

## PASO 4: Kapso.ai (WhatsApp)

1. Crea cuenta en **https://kapso.ai**
2. Conecta tu número de WhatsApp Business
3. Obtén en el dashboard:
   - `API Key` → `KAPSO_API_KEY` en Railway
   - `Phone ID` → `KAPSO_PHONE_ID` en Railway
4. Redeploy el backend en Railway

---

## PASO 5: Toku (Pagos)

1. Crea cuenta en **https://toku.cl**
2. Crea un plan de suscripción mensual de $9.990 CLP
3. Anota el `Plan ID`
4. Obtén tu `API Key` de producción
5. En el dashboard de Toku, registra el webhook:
   - URL: `https://tu-backend.railway.app/api/subscription/webhook`
   - Eventos: `subscription.activated`, `subscription.canceled`, `payment.succeeded`
6. Anota el `Webhook Secret`
7. Actualiza las variables en Railway:
   ```env
   TOKU_API_KEY=tk_...
   TOKU_PLAN_ID=plan_...
   TOKU_WEBHOOK_SECRET=whsec_...
   ```

---

## PASO 6: Verificación final

- [ ] Login con magic link funciona
- [ ] Puedes agregar una propiedad
- [ ] El calendario iCal se sincroniza
- [ ] Aparecen las reservas
- [ ] El WhatsApp llega al número del encargado
- [ ] El pago con Toku procesa correctamente
- [ ] Las alertas de pre-checkout se envían al día anterior

---

## Estructura de archivos

```
aseo-alerta/
├── frontend/           ← React + Vite + Tailwind (Netlify)
│   ├── src/
│   │   ├── pages/      ← Vistas de la app
│   │   ├── components/ ← Componentes reutilizables
│   │   ├── lib/        ← Supabase client + API client
│   │   └── App.jsx
│   ├── netlify.toml
│   └── .env.example
│
├── backend/            ← Node.js + Express (Railway)
│   ├── src/
│   │   ├── routes/     ← properties.js, subscription.js
│   │   ├── services/   ← ical.js, whatsapp.js, sync.js, cron.js
│   │   ├── middleware/ ← auth.js (JWT verificación)
│   │   └── index.js
│   ├── railway.toml
│   └── .env.example
│
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## Cron Jobs

| Job | Horario | Qué hace |
|-----|---------|----------|
| Sincronización | 06:00 AM Chile | Parsea todos los iCal y detecta nuevas reservas |
| Pre-checkout | 09:00 AM Chile | Envía WhatsApp para checkouts del día siguiente |

---

## Soporte

¿Problemas? Revisa los logs en:
- **Railway** → Tu servicio → Deployments → View Logs
- **Supabase** → Logs → API Logs

---

*Aseo Alerta v1.0 · Precio de lanzamiento $9.990/mes*
