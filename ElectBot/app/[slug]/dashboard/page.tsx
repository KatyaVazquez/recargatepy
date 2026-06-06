import { requireTenantSession } from "@/lib/auth";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tenant } = await requireTenantSession(slug);
  return <DashboardClient slug={slug} tenantNombre={tenant.nombre} />;
}
