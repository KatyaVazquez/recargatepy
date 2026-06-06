/**
 * Maneja un update de Telegram para un tenant: onboarding (/start + compartir
 * contacto) y operación (consulta/voto/corrección).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candidato, Contexto, Tenant, Usuario } from "@/lib/types";
import { getCandidatoPorId, getJornadaActiva, getUsuarioPorTelegram } from "@/lib/data";
import { digitosTelefono } from "@/lib/telefono";
import { procesarMensaje } from "@/lib/orquestador";
import {
  formatConsulta,
  formatCorreccion,
  formatCorreccionAdmin,
  formatSaludo,
  formatVoto,
} from "@/lib/telegram/format";
import {
  quitarTeclado,
  sendMessage,
  tecladoCompartirContacto,
} from "@/lib/telegram/api";

type DB = SupabaseClient;

// Tipos mínimos de Telegram (solo lo que usamos)
type TgContact = { phone_number: string; user_id?: number };
type TgMessage = {
  message_id: number;
  from?: { id: number; first_name?: string };
  chat: { id: number };
  text?: string;
  contact?: TgContact;
};
export type TgUpdate = { update_id: number; message?: TgMessage };

function bienvenida(u: Usuario, candidato: Candidato | null): string {
  const rol = u.rol === "Mesa_Guia" ? "Mesa Guía" : u.rol === "KP" ? "KP" : "Veedor";
  const puesto =
    u.rol === "Mesa_Guia"
      ? `puesto ${u.puesto ?? "?"}`
      : u.rol === "KP"
        ? "rol de saludo"
        : `mesa ${u.mesa ?? "?"}`;
  const accion =
    u.rol === "Mesa_Guia"
      ? "Enviá un CI para consultar al elector."
      : u.rol === "KP"
        ? "Enviá un CI para registrar el saludo."
        : "Enviá un CI para marcar el voto.";

  // Para Mesa Guía mostramos su equipo (candidato, lista y opción) si lo tiene.
  let equipo = "";
  if (u.rol === "Mesa_Guia" && candidato) {
    const detalle = [
      candidato.lista ? `lista ${candidato.lista}` : null,
      candidato.opcion ? `opción ${candidato.opcion}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    equipo = `\nCandidato: <b>${candidato.nombre}</b>${detalle ? ` (${detalle})` : ""}`;
  }

  return (
    `✅ ¡Bienvenido${u.nombre ? `, ${u.nombre}` : ""}!\n` +
    `Sos <b>${rol}</b> (${puesto}).${equipo}\n\n${accion}`
  );
}

export async function manejarUpdate(
  db: DB,
  token: string,
  tenant: Tenant,
  update: TgUpdate
): Promise<void> {
  const msg = update.message;
  if (!msg || !msg.from) return;
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  // ── Contacto compartido → vincular ──────────────────────────────────────
  if (msg.contact) {
    const digitos = digitosTelefono(msg.contact.phone_number);
    const { data: usuario } = await db
      .from("usuarios")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("telefono", digitos)
      .maybeSingle();

    if (!usuario) {
      await sendMessage(
        token,
        chatId,
        "No estás autorizado en este sistema. Contactá al administrador.",
        quitarTeclado()
      );
      return;
    }
    const u = usuario as Usuario;
    if (u.estado === "Bloqueado") {
      await sendMessage(token, chatId, "Tu cuenta fue bloqueada. Contactá al administrador.", quitarTeclado());
      return;
    }
    if (u.telegram_id && u.telegram_id !== telegramId) {
      await sendMessage(
        token,
        chatId,
        "Este teléfono ya está vinculado a otra cuenta de Telegram. Contactá al administrador.",
        quitarTeclado()
      );
      return;
    }
    if (!u.telegram_id) {
      await db.from("usuarios").update({ telegram_id: telegramId }).eq("id", u.id);
    }
    const cand = await getCandidatoPorId(db, u.candidato_id);
    await sendMessage(token, chatId, bienvenida(u, cand), quitarTeclado());
    return;
  }

  const texto = msg.text?.trim() ?? "";

  // ── /start → pedir contacto ─────────────────────────────────────────────
  if (texto === "/start" || texto.startsWith("/start")) {
    const u = await getUsuarioPorTelegram(db, tenant.id, telegramId);
    if (u && u.estado === "Activo") {
      const cand = await getCandidatoPorId(db, u.candidato_id);
      await sendMessage(token, chatId, bienvenida(u, cand), quitarTeclado());
      return;
    }
    await sendMessage(
      token,
      chatId,
      "👋 Hola. Para identificarte, tocá el botón y compartí tu número.",
      tecladoCompartirContacto()
    );
    return;
  }

  // ── Operación: requiere usuario vinculado y activo ──────────────────────
  const usuario = await getUsuarioPorTelegram(db, tenant.id, telegramId);
  if (!usuario) {
    await sendMessage(
      token,
      chatId,
      "No estás identificado. Enviá /start y compartí tu número.",
      tecladoCompartirContacto()
    );
    return;
  }
  if (usuario.estado === "Bloqueado") {
    await sendMessage(token, chatId, "Tu cuenta fue bloqueada. Contactá al administrador.");
    return;
  }

  const jornada = await getJornadaActiva(db, tenant.id);
  if (!jornada) {
    await sendMessage(token, chatId, "No hay una jornada activa en este momento.");
    return;
  }

  const ctx: Contexto = { tenant, jornada, usuario, canal: "Telegram" };
  const resultado = await procesarMensaje(db, ctx, texto);

  let respuesta: string;
  switch (resultado.clase) {
    case "ci_invalido":
      respuesta = "Formato de CI inválido. Enviá solo el número de cédula.";
      break;
    case "sistema_apagado":
      respuesta = "El sistema está apagado en este momento. No se aceptan operaciones.";
      break;
    case "orden_error":
      respuesta = "Por Telegram enviá el número de cédula, no el de orden.";
      break;
    case "canal_inactivo":
      respuesta = `Las operaciones por Telegram están deshabilitadas en este momento.`;
      break;
    case "consulta":
      respuesta = formatConsulta(resultado.r);
      break;
    case "voto":
      respuesta = formatVoto(resultado.r);
      break;
    case "saludo":
      respuesta = formatSaludo(resultado.r);
      break;
    case "correccion":
      respuesta = formatCorreccion(resultado.r);
      break;
    case "correccion_admin":
      respuesta = formatCorreccionAdmin(resultado.r);
      break;
  }
  await sendMessage(token, chatId, respuesta);
}
