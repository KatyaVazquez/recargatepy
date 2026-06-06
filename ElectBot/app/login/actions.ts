"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=credenciales");
  }
  const meta = data.user?.app_metadata as { rol?: string; tenant_id?: string };
  if (!meta?.tenant_id) redirect("/login?error=tenant");

  // Admin: resolver slug del tenant para redirigir a /<slug>/admin.
  const db = createAdminClient();
  const { data: t } = await db
    .from("tenants")
    .select("slug")
    .eq("id", meta.tenant_id)
    .maybeSingle();
  if (!t?.slug) redirect("/login?error=tenant");
  redirect(`/${t.slug}/admin`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
