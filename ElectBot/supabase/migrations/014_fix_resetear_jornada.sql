-- ════════════════════════════════════════════════════════════════════════
-- Fix de 013: session_replication_role requiere superusuario (no disponible en
-- Supabase). En su lugar, el trigger append-only de `eventos` permite DELETE
-- solo cuando una variable de sesión local (`app.reset_jornada`) está activa.
-- Esa variable la setea resetear_jornada dentro de su transacción.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION eventos_solo_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Permitir DELETE solo durante un reset de jornada explícito.
  IF TG_OP = 'DELETE' AND current_setting('app.reset_jornada', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'La tabla eventos es append-only: % no permitido', TG_OP;
END;
$$;

CREATE OR REPLACE FUNCTION resetear_jornada(p_jornada UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.alertas WHERE jornada_id = p_jornada;
  DELETE FROM public.participaciones WHERE jornada_id = p_jornada;
  -- Habilita el DELETE en eventos solo en esta transacción (is_local=true).
  PERFORM set_config('app.reset_jornada', 'on', true);
  DELETE FROM public.eventos WHERE jornada_id = p_jornada;
END;
$$;

REVOKE EXECUTE ON FUNCTION resetear_jornada(UUID) FROM PUBLIC;
