/**
 * Webhook de Telegram, uno por tenant: /api/telegram/webhook/<slug>
 *
 * - Resuelve el tenant por slug.
 * - Valida el secret_token del header contra el del tenant.
 * - Idempotencia por (tenant_id, update_id).
 * - Siempre responde 200 para que Telegram no reintente; los errores se loguean.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBotConfig, getTenantBySlug } from "@/lib/data";
import { manejarUpdate, type TgUpdate } from "@/lib/telegram/handler";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const db = createAdminClient();

  const tenant = await getTenantBySlug(db, slug);
  if (!tenant) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const { token, webhookSecret } = await getBotConfig(db, tenant.id);
  if (!token || !webhookSecret) {
    // Bot no configurado todavía: aceptamos el update pero no hacemos nada.
    return NextResponse.json({ ok: true });
  }

  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader !== webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Idempotencia: si ya procesamos este update_id, salimos.
  const { error: dupError } = await db
    .from("telegram_updates_procesados")
    .insert({ tenant_id: tenant.id, update_id: update.update_id });
  if (dupError) {
    // Conflicto de PK = ya procesado. Cualquier otro error: logueamos y salimos 200.
    return NextResponse.json({ ok: true });
  }

  try {
    await manejarUpdate(db, token, tenant, update);
  } catch (err) {
    // No reintentar desde Telegram: respondemos 200 igual y dejamos rastro.
    console.error(`[webhook ${slug}] error procesando update`, err);
  }

  return NextResponse.json({ ok: true });
}
