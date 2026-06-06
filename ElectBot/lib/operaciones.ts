/**
 * Motor de reglas — núcleo compartido por el bot de Telegram y la PWA.
 *
 * Las funciones devuelven resultados ESTRUCTURADOS (no texto formateado), para
 * que cada canal los renderice a su manera pero con la misma lógica de negocio.
 *
 * Usan el cliente admin (service_role) y SIEMPRE filtran tenant_id explícito.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contexto, Elector, Severidad, Usuario } from "@/lib/types";

type DB = SupabaseClient;

// ─── Búsqueda de elector validando municipio + jornada ──────────────────────

export type BusquedaElector =
  | { resultado: "ok"; elector: Elector }
  | { resultado: "no_existe" }
  | { resultado: "otro_municipio"; elector: Elector }
  | { resultado: "fuera_jornada"; elector: Elector };

const CAMPOS_ELECTOR =
  "ci_normalizado, apellido, nombre, cod_dpto, cod_dist, cod_seccion, cod_local, mesa, orden, nombre_local, nombre_seccion, nombre_distrito";

/** Busca un elector y valida que pertenezca al municipio del tenant y al filtro de la jornada. */
export async function buscarElectorEnJornada(
  db: DB,
  ci: string,
  ctx: Pick<Contexto, "tenant" | "jornada">
): Promise<BusquedaElector> {
  const { data, error } = await db
    .from("electores")
    .select(CAMPOS_ELECTOR)
    .eq("ci_normalizado", ci)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { resultado: "no_existe" };

  const elector = data as Elector;

  // ¿Pertenece al municipio del tenant?
  if (
    elector.cod_dpto !== ctx.tenant.cod_dpto ||
    elector.cod_dist !== ctx.tenant.cod_dist
  ) {
    return { resultado: "otro_municipio", elector };
  }

  // ¿Su sección está dentro del filtro de la jornada? (null = todas)
  const filtro = ctx.jornada.filtro_secciones;
  if (filtro && filtro.length > 0 && !filtro.includes(elector.cod_seccion)) {
    return { resultado: "fuera_jornada", elector };
  }

  return { resultado: "ok", elector };
}

/**
 * Busca un elector por su NÚMERO DE ORDEN dentro de la mesa del veedor.
 * El orden es relativo a la mesa, así que se filtra por el distrito del tenant
 * y la mesa del usuario. Si el `cod_local` del usuario está cargado se usa para
 * desambiguar (un mismo número de mesa puede repetirse en varios locales).
 * Devuelve `ambiguo` si hay más de un elector que coincide (pedir CI entonces).
 */
export type BusquedaPorOrden =
  | { resultado: "ok"; elector: Elector }
  | { resultado: "sin_mesa" }
  | { resultado: "no_existe" }
  | { resultado: "ambiguo" }
  | { resultado: "fuera_jornada"; elector: Elector };

export async function buscarElectorPorOrden(
  db: DB,
  orden: number,
  ctx: Pick<Contexto, "tenant" | "jornada" | "usuario">
): Promise<BusquedaPorOrden> {
  if (ctx.usuario.mesa == null) return { resultado: "sin_mesa" };

  let query = db
    .from("electores")
    .select(CAMPOS_ELECTOR)
    .eq("cod_dpto", ctx.tenant.cod_dpto)
    .eq("cod_dist", ctx.tenant.cod_dist)
    .eq("mesa", ctx.usuario.mesa)
    .eq("orden", orden)
    .limit(2);
  if (ctx.usuario.cod_local != null) {
    query = query.eq("cod_local", ctx.usuario.cod_local);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return { resultado: "no_existe" };
  if (data.length > 1) return { resultado: "ambiguo" };

  const elector = data[0] as Elector;
  const filtro = ctx.jornada.filtro_secciones;
  if (filtro && filtro.length > 0 && !filtro.includes(elector.cod_seccion)) {
    return { resultado: "fuera_jornada", elector };
  }
  return { resultado: "ok", elector };
}

// ─── Auditoría ──────────────────────────────────────────────────────────────

type EventoInput = {
  ci?: string | null;
  tipo: string;
  estadoAnterior?: string | null;
  estadoNuevo?: string | null;
  metadata?: Record<string, unknown>;
};

/** Registra un evento en la bitácora append-only. Todo pasa por acá. */
export async function logEvento(db: DB, ctx: Contexto, e: EventoInput) {
  const { error } = await db.from("eventos").insert({
    tenant_id: ctx.tenant.id,
    jornada_id: ctx.jornada.id,
    ci_normalizado: e.ci ?? null,
    tipo_evento: e.tipo,
    estado_anterior: e.estadoAnterior ?? null,
    estado_nuevo: e.estadoNuevo ?? null,
    usuario_id: ctx.usuario.id,
    rol_usuario: ctx.usuario.rol,
    canal: ctx.canal,
    metadata: e.metadata ?? null,
  });
  if (error) throw error;
}

async function crearAlerta(
  db: DB,
  ctx: Contexto,
  ci: string,
  severidad: Severidad,
  descripcion: string
) {
  const { error } = await db.from("alertas").insert({
    tenant_id: ctx.tenant.id,
    jornada_id: ctx.jornada.id,
    ci_normalizado: ci,
    severidad,
    descripcion,
    // Fila 79: registramos quién generó la alerta.
    usuario_id: ctx.usuario.id,
  });
  if (error) throw error;
}

/** Etiqueta legible del puesto del operador. */
export function descripcionPuesto(u: Usuario): string {
  if (u.rol === "Mesa_Guia") return `Mesa Guia ${u.puesto ?? "?"}`;
  return `Mesa ${u.mesa ?? "?"}`;
}

// ─── Consulta de Mesa Guía ──────────────────────────────────────────────────

export type RespuestaConsulta =
  | { tipo: "no_encontrado"; ci: string }
  | { tipo: "otro_municipio"; elector: Elector }
  | { tipo: "fuera_jornada"; elector: Elector }
  | {
      tipo: "ok";
      elector: Elector;
      alerta: Severidad | null;
      yaVoto: boolean;
      votoInfo?: { hora: string; puesto: string } | null;
    };

/** Mesa Guía consulta un CI: devuelve datos del elector y clasifica alertas. */
export async function consultarMesaGuia(
  db: DB,
  ctx: Contexto,
  ci: string
): Promise<RespuestaConsulta> {
  const busqueda = await buscarElectorEnJornada(db, ci, ctx);

  if (busqueda.resultado === "no_existe") {
    await logEvento(db, ctx, { ci, tipo: "CI_No_Encontrado" });
    return { tipo: "no_encontrado", ci };
  }
  if (busqueda.resultado === "otro_municipio") {
    await logEvento(db, ctx, { ci, tipo: "CI_Otro_Municipio" });
    return { tipo: "otro_municipio", elector: busqueda.elector };
  }
  if (busqueda.resultado === "fuera_jornada") {
    await logEvento(db, ctx, { ci, tipo: "CI_Fuera_Jornada" });
    return { tipo: "fuera_jornada", elector: busqueda.elector };
  }

  const elector = busqueda.elector;
  const puestoActual = descripcionPuesto(ctx.usuario);

  // Estado previo de la participación (puede no existir todavía)
  const { data: part, error } = await db
    .from("participaciones")
    .select(
      "estado, ultima_consulta_puesto, ultima_consulta_candidato_id, voto_at, voto_usuario_id, veces_consultado"
    )
    .eq("jornada_id", ctx.jornada.id)
    .eq("ci_normalizado", ci)
    .maybeSingle();
  if (error) throw error;

  const candidatoActual = ctx.usuario.candidato_id;

  let alerta: Severidad | null = null;
  let yaVoto = false;
  let votoInfo: { hora: string; puesto: string } | null = null;

  if (part?.estado === "Voto") {
    // Alerta Roja: ya votó
    yaVoto = true;
    alerta = "Roja";
    votoInfo = { hora: part.voto_at as string, puesto: "" };
  } else if (part) {
    // Ya consultó antes. El "equipo" es el candidato (Concejal): si vuelve a
    // consultar dentro del mismo equipo => Amarilla (no entregar de nuevo);
    // si consulta con otro equipo => Naranja. Si falta el dato de candidato
    // en alguno de los dos lados, caemos al puesto como referencia.
    const previo = part.ultima_consulta_candidato_id as string | null;
    const mismoEquipo =
      candidatoActual && previo
        ? candidatoActual === previo
        : part.ultima_consulta_puesto === puestoActual;
    alerta = mismoEquipo ? "Amarilla" : "Naranja";
  }

  // Upsert de la participación: marcar Consultado (sin pisar un Voto).
  // Fila 77: acumulamos el total de consultas en vez de pisar solo la última.
  const vecesConsultado = ((part?.veces_consultado as number | null) ?? 0) + 1;
  await db.from("participaciones").upsert(
    {
      jornada_id: ctx.jornada.id,
      ci_normalizado: ci,
      tenant_id: ctx.tenant.id,
      estado: part?.estado === "Voto" ? "Voto" : "Consultado",
      ultima_consulta_at: new Date().toISOString(),
      ultima_consulta_usuario_id: ctx.usuario.id,
      ultima_consulta_puesto: puestoActual,
      ultima_consulta_candidato_id: candidatoActual,
      veces_consultado: vecesConsultado,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "jornada_id,ci_normalizado" }
  );

  await logEvento(db, ctx, {
    ci,
    tipo: "Consulta",
    estadoNuevo: part?.estado === "Voto" ? "Voto" : "Consultado",
    metadata: { puesto: puestoActual, candidato_id: candidatoActual, alerta },
  });

  if (alerta) {
    const desc =
      alerta === "Roja"
        ? "Consulta sobre un elector que ya votó"
        : alerta === "Amarilla"
          ? "Consulta repetida en el mismo equipo"
          : "Consulta con otro equipo";
    await crearAlerta(db, ctx, ci, alerta, desc);
  }

  return { tipo: "ok", elector, alerta, yaVoto, votoInfo };
}

// ─── Marcación de voto (Veedor) ─────────────────────────────────────────────

export type RespuestaVoto =
  | { tipo: "no_encontrado"; ci: string }
  | { tipo: "otro_municipio"; elector: Elector }
  | { tipo: "fuera_jornada"; elector: Elector }
  | { tipo: "ya_voto"; elector: Elector }
  | { tipo: "mesa_incorrecta"; elector: Elector }
  | { tipo: "ok"; elector: Elector };

/** Veedor marca un voto de forma atómica. */
export async function marcarVoto(
  db: DB,
  ctx: Contexto,
  ci: string
): Promise<RespuestaVoto> {
  const busqueda = await buscarElectorEnJornada(db, ci, ctx);

  if (busqueda.resultado === "no_existe") {
    await logEvento(db, ctx, { ci, tipo: "CI_No_Encontrado" });
    return { tipo: "no_encontrado", ci };
  }
  if (busqueda.resultado === "otro_municipio") {
    await logEvento(db, ctx, { ci, tipo: "CI_Otro_Municipio" });
    return { tipo: "otro_municipio", elector: busqueda.elector };
  }
  if (busqueda.resultado === "fuera_jornada") {
    await logEvento(db, ctx, { ci, tipo: "CI_Fuera_Jornada" });
    return { tipo: "fuera_jornada", elector: busqueda.elector };
  }

  const elector = busqueda.elector;

  // ¿El veedor intenta marcar un elector de otra mesa? → BLOQUEAR y alertar
  if (ctx.usuario.mesa != null && ctx.usuario.mesa !== elector.mesa) {
    await logEvento(db, ctx, {
      ci,
      tipo: "Voto_Mesa_Incorrecta",
      metadata: { mesaElector: elector.mesa, mesaVeedor: ctx.usuario.mesa },
    });
    await crearAlerta(
      db,
      ctx,
      ci,
      "Critica",
      `Intento de marcar elector de mesa ${elector.mesa} por veedor de mesa ${ctx.usuario.mesa}`
    );
    return { tipo: "mesa_incorrecta", elector };
  }

  // Marca atómica (anti race condition)
  const { data: nuevo, error } = await db.rpc("marcar_voto_atomico", {
    p_jornada: ctx.jornada.id,
    p_tenant: ctx.tenant.id,
    p_ci: ci,
    p_usuario: ctx.usuario.id,
  });
  if (error) throw error;

  if (nuevo === false) {
    await logEvento(db, ctx, { ci, tipo: "Voto_Duplicado" });
    return { tipo: "ya_voto", elector };
  }

  await logEvento(db, ctx, {
    ci,
    tipo: "Voto",
    estadoNuevo: "Voto",
    metadata: { mesaElector: elector.mesa, mesaVeedor: ctx.usuario.mesa },
  });

  return { tipo: "ok", elector };
}

// ─── Corrección de voto (ventana de 7 min) ──────────────────────────────────

export type RespuestaCorreccion =
  | { tipo: "no_encontrado"; ci: string }
  | { tipo: "no_voto" }
  | { tipo: "ventana_expirada"; votoAt: string }
  | { tipo: "corregido"; segundos: number };

/** Veedor corrige (revierte) un voto dentro de la ventana configurada. */
export async function corregirVoto(
  db: DB,
  ctx: Contexto,
  ci: string
): Promise<RespuestaCorreccion> {
  const busqueda = await buscarElectorEnJornada(db, ci, ctx);
  if (busqueda.resultado === "no_existe") {
    return { tipo: "no_encontrado", ci };
  }

  const { data, error } = await db.rpc("corregir_voto_atomico", {
    p_jornada: ctx.jornada.id,
    p_ci: ci,
    p_ventana_minutos: ctx.jornada.correccion_ventana_minutos,
  });
  if (error) throw error;

  const r = data as { resultado: string; segundos?: number; voto_at?: string };

  if (r.resultado === "no_voto") return { tipo: "no_voto" };
  if (r.resultado === "ventana_expirada") {
    await logEvento(db, ctx, { ci, tipo: "Correccion_Rechazada" });
    return { tipo: "ventana_expirada", votoAt: r.voto_at! };
  }

  await logEvento(db, ctx, {
    ci,
    tipo: "Correccion",
    estadoAnterior: "Voto",
    estadoNuevo: "Pendiente",
    metadata: { segundos: r.segundos },
  });
  return { tipo: "corregido", segundos: r.segundos ?? 0 };
}

// ─── Solicitud de corrección al admin (fuera de ventana) ────────────────────

export type RespuestaCorreccionAdmin =
  | { tipo: "no_encontrado"; ci: string }
  | { tipo: "no_voto" }
  | { tipo: "solicitado"; elector: Elector };

/**
 * Fila 73: cuando la ventana de corrección expiró, el veedor envía
 * /CORREGIR_ADMIN <ci>. No revierte el voto: registra una alerta para que el
 * admin la vea en el panel y resuelva manualmente.
 */
export async function solicitarCorreccionAdmin(
  db: DB,
  ctx: Contexto,
  ci: string
): Promise<RespuestaCorreccionAdmin> {
  const busqueda = await buscarElectorEnJornada(db, ci, ctx);
  if (busqueda.resultado === "no_existe") {
    return { tipo: "no_encontrado", ci };
  }
  const elector = busqueda.elector;

  // Solo tiene sentido si el elector figura como votado.
  const { data: part, error } = await db
    .from("participaciones")
    .select("estado")
    .eq("jornada_id", ctx.jornada.id)
    .eq("ci_normalizado", ci)
    .maybeSingle();
  if (error) throw error;

  if (part?.estado !== "Voto") {
    return { tipo: "no_voto" };
  }

  await logEvento(db, ctx, {
    ci,
    tipo: "Solicitud_Correccion_Admin",
    metadata: { puesto: descripcionPuesto(ctx.usuario) },
  });
  await crearAlerta(
    db,
    ctx,
    ci,
    "Roja",
    `Solicitud de corrección al admin (fuera de ventana) — ${nombreCompleto(elector)}`
  );

  return { tipo: "solicitado", elector };
}

function nombreCompleto(e: Elector): string {
  return `${e.apellido}, ${e.nombre}`;
}

// ─── Saludo (KP) ──────────────────────────────────────────────────────────

export type RespuestaSaludo =
  | { tipo: "no_encontrado"; ci: string }
  | { tipo: "otro_municipio"; elector: Elector }
  | { tipo: "fuera_jornada"; elector: Elector }
  | { tipo: "saludado"; elector: Elector; yaVoto: boolean; votoAt: string | null }
  | {
      tipo: "ya_saludado";
      elector: Elector;
      kpNombre: string | null;
      saludoAt: string;
      votoAt: string | null;
    };

/**
 * KP registra el "saludo" a un elector. El saludo es independiente del voto:
 * el primer KP que digita el CI queda como quien saludó. Si otro KP digita el
 * mismo CI, recibe quién saludó antes (y cuándo) y la hora de voto si la hay.
 */
export async function marcarSaludo(
  db: DB,
  ctx: Contexto,
  ci: string
): Promise<RespuestaSaludo> {
  const busqueda = await buscarElectorEnJornada(db, ci, ctx);

  if (busqueda.resultado === "no_existe") {
    await logEvento(db, ctx, { ci, tipo: "CI_No_Encontrado" });
    return { tipo: "no_encontrado", ci };
  }
  if (busqueda.resultado === "otro_municipio") {
    await logEvento(db, ctx, { ci, tipo: "CI_Otro_Municipio" });
    return { tipo: "otro_municipio", elector: busqueda.elector };
  }
  if (busqueda.resultado === "fuera_jornada") {
    await logEvento(db, ctx, { ci, tipo: "CI_Fuera_Jornada" });
    return { tipo: "fuera_jornada", elector: busqueda.elector };
  }

  const elector = busqueda.elector;

  const { data, error } = await db.rpc("marcar_saludo_atomico", {
    p_jornada: ctx.jornada.id,
    p_tenant: ctx.tenant.id,
    p_ci: ci,
    p_usuario: ctx.usuario.id,
    p_candidato: ctx.usuario.candidato_id,
  });
  if (error) throw error;

  const r = data as {
    resultado: string;
    voto_at?: string | null;
    estado?: string | null;
    saludo_usuario_id?: string | null;
    saludo_at?: string;
  };

  if (r.resultado === "ya_saludado") {
    // Nombre del KP que saludó primero (para mostrar "ALERTA <KP> <hora>").
    let kpNombre: string | null = null;
    if (r.saludo_usuario_id) {
      const { data: kp } = await db
        .from("usuarios")
        .select("nombre, telefono")
        .eq("id", r.saludo_usuario_id)
        .maybeSingle();
      kpNombre = (kp?.nombre as string | null) ?? (kp?.telefono as string | null) ?? null;
    }
    await logEvento(db, ctx, {
      ci,
      tipo: "Saludo_Duplicado",
      metadata: { saludo_usuario_id: r.saludo_usuario_id, candidato_id: ctx.usuario.candidato_id },
    });
    return {
      tipo: "ya_saludado",
      elector,
      kpNombre,
      saludoAt: r.saludo_at!,
      votoAt: r.voto_at ?? null,
    };
  }

  await logEvento(db, ctx, {
    ci,
    tipo: "Saludo",
    estadoNuevo: r.estado ?? null,
    metadata: { candidato_id: ctx.usuario.candidato_id },
  });
  return {
    tipo: "saludado",
    elector,
    yaVoto: r.estado === "Voto",
    votoAt: r.voto_at ?? null,
  };
}
