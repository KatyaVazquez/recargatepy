/**
 * Métricas del dashboard de la jornada activa del tenant.
 * Lo consume el dashboard del candidato con polling cada 30s.
 */
import { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJornadaActiva } from "@/lib/data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { tenant } = await requireTenantSession(slug);
  const db = createAdminClient();

  const jornada = await getJornadaActiva(db, tenant.id);
  if (!jornada) {
    return NextResponse.json({ jornada: null });
  }

  const { data, error } = await db.rpc("dashboard_resumen", {
    p_jornada: jornada.id,
  });
  if (error) {
    return NextResponse.json({ error: "no_disponible" }, { status: 500 });
  }

  return NextResponse.json({
    jornada: { nombre: jornada.nombre },
    resumen: data,
    actualizado: new Date().toISOString(),
  });
}
