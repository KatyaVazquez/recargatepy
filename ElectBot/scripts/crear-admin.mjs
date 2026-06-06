#!/usr/bin/env node
/**
 * Crea (o actualiza) la cuenta de admin de un tenant en Supabase Auth, con el
 * claim app_metadata.tenant_id que usan las políticas RLS.
 *
 *   node scripts/crear-admin.mjs <slug> <email> <password>
 *
 * Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY de .env.local.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const [, , slug, email, password] = process.argv;
if (!slug || !email || !password) {
  console.error("Uso: node scripts/crear-admin.mjs <slug> <email> <password>");
  process.exit(1);
}

const h = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/json",
};

// 1) Resolver tenant_id por slug
const tRes = await fetch(`${URL}/rest/v1/tenants?slug=eq.${slug}&select=id,nombre`, { headers: h });
const tenants = await tRes.json();
if (!tenants.length) {
  console.error(`No existe tenant "${slug}"`);
  process.exit(1);
}
const tenantId = tenants[0].id;
console.log(`Tenant: ${tenants[0].nombre} (${tenantId})`);

// 2) Crear el usuario de Auth con el claim tenant_id
const res = await fetch(`${URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId, rol: "admin" },
  }),
});
const body = await res.json();
if (!res.ok) {
  console.error(`Error creando usuario: ${res.status} ${JSON.stringify(body)}`);
  process.exit(1);
}
console.log(`Admin creado: ${email} (id ${body.id})`);
console.log(`Login en: http://${slug}.localhost:3001/login`);
