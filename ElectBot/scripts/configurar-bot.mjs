#!/usr/bin/env node
/**
 * Configura el bot de Telegram de un tenant (white-glove / dev).
 *
 *   node scripts/configurar-bot.mjs <slug> <bot_token> [public_url]
 *
 * - Guarda token + username + webhook_secret en la fila del tenant (Supabase).
 * - Si se pasa public_url, registra el webhook y los comandos en Telegram.
 *   El webhook queda en  <public_url>/api/telegram/webhook/<slug>
 *
 * Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY de .env.local.
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const [, , slug, botToken, publicUrl] = process.argv;
if (!slug || !botToken) {
  console.error("Uso: node scripts/configurar-bot.mjs <slug> <bot_token> [public_url]");
  process.exit(1);
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`);
  return j.result;
}

async function supabase(path, method, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Supabase ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

const me = await tg("getMe");
console.log(`Bot: @${me.username} (${me.first_name})`);

const webhookSecret = randomBytes(24).toString("hex");

const actualizado = await supabase(
  `tenants?slug=eq.${slug}`,
  "PATCH",
  {
    telegram_bot_token: botToken,
    telegram_bot_username: me.username,
    telegram_webhook_secret: webhookSecret,
  }
);
if (!actualizado.length) {
  console.error(`No existe el tenant con slug "${slug}"`);
  process.exit(1);
}
console.log(`Tenant "${slug}" actualizado con el token del bot.`);

if (publicUrl) {
  const url = `${publicUrl.replace(/\/$/, "")}/api/telegram/webhook/${slug}`;
  await tg("setWebhook", {
    url,
    secret_token: webhookSecret,
    allowed_updates: ["message"],
  });
  await tg("setMyCommands", {
    commands: [{ command: "start", description: "Identificarme para operar" }],
  });
  console.log(`Webhook configurado: ${url}`);
} else {
  console.log("Sin public_url: token guardado, webhook NO configurado todavía.");
}
console.log("Listo.");
