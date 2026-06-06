import { requireTenantSession } from "@/lib/auth";
import { EnVivoClient } from "./en-vivo-client";

export default async function EnVivoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tenant } = await requireTenantSession(slug);
  return <EnVivoClient slug={slug} tenantNombre={tenant.nombre} />;
}
