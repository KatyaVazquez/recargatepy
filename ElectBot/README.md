# ElectBot — Inteligencia Electoral en Tiempo Real

Plataforma multi-tenant de inteligencia electoral en tiempo real para internas del partido. Cada municipio (tenant) opera con su propio bot de Telegram + PWA de contingencia + dashboard.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Supabase Pro** (Postgres + Auth + Realtime + RLS)
- **Vercel** (hosting único, subdominios wildcard)
- **Telegram Bot API** (webhook crudo, sin librería externa)
- **Tailwind v4 + shadcn/ui + next-themes** (dark mode). Polling propio y charts en CSS (sin libs de gráficos)

## Arquitectura

- **Padrón nacional ANR compartido** (2.8M electores, 263 distritos, 411 secciones) — read-only, una sola copia.
- **Tenant = municipio (distrito)**. El cliente es el comité ANR municipal. Cada tenant tiene su bot, panel admin, PWA y dashboard.
- **Jornadas** dentro de cada tenant, filtrables por sección. El estado del elector (Pendiente/Consultado/Voto) vive en `participaciones (jornada_id, ci_normalizado)`.
- **RLS estricto** aísla los datos por `tenant_id`.

## Documentación

- [`todo.md`](./todo.md) — plan completo en bloques y estado de avance.
- [`arquitectura_inteligencia_electoral_v2.txt`](./arquitectura_inteligencia_electoral_v2.txt) — especificación original del cliente.
- [`pdfs/`](./pdfs) — flujo global y guía de cliente (PDF).

## Roles

| Rol | Cómo opera |
|---|---|
| Mesa Guía | Escribe CI en Telegram → recibe local/mesa/orden + alertas |
| Veedor | Escribe CI en Telegram → marca "Votó" (atómico) + `CORREGIR <CI>` dentro de 7 min |
| Admin tenant | Comandos `/...` en bot + panel `/admin` |
| Candidato | Solo lee `/dashboard` |

## Estructura del repo

```
.
├── app/                  # Next.js App Router (login, admin, dashboard, pwa , api)
├── lib/                  # motor de reglas, clientes Supabase, helpers (ver AGENTS.md)
├── components/           # UI (shadcn/ui, theme)
├── proxy.ts              # resolución de tenant por subdominio + sesión (ex middleware)
├── supabase/migrations/  # esquema versionado (001–011)
├── scripts/              # migración del padrón + alta de admin/bot
├── pdfs/                 # documentos de flujo (PDF)
```

## Datos del padrón

Los DBFs originales (`ANR2026/`) **NO se versionan** — contienen datos personales de 2.8M ciudadanos. Se procesan localmente con `scripts/migrate_padron.py` y se cargan a Supabase vía COPY.
