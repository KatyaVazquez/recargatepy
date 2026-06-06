-- ════════════════════════════════════════════════════════════════════════
-- Bloque 3 — Índices, trigger append-only, y RLS por tenant
-- ════════════════════════════════════════════════════════════════════════

-- ─── Índices ────────────────────────────────────────────────────────────────
CREATE INDEX idx_participaciones_jornada_estado ON participaciones (jornada_id, estado);
CREATE INDEX idx_participaciones_jornada_voto ON participaciones (jornada_id, voto_at);
CREATE INDEX idx_eventos_tenant_jornada_ts ON eventos (tenant_id, jornada_id, timestamp DESC);
CREATE INDEX idx_alertas_tenant_jornada_sev ON alertas (tenant_id, jornada_id, severidad);

-- ─── Append-only en eventos: rechazar UPDATE y DELETE ───────────────────────
CREATE OR REPLACE FUNCTION eventos_solo_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla eventos es append-only: % no permitido', TG_OP;
END;
$$;

CREATE TRIGGER trg_eventos_no_update
  BEFORE UPDATE ON eventos
  FOR EACH ROW EXECUTE FUNCTION eventos_solo_insert();

CREATE TRIGGER trg_eventos_no_delete
  BEFORE DELETE ON eventos
  FOR EACH ROW EXECUTE FUNCTION eventos_solo_insert();

-- ─── Helper: tenant_id del usuario autenticado (desde el JWT) ────────────────
-- El tenant_id se guarda en app_metadata del usuario de Supabase Auth.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

-- ─── RLS: cada tenant solo ve/opera sus propios datos ───────────────────────
-- El backend del bot/PWA usa service_role (bypassa RLS) + filtra tenant_id
-- explícito. Estas políticas protegen el acceso desde los paneles (cliente
-- autenticado con el JWT que lleva su tenant_id).

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE participaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_operativa ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_updates_procesados ENABLE ROW LEVEL SECURITY;

-- tenants: el usuario solo ve su propio tenant (por id)
CREATE POLICY tenant_self ON tenants
  FOR SELECT TO authenticated
  USING (id = current_tenant_id());

-- Resto de tablas: acceso completo dentro del tenant del usuario
CREATE POLICY jornadas_tenant ON jornadas
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY usuarios_tenant ON usuarios
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY participaciones_tenant ON participaciones
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- eventos: solo lectura desde el panel (escritura por backend service_role).
-- El trigger ya impide UPDATE/DELETE; acá restringimos a SELECT autenticado.
CREATE POLICY eventos_tenant_read ON eventos
  FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE POLICY alertas_tenant ON alertas
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY config_tenant ON configuracion_operativa
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- telegram_updates_procesados: solo backend (service_role). Sin política para
-- authenticated => nadie autenticado lo lee/escribe; service_role bypassa RLS.
