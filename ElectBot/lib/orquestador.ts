/**
 * Orquestador del mensaje de un operador. Núcleo compartido por Telegram y PWA:
 * normaliza el CI, rutea por rol, detecta el comando CORREGIR y valida que el
 * canal usado sea el activo. Devuelve un resultado ESTRUCTURADO; cada canal lo
 * formatea.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contexto } from "@/lib/types";
import { normalizarCI } from "@/lib/ci";
import { getCanalesActivos } from "@/lib/data";
import {
  buscarElectorPorOrden,
  consultarMesaGuia,
  corregirVoto,
  marcarSaludo,
  marcarVoto,
  solicitarCorreccionAdmin,
  type RespuestaConsulta,
  type RespuestaCorreccion,
  type RespuestaCorreccionAdmin,
  type RespuestaSaludo,
  type RespuestaVoto,
} from "@/lib/operaciones";

type DB = SupabaseClient;

/** Modo de entrada del veedor: por cédula (default) o por número de orden. */
export type ModoEntrada = "ci" | "orden";

export type ResultadoMensaje =
  | { clase: "consulta"; r: RespuestaConsulta }
  | { clase: "voto"; r: RespuestaVoto }
  | { clase: "saludo"; r: RespuestaSaludo }
  | { clase: "correccion"; r: RespuestaCorreccion }
  | { clase: "correccion_admin"; r: RespuestaCorreccionAdmin }
  | { clase: "ci_invalido" }
  | { clase: "orden_error"; motivo: "sin_mesa" | "no_existe" | "ambiguo" | "fuera_jornada" }
  | { clase: "sistema_apagado" }
  | { clase: "canal_inactivo"; canal: "Telegram" | "PWA" };

// /CORREGIR_ADMIN debe ir ANTES que CORREGIR (más específico).
const RE_CORREGIR_ADMIN = /^\s*\/?corregir_admin\s+(.+)$/i;
const RE_CORREGIR = /^\s*corregir\s+(.+)$/i;

export async function procesarMensaje(
  db: DB,
  ctx: Contexto,
  texto: string,
  opts: { modo?: ModoEntrada } = {}
): Promise<ResultadoMensaje> {
  // El sistema debe estar encendido (interruptor maestro) y el canal habilitado.
  const canales = await getCanalesActivos(db, ctx.tenant.id);
  if (!canales.sistema) {
    return { clase: "sistema_apagado" };
  }
  const habilitado = ctx.canal === "Telegram" ? canales.telegram : canales.pwa;
  if (!habilitado) {
    return { clase: "canal_inactivo", canal: ctx.canal };
  }

  // ¿Comando /CORREGIR_ADMIN <ci>? (solo Veedor) — fuera de ventana
  const mCorregirAdmin = texto.match(RE_CORREGIR_ADMIN);
  if (mCorregirAdmin && ctx.usuario.rol === "Veedor") {
    const ci = normalizarCI(mCorregirAdmin[1]);
    if (!ci.ok) return { clase: "ci_invalido" };
    return { clase: "correccion_admin", r: await solicitarCorreccionAdmin(db, ctx, ci.ci) };
  }

  // ¿Comando CORREGIR <ci>? (solo Veedor)
  const mCorregir = texto.match(RE_CORREGIR);
  if (mCorregir && ctx.usuario.rol === "Veedor") {
    const ci = normalizarCI(mCorregir[1]);
    if (!ci.ok) return { clase: "ci_invalido" };
    return { clase: "correccion", r: await corregirVoto(db, ctx, ci.ci) };
  }

  // Veedor por número de orden: resuelve al elector dentro de su mesa y vota.
  if (ctx.usuario.rol === "Veedor" && opts.modo === "orden") {
    const orden = parseInt((texto ?? "").replace(/\D/g, ""), 10);
    if (!Number.isFinite(orden) || orden <= 0) return { clase: "ci_invalido" };
    const b = await buscarElectorPorOrden(db, orden, ctx);
    if (b.resultado !== "ok") {
      return { clase: "orden_error", motivo: b.resultado };
    }
    return { clase: "voto", r: await marcarVoto(db, ctx, b.elector.ci_normalizado) };
  }

  // Mensaje normal = un CI
  const ci = normalizarCI(texto);
  if (!ci.ok) return { clase: "ci_invalido" };

  if (ctx.usuario.rol === "Mesa_Guia") {
    return { clase: "consulta", r: await consultarMesaGuia(db, ctx, ci.ci) };
  }
  if (ctx.usuario.rol === "KP") {
    return { clase: "saludo", r: await marcarSaludo(db, ctx, ci.ci) };
  }
  // Veedor
  return { clase: "voto", r: await marcarVoto(db, ctx, ci.ci) };
}
