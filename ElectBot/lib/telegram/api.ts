/**
 * Cliente mínimo de la Telegram Bot API (sin librería externa).
 * Una función por método que usamos. Cada tenant tiene su propio token.
 */
import "server-only";

const BASE = "https://api.telegram.org";

async function call<T = unknown>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new Error(`Telegram ${method} falló: ${json.description ?? res.status}`);
  }
  return json.result as T;
}

// ─── Botones / teclados ─────────────────────────────────────────────────────

/** Teclado con un botón que pide compartir el contacto propio. */
export function tecladoCompartirContacto() {
  return {
    keyboard: [[{ text: "📱 Compartir mi número", request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

/** Quita el teclado personalizado. */
export function quitarTeclado() {
  return { remove_keyboard: true };
}

// ─── Métodos ────────────────────────────────────────────────────────────────

export function sendMessage(
  token: string,
  chatId: number,
  text: string,
  replyMarkup?: object
) {
  return call(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

export function getMe(token: string) {
  return call<{ id: number; username: string; first_name: string }>(token, "getMe");
}

export function setWebhook(token: string, url: string, secret: string) {
  return call(token, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
  });
}

export function setMyCommands(
  token: string,
  commands: { command: string; description: string }[]
) {
  return call(token, "setMyCommands", { commands });
}
