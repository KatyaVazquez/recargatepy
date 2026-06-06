-- ════════════════════════════════════════════════════════════════════════
-- Bloque 3 — Capa multi-tenant
-- tenant = municipio (distrito). Padrón nacional compartido (read-only).
-- El estado del elector vive en `participaciones`, por jornada.
-- ════════════════════════════════════════════════════════════════════════

-- ─── tenants: un municipio cliente ──────────────────────────────────────────
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  cod_dpto SMALLINT NOT NULL,
  cod_dist SMALLINT NOT NULL,
  -- Bot de Telegram (secreto: solo el backend con service_role lo lee)
  telegram_bot_token TEXT,
  telegram_bot_username TEXT,
  telegram_webhook_secret TEXT,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'suspendido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (cod_dpto, cod_dist) REFERENCES distritos(cod_dpto, cod_dist)
);

COMMENT ON TABLE tenants IS 'Cada municipio cliente. Aislado por RLS.';
COMMENT ON COLUMN tenants.telegram_bot_token IS 'Secreto. Solo backend (service_role).';

-- ─── jornadas: una elección concreta dentro de un tenant ────────────────────
CREATE TABLE jornadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  fecha DATE,
  -- NULL = todo el municipio; ej {12} = solo sección 12; {1,3} = varias
  filtro_secciones SMALLINT[],
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cerrada')),
  correccion_ventana_minutos INT NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE jornadas IS 'Elección concreta. Se auto-crea una "principal" al crear el tenant.';

-- Máximo una jornada activa por tenant
CREATE UNIQUE INDEX idx_jornada_activa_unica
  ON jornadas (tenant_id) WHERE estado = 'activa';

-- ─── usuarios: operadores (Mesa Guía / Veedor). Admins/candidatos = Auth ────
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  telegram_id BIGINT,
  telefono TEXT NOT NULL,
  nombre TEXT,
  rol TEXT NOT NULL CHECK (rol IN ('Mesa_Guia', 'Veedor')),
  cod_seccion SMALLINT,
  cod_local SMALLINT,
  mesa SMALLINT,
  puesto INT,
  estado TEXT NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Bloqueado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, telefono),
  UNIQUE (tenant_id, telegram_id)
);

COMMENT ON TABLE usuarios IS 'Operadores de campo. telegram_id se vincula al compartir contacto.';

-- ─── participaciones: estado del elector POR jornada (creadas lazy) ──────────
CREATE TABLE participaciones (
  jornada_id UUID NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
  ci_normalizado TEXT NOT NULL REFERENCES electores(ci_normalizado),
  -- tenant_id denormalizado: simplifica RLS y queries del dashboard
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estado TEXT NOT NULL DEFAULT 'Pendiente'
    CHECK (estado IN ('Pendiente', 'Consultado', 'Voto')),
  ultima_consulta_at TIMESTAMPTZ,
  ultima_consulta_usuario_id UUID REFERENCES usuarios(id),
  ultima_consulta_puesto TEXT,
  voto_at TIMESTAMPTZ,
  voto_usuario_id UUID REFERENCES usuarios(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (jornada_id, ci_normalizado)
);

COMMENT ON TABLE participaciones IS 'Estado por elector y jornada. Se crea en la 1ra operación.';

-- ─── eventos: auditoría append-only ─────────────────────────────────────────
CREATE TABLE eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE CASCADE,
  ci_normalizado TEXT,
  tipo_evento TEXT NOT NULL,
  estado_anterior TEXT,
  estado_nuevo TEXT,
  usuario_id UUID REFERENCES usuarios(id),
  rol_usuario TEXT,
  canal TEXT CHECK (canal IN ('Telegram', 'PWA')),
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE eventos IS 'Bitácora append-only. UPDATE/DELETE bloqueados por trigger.';

-- ─── alertas ────────────────────────────────────────────────────────────────
CREATE TABLE alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE CASCADE,
  ci_normalizado TEXT,
  severidad TEXT NOT NULL CHECK (severidad IN ('Amarilla', 'Naranja', 'Roja', 'Critica')),
  descripcion TEXT,
  evento_id UUID REFERENCES eventos(id),
  notificada BOOLEAN NOT NULL DEFAULT FALSE,
  resuelta BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── configuracion_operativa: canal activo por tenant (una fila por tenant) ──
CREATE TABLE configuracion_operativa (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  canal_activo TEXT NOT NULL DEFAULT 'Telegram' CHECK (canal_activo IN ('Telegram', 'PWA')),
  modo_operacion TEXT NOT NULL DEFAULT 'Normal' CHECK (modo_operacion IN ('Normal', 'Contingencia')),
  actualizado_por TEXT,
  actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── telegram_updates_procesados: idempotencia de webhooks ──────────────────
CREATE TABLE telegram_updates_procesados (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  update_id BIGINT NOT NULL,
  procesado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, update_id)
);
