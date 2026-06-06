-- ════════════════════════════════════════════════════════════════════════
-- Bloque 18 — Ajustes finales: rol KP (saludo), interruptor maestro del
-- sistema y nuevas métricas del dashboard.
--   • Nuevo rol 'KP': registra "saludos" a electores (independiente del voto).
--   • participaciones.saludo_at / saludo_usuario_id: quién saludó y cuándo.
--   • configuracion_operativa.sistema_activo: ON/OFF maestro (apagado total).
--   • marcar_saludo_atomico: claim atómico del saludo (anti race condition).
--   • dashboard_resumen: métricas S1-S4 + ranking de operadores (Mesa Guía,
--     top 20 por consultas) + padrón por mesa (X/Y).
-- ════════════════════════════════════════════════════════════════════════

-- ─── Rol KP ──────────────────────────────────────────────────────────────
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('Mesa_Guia', 'Veedor', 'KP'));

-- ─── Saludo KP sobre el elector (por jornada) ──────────────────────────────
ALTER TABLE participaciones
  ADD COLUMN IF NOT EXISTS saludo_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS saludo_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

COMMENT ON COLUMN participaciones.saludo_usuario_id IS 'KP que saludó primero a este elector en la jornada. NULL = sin saludo.';

-- ─── Interruptor maestro del sistema (apagado total) ───────────────────────
ALTER TABLE configuracion_operativa
  ADD COLUMN IF NOT EXISTS sistema_activo BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN configuracion_operativa.sistema_activo IS 'ON/OFF maestro. Cuando es FALSE nadie puede operar (ni Telegram ni PWA).';

-- ════════════════════════════════════════════════════════════════════════
-- RPC: marca el saludo de un KP de forma atómica. Crea la participación si no
-- existe (lazy). Devuelve JSONB:
--   { resultado:'saludado', voto_at, estado }
--   { resultado:'ya_saludado', saludo_usuario_id, saludo_at, voto_at }
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION marcar_saludo_atomico(
  p_jornada UUID,
  p_tenant UUID,
  p_ci TEXT,
  p_usuario UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_existe BOOLEAN;
  v_saludo_usuario UUID;
  v_saludo_at TIMESTAMPTZ;
  v_voto_at TIMESTAMPTZ;
  v_estado TEXT;
BEGIN
  -- Lock de la fila si existe, para evitar carreras entre dos KP.
  SELECT TRUE, saludo_usuario_id, saludo_at, voto_at, estado
    INTO v_existe, v_saludo_usuario, v_saludo_at, v_voto_at, v_estado
  FROM public.participaciones
  WHERE jornada_id = p_jornada AND ci_normalizado = p_ci
  FOR UPDATE;

  -- Ya tiene saludo de otro (o el mismo) KP → devolver quién y cuándo.
  IF v_existe AND v_saludo_usuario IS NOT NULL THEN
    RETURN jsonb_build_object(
      'resultado', 'ya_saludado',
      'saludo_usuario_id', v_saludo_usuario,
      'saludo_at', v_saludo_at,
      'voto_at', v_voto_at
    );
  END IF;

  IF v_existe THEN
    UPDATE public.participaciones
    SET saludo_at = NOW(), saludo_usuario_id = p_usuario, updated_at = NOW()
    WHERE jornada_id = p_jornada AND ci_normalizado = p_ci;
  ELSE
    -- Sin participación previa: la creamos en estado Pendiente con el saludo.
    -- ON CONFLICT cubre la carrera con otra transacción que la inserte entre
    -- el SELECT y este INSERT (solo gana si el saludo sigue sin asignar).
    INSERT INTO public.participaciones
      (jornada_id, ci_normalizado, tenant_id, estado, saludo_at, saludo_usuario_id, updated_at)
    VALUES
      (p_jornada, p_ci, p_tenant, 'Pendiente', NOW(), p_usuario, NOW())
    ON CONFLICT (jornada_id, ci_normalizado) DO UPDATE
      SET saludo_at = NOW(), saludo_usuario_id = p_usuario, updated_at = NOW()
      WHERE public.participaciones.saludo_usuario_id IS NULL;
    SELECT saludo_usuario_id, saludo_at, voto_at, estado
      INTO v_saludo_usuario, v_saludo_at, v_voto_at, v_estado
    FROM public.participaciones
    WHERE jornada_id = p_jornada AND ci_normalizado = p_ci;
    -- Otro KP ganó la carrera: el saludo quedó a su nombre.
    IF v_saludo_usuario IS DISTINCT FROM p_usuario THEN
      RETURN jsonb_build_object(
        'resultado', 'ya_saludado',
        'saludo_usuario_id', v_saludo_usuario,
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

COMMENT ON FUNCTION marcar_saludo_atomico IS 'Claim atómico del saludo KP. saludado | ya_saludado.';

-- ════════════════════════════════════════════════════════════════════════
-- dashboard_resumen — reescritura completa (idempotente, como 016/017).
-- Métricas pedidas en los ajustes finales:
--   votos_registrados (S1) = todos los Voto (turnout, incluye otro movimiento)
--   votos_estimados   (S2) = votaron Y pasaron por mesa guía (veces_consultado>0)
--   consultas_totales (S3) = suma acumulada de consultas (no únicas)
--   saludos_kp        (S4) = electores con marca de saludo KP
--   ranking_operadores(S7) = Mesa Guía top 20 por consultas procesadas
--   ranking_mesas     (S8) = votos por mesa + padrón de la mesa (X/Y)
-- Se conservan padron_total/votaron/consultados/pendientes/alertas/evolucion
-- /ranking_candidatos para no romper consumidores existentes.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION dashboard_resumen(p_jornada UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SET search_path = ''
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
  IF v_dpto IS NULL THEN RETURN jsonb_build_object('error','jornada_inexistente'); END IF;

  SELECT count(*) INTO v_padron FROM public.electores
  WHERE cod_dpto=v_dpto AND cod_dist=v_dist AND (v_secciones IS NULL OR cod_seccion=ANY(v_secciones));

  SELECT
    count(*) FILTER (WHERE estado='Voto'),
    count(*) FILTER (WHERE estado IN ('Consultado','Voto')),
    count(*) FILTER (WHERE estado='Voto' AND veces_consultado > 0),
    coalesce(sum(veces_consultado), 0),
    count(*) FILTER (WHERE saludo_usuario_id IS NOT NULL)
    INTO v_votaron, v_consultados_unicos, v_votos_estimados, v_consultas_totales, v_saludos_kp
  FROM public.participaciones WHERE jornada_id=p_jornada;

  RETURN jsonb_build_object(
    'padron_total', v_padron,
    'votaron', v_votaron,
    'votos_registrados', v_votaron,
    'votos_estimados', v_votos_estimados,
    'consultas_totales', v_consultas_totales,
    'saludos_kp', v_saludos_kp,
    'consultados', v_consultados_unicos,
    'pendientes', GREATEST(v_padron - v_votaron, 0),
    'alertas', (SELECT coalesce(jsonb_object_agg(severidad,c),'{}') FROM (SELECT severidad,count(*) AS c FROM public.alertas WHERE jornada_id=p_jornada AND NOT resuelta GROUP BY severidad) a),
    'evolucion_horaria', (SELECT coalesce(jsonb_agg(jsonb_build_object('hora',h,'votos',c) ORDER BY h),'[]') FROM (SELECT to_char(voto_at AT TIME ZONE 'America/Asuncion','HH24:00') AS h,count(*) AS c FROM public.participaciones WHERE jornada_id=p_jornada AND estado='Voto' AND voto_at IS NOT NULL GROUP BY 1) e),
    -- S7: ranking de operadores Mesa Guía por consultas procesadas (top 20).
    'ranking_operadores', (SELECT coalesce(jsonb_agg(r ORDER BY (r->>'votos')::int DESC),'[]') FROM (SELECT jsonb_build_object('nombre',coalesce(u.nombre,u.telefono,'—'),'votos',count(*)) AS r FROM public.participaciones p JOIN public.usuarios u ON u.id=p.ultima_consulta_usuario_id WHERE p.jornada_id=p_jornada AND u.rol='Mesa_Guia' GROUP BY u.id,u.nombre,u.telefono ORDER BY count(*) DESC LIMIT 20) x),
    'ranking_candidatos', (SELECT coalesce(jsonb_agg(r ORDER BY (r->>'votos')::int DESC),'[]') FROM (SELECT jsonb_build_object('nombre',coalesce(c.nombre,'—'),'lista',c.lista,'opcion',c.opcion,'votos',count(*)) AS r FROM public.participaciones p JOIN public.candidatos c ON c.id=p.ultima_consulta_candidato_id WHERE p.jornada_id=p_jornada AND p.estado='Voto' GROUP BY c.id,c.nombre,c.lista,c.opcion ORDER BY count(*) DESC LIMIT 20) x),
    -- S8: votos por mesa + padrón total de la mesa (para mostrar X/Y).
    'ranking_mesas', (SELECT coalesce(jsonb_agg(r ORDER BY (r->>'votos')::int DESC),'[]') FROM (SELECT jsonb_build_object('mesa',e.mesa,'votos',count(*),'padron_mesa',(SELECT count(*) FROM public.electores em WHERE em.cod_dpto=v_dpto AND em.cod_dist=v_dist AND em.mesa=e.mesa)) AS r FROM public.participaciones p JOIN public.electores e ON e.ci_normalizado=p.ci_normalizado WHERE p.jornada_id=p_jornada AND p.estado='Voto' GROUP BY e.mesa ORDER BY count(*) DESC LIMIT 20) x)
  );
END; $$;
