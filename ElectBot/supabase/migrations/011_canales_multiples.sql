-- ════════════════════════════════════════════════════════════════════════
-- Canal múltiple: en vez de un único canal_activo (Telegram XOR PWA), ahora
-- cada canal se habilita por separado. Por defecto ambos activos.
-- (El voto es atómico/idempotente, así que tener ambos no duplica registros.)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE configuracion_operativa
  ADD COLUMN IF NOT EXISTS telegram_activo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pwa_activo BOOLEAN NOT NULL DEFAULT TRUE;

-- Las filas existentes quedan con ambos canales activos.
UPDATE configuracion_operativa SET telegram_activo = TRUE, pwa_activo = TRUE;
