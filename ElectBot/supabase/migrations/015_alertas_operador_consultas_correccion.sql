-- ════════════════════════════════════════════════════════════════════════
-- Bloque 15 — Mejoras de auditoría (feedback de pruebas P1/P2)
--   • Fila 79: cada alerta registra el operador que la generó.
--   • Fila 77: contador acumulado de consultas por elector (no solo la última).
--   • Fila 73: la solicitud /CORREGIR_ADMIN queda registrada como alerta para
--     que el admin la vea en el panel.
-- ════════════════════════════════════════════════════════════════════════

-- ─── Fila 79: operador que originó la alerta ────────────────────────────────
ALTER TABLE alertas
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

COMMENT ON COLUMN alertas.usuario_id IS 'Operador que generó la alerta (quién consultó / marcó). Null para alertas del sistema.';

-- ─── Fila 77: cuántas veces fue consultado un elector (acumulado) ───────────
ALTER TABLE participaciones
  ADD COLUMN IF NOT EXISTS veces_consultado INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN participaciones.veces_consultado IS 'Total acumulado de consultas de Mesa Guía sobre este elector en la jornada.';
