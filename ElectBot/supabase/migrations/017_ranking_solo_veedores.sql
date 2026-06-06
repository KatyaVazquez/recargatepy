-- Bloque 17 — ranking_operadores filtra solo Veedores (rol='Veedor').
-- Las Mesas Guía ya aparecen reflejadas en ranking_candidatos.
-- (Reescribe dashboard_resumen completo para idempotencia.)
CREATE OR REPLACE FUNCTION dashboard_resumen(p_jornada UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE
  v_dpto SMALLINT; v_dist SMALLINT; v_secciones SMALLINT[];
  v_padron INT; v_votaron INT; v_consultados_unicos INT;
BEGIN
  SELECT t.cod_dpto, t.cod_dist, j.filtro_secciones
    INTO v_dpto, v_dist, v_secciones
  FROM public.jornadas j JOIN public.tenants t ON t.id = j.tenant_id
  WHERE j.id = p_jornada;
  IF v_dpto IS NULL THEN RETURN jsonb_build_object('error','jornada_inexistente'); END IF;
  SELECT count(*) INTO v_padron FROM public.electores
  WHERE cod_dpto=v_dpto AND cod_dist=v_dist AND (v_secciones IS NULL OR cod_seccion=ANY(v_secciones));
  SELECT count(*) FILTER (WHERE estado='Voto'), count(*) FILTER (WHERE estado IN ('Consultado','Voto'))
    INTO v_votaron, v_consultados_unicos
  FROM public.participaciones WHERE jornada_id=p_jornada;
  RETURN jsonb_build_object(
    'padron_total',v_padron,'votaron',v_votaron,'consultados',v_consultados_unicos,
    'pendientes',GREATEST(v_padron-v_votaron,0),
    'alertas',(SELECT coalesce(jsonb_object_agg(severidad,c),'{}') FROM (SELECT severidad,count(*) AS c FROM public.alertas WHERE jornada_id=p_jornada AND NOT resuelta GROUP BY severidad) a),
    'evolucion_horaria',(SELECT coalesce(jsonb_agg(jsonb_build_object('hora',h,'votos',c) ORDER BY h),'[]') FROM (SELECT to_char(voto_at AT TIME ZONE 'America/Asuncion','HH24:00') AS h,count(*) AS c FROM public.participaciones WHERE jornada_id=p_jornada AND estado='Voto' AND voto_at IS NOT NULL GROUP BY 1) e),
    'ranking_operadores',(SELECT coalesce(jsonb_agg(r ORDER BY (r->>'votos')::int DESC),'[]') FROM (SELECT jsonb_build_object('nombre',coalesce(u.nombre,u.telefono,'—'),'votos',count(*)) AS r FROM public.participaciones p JOIN public.usuarios u ON u.id=p.voto_usuario_id WHERE p.jornada_id=p_jornada AND p.estado='Voto' AND u.rol='Veedor' GROUP BY u.id,u.nombre,u.telefono ORDER BY count(*) DESC LIMIT 10) x),
    'ranking_candidatos',(SELECT coalesce(jsonb_agg(r ORDER BY (r->>'votos')::int DESC),'[]') FROM (SELECT jsonb_build_object('nombre',coalesce(c.nombre,'—'),'lista',c.lista,'opcion',c.opcion,'votos',count(*)) AS r FROM public.participaciones p JOIN public.candidatos c ON c.id=p.ultima_consulta_candidato_id WHERE p.jornada_id=p_jornada AND p.estado='Voto' GROUP BY c.id,c.nombre,c.lista,c.opcion ORDER BY count(*) DESC LIMIT 20) x),
    'ranking_mesas',(SELECT coalesce(jsonb_agg(r ORDER BY (r->>'votos')::int DESC),'[]') FROM (SELECT jsonb_build_object('mesa',e.mesa,'votos',count(*)) AS r FROM public.participaciones p JOIN public.electores e ON e.ci_normalizado=p.ci_normalizado WHERE p.jornada_id=p_jornada AND p.estado='Voto' GROUP BY e.mesa ORDER BY count(*) DESC LIMIT 20) x)
  );
END; $$;
