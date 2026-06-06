-- ════════════════════════════════════════════════════════════════════════
-- Bloque 12 — Candidatos (equipos)
-- Un tenant tiene 1 candidato Intendente y N candidatos Concejal. Cada
-- operador Mesa Guía pertenece a un Concejal (su "equipo"/club); los Veedores
-- trabajan para todo el equipo y NO tienen candidato.
--
-- El "equipo" para la clasificación de alertas (Amarilla vs Naranja) es el
-- candidato Concejal: misma persona consultada en otra mesa del MISMO concejal
-- = Amarilla; en otro concejal = Naranja.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('Intendente', 'Concejal')),
  nombre TEXT NOT NULL,
  lista TEXT,            -- ej. "2A"
  opcion INT,           -- ej. 24
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE candidatos IS 'Candidatos del tenant. tipo Intendente (1) o Concejal (N). El Concejal es el "equipo" de un operador Mesa Guía.';

CREATE INDEX idx_candidatos_tenant ON candidatos (tenant_id, tipo, orden);

-- ─── Vínculo operador → candidato ───────────────────────────────────────────
-- Solo aplica a Mesa Guía. Los Veedores quedan en NULL.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS candidato_id UUID REFERENCES candidatos(id) ON DELETE SET NULL;

-- ─── Candidato de la última consulta, para clasificar la alerta por equipo ──
ALTER TABLE participaciones
  ADD COLUMN IF NOT EXISTS ultima_consulta_candidato_id UUID REFERENCES candidatos(id) ON DELETE SET NULL;

-- ─── RLS: mismo patrón que el resto de tablas del tenant ────────────────────
-- El backend (service_role) bypassa RLS; el admin opera dentro de su tenant.
ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY candidatos_tenant ON candidatos
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
