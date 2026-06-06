"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Bell, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const links = [
    { href: `/${slug}/admin`, label: "Operadores", icon: Users },
    { href: `/${slug}/admin/candidatos`, label: "Candidatos", icon: Award },
    { href: `/${slug}/admin/alertas`, label: "Alertas", icon: Bell },
  ];
  return (
    <nav className="flex items-center gap-1">
      {links.map(({ href, label, icon: Icon }) => {
        const activo = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activo
                ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
