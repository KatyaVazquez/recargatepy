/**
 * Feed en vivo de votos de la jornada activa (estilo "ping -t"): devuelve los
 * últimos votos registrados, más recientes primero. Lo consume el panel
 * /<slug>/en-vivo con polling cada 3s.
 *
 * Con ?ci=NNN actúa como buscador de solo lectura: dice si esa persona ya votó
 * o consultó, sin generar eventos ni alertas.
 */
import { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJornadaActiva } from "@/lib/data";
import { normalizarCI } from "@/lib/ci";

type ElectorEmb = {
  nombre: string | null;
  apellido: string | null;
  mesa: number | null;
  orden: number | null;
} | null;
function unwrap(e: ElectorEmb | ElectorEmb[]): ElectorEmb {
  return Array.isArray(e) ? (e[0] ?? null) : e;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { tenant } = await requireTenantSession(slug);
  const db = createAdminClient();

  const jornada = await getJornadaActiva(db, tenant.id);
  if (!jornada) return NextResponse.json({ jornada: null });

  const ciParam = new URL(req.url).searchParams.get("ci");

  // ── Modo buscador (lupita): solo lectura ──────────────────────────────────
  if (ciParam !== null) {
    const ci = normalizarCI(ciParam);
    if (!ci.ok) {
      return NextResponse.json({ busqueda: { ci: ciParam, error: "ci_invalido" } });
    }
    const { data } = await db
      .from("participaciones")
      .select("estado, voto_at, ultima_consulta_at, electores(nombre, apellido, mesa, orden)")
      .eq("jornada_id", jornada.id)
      .eq("ci_normalizado", ci.ci)
      .maybeSingle();
    const el = data ? unwrap(data.electores as ElectorEmb | ElectorEmb[]) : null;
    return NextResponse.json({
      busqueda: {
        ci: ci.ci,
        encontrado: !!data,
        estado: data?.estado ?? null,
        voto_at: data?.voto_at ?? null,
        consulta_at: data?.ultima_consulta_at ?? null,
        nombre: el?.nombre ?? null,
        apellido: el?.apellido ?? null,
        mesa: el?.mesa ?? null,
        orden: el?.orden ?? null,
      },
    });
  }

  // ── Feed de votos ─────────────────────────────────────────────────────────
  const { data } = await db
    .from("participaciones")
    .select("ci_normalizado, voto_at, electores(nombre, apellido, mesa, orden)")
    .eq("jornada_id", jornada.id)
    .eq("estado", "Voto")
    .order("voto_at", { ascending: false })
    .limit(60);

  const votos = (data ?? []).map((v) => {
    const el = unwrap(v.electores as ElectorEmb | ElectorEmb[]);
    return {
      ci: v.ci_normalizado as string,
      hora: v.voto_at as string,
      nombre: el?.nombre ?? null,
      apellido: el?.apellido ?? null,
      mesa: el?.mesa ?? null,
      orden: el?.orden ?? null,
    };
  });

  return NextResponse.json({
    jornada: { nombre: jornada.nombre },
    votos,
    actualizado: new Date().toISOString(),
  });
}
