import { createAdminClient } from "@/lib/supabase/admin";
import { verificarTokenOperador } from "@/lib/token-operador";
import { getTenantActual } from "@/lib/auth";
import type { Usuario } from "@/lib/types";
import { PwaClient } from "./pwa-client";

export default async function PwaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  const usuarioId = t ? verificarTokenOperador(t) : null;

  const Mensaje = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-svh items-center justify-center bg-background p-6 text-center text-muted-foreground">
      {children}
    </div>
  );

  if (!usuarioId) {
    return <Mensaje>Link inválido o vencido. Pedí al administrador un link nuevo.</Mensaje>;
  }

  const db = createAdminClient();
  const { data } = await db.from("usuarios").select("*").eq("id", usuarioId).maybeSingle();
  const usuario = data as Usuario | null;
  const tenant = await getTenantActual(slug);

  if (!usuario || tenant.id !== usuario.tenant_id) {
    return <Mensaje>Link inválido para este municipio.</Mensaje>;
  }
  if (usuario.estado === "Bloqueado") {
    return <Mensaje>Tu cuenta fue bloqueada. Contactá al administrador.</Mensaje>;
  }

  return (
    <PwaClient
      slug={slug}
      token={t!}
      nombre={usuario.nombre ?? "Operador"}
      rol={usuario.rol}
      tenantNombre={tenant.nombre}
    />
  );
}
