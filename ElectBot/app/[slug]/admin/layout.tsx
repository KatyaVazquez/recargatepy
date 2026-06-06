import { Vote, LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminNav } from "./nav";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tenant, email } = await requireAdmin(slug);

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-800 shadow-sm">
              <Vote className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-foreground">
                {tenant.nombre}
              </p>
              <p className="text-xs text-muted-foreground">Panel de administración</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AdminNav slug={slug} />
            <div className="ml-2 hidden h-6 w-px bg-border sm:block" />
            <span className="hidden text-xs text-muted-foreground md:inline">{email}</span>
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
