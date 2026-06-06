/**
 * Helpers de autenticación y resolución de tenant para Server Components.
 * El tenant se identifica por el slug del path (`/[slug]/...`), que los
 * layouts y páginas reciben como `params.slug`.
 */
import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantBySlug } from "@/lib/data";
import type { Tenant } from "@/lib/types";

/** Tenant activo identificado por slug del path. 404 si no existe o está suspendido. */
export async function getTenantActual(slug: string): Promise<Tenant> {
  const tenant = await getTenantBySlug(createAdminClient(), slug);
  if (!tenant) notFound();
  return tenant;
}

/**
 * Exige admin autenticado cuyo claim `tenant_id` coincida con el tenant del path.
 * Redirige a /login si no hay sesión o el claim no coincide.
 */
export async function requireAdmin(slug: string): Promise<{ tenant: Tenant; email: string }> {
  const tenant = await getTenantActual(slug);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const claimTenant = (user.app_metadata as { tenant_id?: string })?.tenant_id;
  if (claimTenant !== tenant.id) redirect("/login?error=tenant");

  return { tenant, email: user.email ?? "" };
}

/** Igual que requireAdmin; alias para vistas de solo lectura (dashboard). */
export async function requireTenantSession(slug: string): Promise<{ tenant: Tenant; email: string }> {
  return requireAdmin(slug);
}

