/**
 * Formatea los resultados estructurados del motor de reglas a texto de Telegram
 * (HTML). Mismos textos que la spec sección 6.
 */
import type {
  RespuestaConsulta,
  RespuestaVoto,
  RespuestaCorreccion,
  RespuestaCorreccionAdmin,
  RespuestaSaludo,
} from "@/lib/operaciones";
import type { Elector } from "@/lib/types";
import { duracionLegible, horaAsuncion } from "@/lib/fecha";

function datosUbicacion(e: Elector): string {
  return [
    `Local: ${e.nombre_local ?? "-"}`,
    `Mesa: ${e.mesa}`,
    `Orden: ${e.orden}`,
  ].join("\n");
}

function nombreCompleto(e: Elector): string {
  return `${e.apellido}, ${e.nombre}`;
}

// ─── Consulta de Mesa Guía ──────────────────────────────────────────────────

export function formatConsulta(r: RespuestaConsulta): string {
  switch (r.tipo) {
    case "no_encontrado":
      return (
        `❌ <b>CI NO ENCONTRADO</b>\n` +
        `El número ${r.ci} no figura en el padrón.\n\n` +
        `Verificá el número con el votante.`
      );
    case "otro_municipio":
      return (
        `⚠️ <b>OTRO MUNICIPIO</b>\n` +
        `${nombreCompleto(r.elector)} no vota en este municipio.\n` +
        `Corresponde a: ${r.elector.nombre_distrito ?? "-"}`
      );
    case "fuera_jornada":
      return (
        `⚠️ <b>FUERA DE ESTA JORNADA</b>\n` +
        `${nombreCompleto(r.elector)} no participa en esta jornada.`
      );
    case "ok": {
      const e = r.elector;
      if (r.alerta === "Roja") {
        const hora = r.votoInfo?.hora ? horaAsuncion(r.votoInfo.hora) : "-";
        return (
          `🔴 <b>ALERTA ROJA</b>\n` +
          `Este elector YA VOTÓ.\n` +
          `Hora registrada: ${hora}\n\n` +
          `${nombreCompleto(e)}\n${datosUbicacion(e)}`
        );
      }
      if (r.alerta === "Amarilla") {
        return (
          `🟡 <b>ALERTA AMARILLA</b>\n` +
          `Este elector ya consultó antes con tu mismo equipo.\n\n` +
          `${nombreCompleto(e)}\n${datosUbicacion(e)}`
        );
      }
      if (r.alerta === "Naranja") {
        return (
          `🟠 <b>ALERTA NARANJA</b>\n` +
          `Este elector ya consultó con otro equipo.\n\n` +
          `${nombreCompleto(e)}\n${datosUbicacion(e)}`
        );
      }
      return (
        `✅ <b>NO VOTÓ AÚN</b>\n` +
        `${nombreCompleto(e)}\n${datosUbicacion(e)}`
      );
    }
  }
}

// ─── Voto (Veedor) ──────────────────────────────────────────────────────────

export function formatVoto(r: RespuestaVoto): string {
  switch (r.tipo) {
    case "no_encontrado":
      return (
        `❌ <b>CI NO ENCONTRADO</b>\n` +
        `El número ${r.ci} no figura en el padrón.`
      );
    case "otro_municipio":
      return `⚠️ <b>OTRO MUNICIPIO</b>\n${nombreCompleto(r.elector)} no vota en este municipio.`;
    case "fuera_jornada":
      return `⚠️ <b>FUERA DE ESTA JORNADA</b>\n${nombreCompleto(r.elector)} no participa en esta jornada.`;
    case "ya_voto":
      return (
        `🔴 <b>YA ESTABA VOTADO</b>\n` +
        `${nombreCompleto(r.elector)} ya figuraba como votado.`
      );
    case "mesa_incorrecta": {
      const e = r.elector;
      return (
        `🟥 <b>MESA INCORRECTA — VOTO NO REGISTRADO</b>\n` +
        `${nombreCompleto(e)} pertenece a la mesa ${e.mesa}, no a la tuya.\n\n` +
        `El admin fue notificado. No podés registrar este voto.`
      );
    }
    case "ok": {
      const e = r.elector;
      return (
        `🗳️ <b>VOTO REGISTRADO</b>\n` +
        `${nombreCompleto(e)}\nMesa: ${e.mesa} · Orden: ${e.orden}\n\n` +
        `Si fue error: <code>CORREGIR ${e.ci_normalizado}</code>`
      );
    }
  }
}

// ─── Saludo (KP) ──────────────────────────────────────────────────────────

export function formatSaludo(r: RespuestaSaludo): string {
  switch (r.tipo) {
    case "no_encontrado":
      return `❌ <b>CI NO ENCONTRADO</b>\nEl número ${r.ci} no figura en el padrón.`;
    case "otro_municipio":
      return `⚠️ <b>OTRO MUNICIPIO</b>\n${nombreCompleto(r.elector)} no vota en este municipio.`;
    case "fuera_jornada":
      return `⚠️ <b>FUERA DE ESTA JORNADA</b>\n${nombreCompleto(r.elector)} no participa en esta jornada.`;
    case "ya_saludado": {
      const e = r.elector;
      const voto = r.votoAt ? `\nVotó: ${horaAsuncion(r.votoAt)}` : "";
      return (
        `⚠️ <b>YA FUE SALUDADO</b>\n` +
        `${nombreCompleto(e)}\n${datosUbicacion(e)}\n\n` +
        `Saludado por <b>${r.kpNombre ?? "otro KP"}</b> a las ${horaAsuncion(r.saludoAt)}.${voto}`
      );
    }
    case "saludado": {
      const e = r.elector;
      const voto = r.yaVoto && r.votoAt ? `Ya votó (${horaAsuncion(r.votoAt)}).` : "Todavía no votó.";
      return (
        `👋 <b>SALUDO REGISTRADO</b>\n` +
        `${nombreCompleto(e)}\n${datosUbicacion(e)}\n\n${voto}`
      );
    }
  }
}

// ─── Corrección ─────────────────────────────────────────────────────────────

export function formatCorreccion(r: RespuestaCorreccion): string {
  switch (r.tipo) {
    case "no_encontrado":
      return `❌ El CI ${r.ci} no figura en el padrón.`;
    case "no_voto":
      return `ℹ️ Ese CI no figura como votado. Nada que corregir.`;
    case "ventana_expirada":
      return (
        `⛔ <b>NO AUTORIZADO</b>\n` +
        `La ventana de corrección expiró.\n` +
        `Voto cargado: ${horaAsuncion(r.votoAt)}\n\n` +
        `Solicitá al admin con /CORREGIR_ADMIN`
      );
    case "corregido":
      return (
        `✅ <b>CORRECCIÓN REGISTRADA</b>\n` +
        `El voto fue revertido. Estado actual: Pendiente\n` +
        `Tiempo transcurrido: ${duracionLegible(r.segundos)}`
      );
  }
}

// ─── Solicitud de corrección al admin (fuera de ventana) ────────────────────

export function formatCorreccionAdmin(r: RespuestaCorreccionAdmin): string {
  switch (r.tipo) {
    case "no_encontrado":
      return `❌ El CI ${r.ci} no figura en el padrón.`;
    case "no_voto":
      return `ℹ️ Ese CI no figura como votado. No hay nada que corregir.`;
    case "solicitado":
      return (
        `📨 <b>SOLICITUD ENVIADA AL ADMIN</b>\n` +
        `${nombreCompleto(r.elector)}\n\n` +
        `El admin verá tu pedido en el panel y resolverá la corrección.`
      );
  }
}
