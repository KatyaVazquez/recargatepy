/**
 * Operación desde la PWA (canal de contingencia). Misma lógica que el bot.
 *   POST { token, texto } -> ResultadoMensaje
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarTokenOperador } from "@/lib/token-operador";
import { getJornadaActiva, getTenantBySlug } from "@/lib/data";
import { procesarMensaje, type ModoEntrada } from "@/lib/orquestador";
import type { Contexto, Usuario } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { token, texto, modo } = (await req.json().catch(() => ({}))) as {
    token?: string;
    texto?: string;
    modo?: ModoEntrada;
  };

  const usuarioId = token ? verificarTokenOperador(token) : null;
  if (!usuarioId) {
    return NextResponse.json({ error: "token_invalido" }, { status: 401 });
  }

  const db = createAdminClient();

  const { data: usuario } = await db
    .from("usuarios")
    .select("*")
    .eq("id", usuarioId)
    .maybeSingle();
  if (!usuario || (usuario as Usuario).estado === "Bloqueado") {
    return NextResponse.json({ error: "no_autorizado" }, { status: 403 });
  }
  const u = usuario as Usuario;

  // El slug del path debe coincidir con el tenant del operador.
  const tenant = await getTenantBySlug(db, slug);
  if (!tenant || tenant.id !== u.tenant_id) {
    return NextResponse.json({ error: "tenant_invalido" }, { status: 403 });
  }

  const jornada = await getJornadaActiva(db, tenant.id);
  if (!jornada) {
    return NextResponse.json({ error: "sin_jornada" }, { status: 409 });
  }

  const ctx: Contexto = { tenant, jornada, usuario: u, canal: "PWA" };
  const resultado = await procesarMensaje(db, ctx, texto ?? "", {
    modo: modo === "orden" ? "orden" : "ci",
  });

  return NextResponse.json({ resultado });
}
