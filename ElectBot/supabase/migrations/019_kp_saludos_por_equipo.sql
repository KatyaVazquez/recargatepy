-- ════════════════════════════════════════════════════════════════════════
-- Bloque 19 — KP por equipo.
--   • El KP puede tener candidato/equipo asignado.
--   • Cada saludo guarda el equipo vigente del KP en participaciones.
--   • dashboard_resumen expone saludos_por_candidato para auditar reparto.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.participaciones
  ADD COLUMN IF NOT EXISTS saludo_candidato_id UUID REFERENCES public.candidatos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.participaciones.saludo_candidato_id IS 'Equipo/candidato del KP al momento de registrar el saludo. Histórico para reportes.';
COMMENT ON COLUMN public.usuarios.candidato_id IS 'Equipo/candidato asignado al operador. Aplica a Mesa Guía y KP; Veedor queda NULL.';

CREATE INDEX IF NOT EXISTS idx_participaciones_saludo_candidato
  ON public.participaciones (jornada_id, saludo_candidato_id)
  WHERE saludo_candidato_id IS NOT NULL;

-- Backfill simple para saludos ya cargados: usa el equipo actual del KP.
UPDATE public.participaciones p
SET saludo_candidato_id = u.candidato_id
FROM public.usuarios u
WHERE p.saludo_usuario_id = u.id
  AND p.saludo_candidato_id IS NULL
  AND u.candidato_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.marcar_saludo_atomico(
  p_jornada UUID,
  p_tenant UUID,
  p_ci TEXT,
  p_usuario UUID,
  p_candidato UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_existe BOOLEAN;
  v_saludo_usuario UUID;
  v_saludo_candidato UUID;
  v_saludo_at TIMESTAMPTZ;
  v_voto_at TIMESTAMPTZ;
  v_estado TEXT;
BEGIN
  SELECT TRUE, saludo_usuario_id, saludo_candidato_id, saludo_at, voto_at, estado
    INTO v_existe, v_saludo_usuario, v_saludo_candidato, v_saludo_at, v_voto_at, v_estado
  FROM public.participaciones
  WHERE jornada_id = p_jornada AND ci_normalizado = p_ci
  FOR UPDATE;

  IF v_existe AND v_saludo_usuario IS NOT NULL THEN
    RETURN jsonb_build_object(
      'resultado', 'ya_saludado',
      'saludo_usuario_id', v_saludo_usuario,
      'saludo_candidato_id', v_saludo_candidato,
      'saludo_at', v_saludo_at,
      'voto_at', v_voto_at
    );
  END IF;

  IF v_existe THEN
    UPDATE public.participaciones
    SET saludo_at = NOW(),
        saludo_usuario_id = p_usuario,
        saludo_candidato_id = p_candidato,
        updated_at = NOW()
    WHERE jornada_id = p_jornada AND ci_normalizado = p_ci;
  ELSE
    INSERT INTO public.participaciones
      (jornada_id, ci_normalizado, tenant_id, estado, saludo_at, saludo_usuario_id, saludo_candidato_id, updated_at)
    VALUES
      (p_jornada, p_ci, p_tenant, 'Pendiente', NOW(), p_usuario, p_candidato, NOW())
    ON CONFLICT (jornada_id, ci_normalizado) DO UPDATE
      SET saludo_at = NOW(),
          saludo_usuario_id = p_usuario,
          saludo_candidato_id = p_candidato,
          updated_at = NOW()
      WHERE public.participaciones.saludo_usuario_id IS NULL;

    SELECT saludo_usuario_id, saludo_candidato_id, saludo_at, voto_at, estado
      INTO v_saludo_usuario, v_saludo_candidato, v_saludo_at, v_voto_at, v_estado
    FROM public.participaciones
    WHERE jornada_id = p_jornada AND ci_normalizado = p_ci;

    IF v_saludo_usuario IS DISTINCT FROM p_usuario THEN
      RETURN jsonb_build_object(
        'resultado', 'ya_saludado',
        'saludo_usuario_id', v_saludo_usuario,
        'saludo_candidato_id', v_saludo_candidato,
        'saludo_at', v_saludo_at,
        'voto_at', v_voto_at
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'resultado', 'saludado',
    'voto_at', v_voto_at,
    'estado', v_estado
  );
END;
$$;

COMMENT ON FUNCTION public.marcar_saludo_atomico(UUID, UUID, TEXT, UUID, UUID) IS 'Claim atómico del saludo KP con equipo histórico. saludado | ya_saludado.';

CREATE OR REPLACE FUNCTION public.dashboard_resumen(p_jornada UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_dpto SMALLINT; v_dist SMALLINT; v_secciones SMALLINT[];
  v_padron INT; v_votaron INT; v_consultados_unicos INT;
  v_votos_estimados INT; v_consultas_totales INT; v_saludos_kp INT;
BEGIN
  SELECT t.cod_dpto, t.cod_dist, j.filtro_secciones
    INTO v_dpto, v_dist, v_secciones
  FROM public.jornadas j JOIN public.tenants t ON t.id = j.tenant_id
  WHERE j.id = p_jornada;

  IF v_dpto IS NULL THEN
    RETURN jsonb_build_object('error', 'jornada_inexistente');
  END IF;

  SELECT count(*) INTO v_padron
  FROM public.electores
  WHERE cod_dpto = v_dpto
    AND cod_dist = v_dist
    AND (v_secciones IS NULL OR cod_seccion = ANY(v_secciones));

  SELECT
    count(*) FILTER (WHERE estado = 'Voto'),
    count(*) FILTER (WHERE estado IN ('Consultado', 'Voto')),
    count(*) FILTER (WHERE estado = 'Voto' AND veces_consultado > 0),
    coalesce(sum(veces_consultado), 0),
    count(*) FILTER (WHERE saludo_usuario_id IS NOT NULL)
    INTO v_votaron, v_consultados_unicos, v_votos_estimados, v_consultas_totales, v_saludos_kp
  FROM public.participaciones
  WHERE jornada_id = p_jornada;

  RETURN jsonb_build_object(
    'padron_total', v_padron,
    'votaron', v_votaron,
    'votos_registrados', v_votaron,
    'votos_estimados', v_votos_estimados,
    'consultas_totales', v_consultas_totales,
    'saludos_kp', v_saludos_kp,
    'consultados', v_consultados_unicos,
    'pendientes', GREATEST(v_padron - v_votaron, 0),
    'alertas', (SELECT coalesce(jsonb_object_agg(severidad, c), '{}') FROM (SELECT severidad, count(*) AS c FROM public.alertas WHERE jornada_id = p_jornada AND NOT resuelta GROUP BY severidad) a),
    'evolucion_horaria', (SELECT coalesce(jsonb_agg(jsonb_build_object('hora', h, 'votos', c) ORDER BY h), '[]') FROM (SELECT to_char(voto_at AT TIME ZONE 'America/Asuncion', 'HH24:00') AS h, count(*) AS c FROM public.participaciones WHERE jornada_id = p_jornada AND estado = 'Voto' AND voto_at IS NOT NULL GROUP BY 1) e),
    'ranking_operadores', (SELECT coalesce(jsonb_agg(r ORDER BY (r->>'votos')::int DESC), '[]') FROM (SELECT jsonb_build_object('nombre', coalesce(u.nombre, u.telefono, '—'), 'votos', count(*)) AS r FROM public.participaciones p JOIN public.usuarios u ON u.id = p.ultima_consulta_usuario_id WHERE p.jornada_id = p_jornada AND u.rol = 'Mesa_Guia' GROUP BY u.id, u.nombre, u.telefono ORDER BY count(*) DESC LIMIT 20) x),
    'ranking_candidatos', (SELECT coalesce(jsonb_agg(r ORDER BY (r->>'votos')::int DESC), '[]') FROM (SELECT jsonb_build_object('nombre', coalesce(c.nombre, '—'), 'lista', c.lista, 'opcion', c.opcion, 'votos', count(*)) AS r FROM public.participaciones p JOIN public.candidatos c ON c.id = p.ultima_consulta_candidato_id WHERE p.jornada_id = p_jornada AND p.estado = 'Voto' GROUP BY c.id, c.nombre, c.lista, c.opcion ORDER BY count(*) DESC LIMIT 20) x),
    'saludos_por_candidato', (SELECT coalesce(jsonb_agg(r ORDER BY (r->>'saludos')::int DESC), '[]') FROM (SELECT jsonb_build_object('nombre', coalesce(c.nombre, 'Sin equipo'), 'lista', c.lista, 'opcion', c.opcion, 'saludos', count(*)) AS r FROM public.participaciones p LEFT JOIN public.candidatos c ON c.id = p.saludo_candidato_id WHERE p.jornada_id = p_jornada AND p.saludo_usuario_id IS NOT NULL GROUP BY c.id, c.nombre, c.lista, c.opcion ORDER BY count(*) DESC LIMIT 20) x),
    'ranking_mesas', (SELECT coalesce(jsonb_agg(r ORDER BY (r->>'votos')::int DESC), '[]') FROM (SELECT jsonb_build_object('mesa', e.mesa, 'votos', count(*), 'padron_mesa', (SELECT count(*) FROM public.electores em WHERE em.cod_dpto = v_dpto AND em.cod_dist = v_dist AND em.mesa = e.mesa)) AS r FROM public.participaciones p JOIN public.electores e ON e.ci_normalizado = p.ci_normalizado WHERE p.jornada_id = p_jornada AND p.estado = 'Voto' GROUP BY e.mesa ORDER BY count(*) DESC LIMIT 20) x)
  );
END;
$$;
