-- ════════════════════════════════════════════════════════════════════════
-- Funciones SQL para operaciones atómicas de voto (regla crítica: evitar
-- race conditions cuando dos veedores marcan el mismo CI simultáneamente).
-- El resto de la lógica (alertas, eventos, validaciones) vive en TS.
-- ════════════════════════════════════════════════════════════════════════

-- Marca un voto de forma atómica. Crea la participación si no existe (lazy).
-- Devuelve TRUE si el voto se registró ahora, FALSE si ya estaba votado.
CREATE OR REPLACE FUNCTION marcar_voto_atomico(
  p_jornada UUID,
  p_tenant UUID,
  p_ci TEXT,
  p_usuario UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_nuevo BOOLEAN;
BEGIN
  INSERT INTO public.participaciones
    (jornada_id, ci_normalizado, tenant_id, estado, voto_at, voto_usuario_id, updated_at)
  VALUES
    (p_jornada, p_ci, p_tenant, 'Voto', NOW(), p_usuario, NOW())
  ON CONFLICT (jornada_id, ci_normalizado) DO UPDATE
    SET estado = 'Voto', voto_at = NOW(), voto_usuario_id = p_usuario, updated_at = NOW()
    WHERE public.participaciones.estado <> 'Voto'
  RETURNING TRUE INTO v_nuevo;

  -- Si hubo conflicto y la condición WHERE falló (ya votado), v_nuevo es NULL.
  RETURN COALESCE(v_nuevo, FALSE);
END;
$$;

COMMENT ON FUNCTION marcar_voto_atomico IS 'Voto atómico (UPSERT-WHERE). TRUE=registrado ahora, FALSE=ya estaba votado.';

-- Revierte un voto dentro de la ventana de corrección, de forma atómica.
-- Devuelve un estado: 'corregido' | 'no_voto' | 'ventana_expirada',
-- junto con los segundos transcurridos desde el voto.
CREATE OR REPLACE FUNCTION corregir_voto_atomico(
  p_jornada UUID,
  p_ci TEXT,
  p_ventana_minutos INT
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_voto_at TIMESTAMPTZ;
  v_estado TEXT;
  v_segundos NUMERIC;
BEGIN
  -- Lee el estado actual con lock de fila para evitar carreras.
  SELECT estado, voto_at INTO v_estado, v_voto_at
  FROM public.participaciones
  WHERE jornada_id = p_jornada AND ci_normalizado = p_ci
  FOR UPDATE;

  IF v_estado IS DISTINCT FROM 'Voto' THEN
    RETURN jsonb_build_object('resultado', 'no_voto');
  END IF;

  v_segundos := EXTRACT(EPOCH FROM (NOW() - v_voto_at));

  IF v_segundos > p_ventana_minutos * 60 THEN
    RETURN jsonb_build_object(
      'resultado', 'ventana_expirada',
      'segundos', v_segundos,
      'voto_at', v_voto_at
    );
  END IF;

  UPDATE public.participaciones
  SET estado = 'Pendiente', voto_at = NULL, voto_usuario_id = NULL, updated_at = NOW()
  WHERE jornada_id = p_jornada AND ci_normalizado = p_ci;

  RETURN jsonb_build_object('resultado', 'corregido', 'segundos', v_segundos);
END;
$$;

COMMENT ON FUNCTION corregir_voto_atomico IS 'Revierte voto dentro de ventana. Estados: corregido | no_voto | ventana_expirada.';
