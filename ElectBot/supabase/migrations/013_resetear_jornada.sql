-- ════════════════════════════════════════════════════════════════════════
-- Bloque 13 — Resetear jornada
-- Limpia el estado operativo de una jornada (participaciones, alertas y la
-- bitácora de eventos) para dejar la DB lista el día real, después de las
-- pruebas que el propio cliente hace con datos reales. NO toca usuarios ni
-- candidatos.
--
-- `eventos` es append-only (trigger que rechaza DELETE). La función salta los
-- triggers SOLO dentro de su transacción vía session_replication_role (local).
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION resetear_jornada(p_jornada UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.alertas WHERE jornada_id = p_jornada;
  DELETE FROM public.participaciones WHERE jornada_id = p_jornada;

  -- Saltar triggers (incl. el append-only de eventos) solo en esta transacción.
  PERFORM set_config('session_replication_role', 'replica', true);
  DELETE FROM public.eventos WHERE jornada_id = p_jornada;
  -- set_config con is_local=true se revierte automáticamente al hacer commit.
END;
$$;

COMMENT ON FUNCTION resetear_jornada IS 'Borra participaciones, alertas y eventos de una jornada. Conserva usuarios y candidatos. Para limpiar tras pruebas.';

-- Solo el backend (service_role) la invoca; quitamos el acceso público.
REVOKE EXECUTE ON FUNCTION resetear_jornada(UUID) FROM PUBLIC;
