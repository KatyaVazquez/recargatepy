/**
 * Token firmado (HMAC) para autenticar a un operador en la PWA, sin que sea
 * usuario de Supabase Auth. Va en un deep-link: /pwa?t=<token>
 *
 * Formato: <usuario_id>.<exp>.<firma>
 *   firma = HMAC-SHA256("<usuario_id>.<exp>", secret)  (hex)
 *
 * Stateless y verificable. El admin puede regenerarlo (cambia exp).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.OPERADOR_TOKEN_SECRET;
  if (!s) throw new Error("Falta OPERADOR_TOKEN_SECRET");
  return s;
}

function firma(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

const TTL_HORAS_DEFAULT = 48;

/** Firma un token para un operador, válido por `ttlHoras`. */
export function firmarTokenOperador(usuarioId: string, ttlHoras = TTL_HORAS_DEFAULT): string {
  const exp = Math.floor(Date.now() / 1000) + ttlHoras * 3600;
  const payload = `${usuarioId}.${exp}`;
  return `${payload}.${firma(payload)}`;
}

/** Verifica un token. Devuelve el usuario_id si es válido y no expiró, o null. */
export function verificarTokenOperador(token: string): string | null {
  const partes = (token ?? "").split(".");
  if (partes.length !== 3) return null;
  const [usuarioId, expStr, sig] = partes;
  const payload = `${usuarioId}.${expStr}`;

  const esperado = firma(payload);
  const a = Buffer.from(esperado);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;

  return usuarioId;
}
