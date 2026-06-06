"use client";

import { useEffect, useRef, useState } from "react";
import { Vote, Search, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { horaAsuncion } from "@/lib/fecha";

type Voto = {
  ci: string;
  hora: string;
  nombre: string | null;
  apellido: string | null;
  mesa: number | null;
  orden: number | null;
};
type Feed = {
  jornada: { nombre: string } | null;
  votos?: Voto[];
  actualizado?: string;
};
type Busqueda = {
  ci: string;
  error?: string;
  encontrado?: boolean;
  estado?: string | null;
  voto_at?: string | null;
  consulta_at?: string | null;
  nombre?: string | null;
  apellido?: string | null;
  mesa?: number | null;
  orden?: number | null;
};

const REFRESH_MS = 3_000;

function nombreCompleto(v: { nombre: string | null; apellido: string | null }): string {
  const partes = [v.apellido, v.nombre].filter(Boolean);
  return partes.length ? partes.join(", ") : "—";
}

function useFeed(slug: string) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/${slug}/en-vivo`, { cache: "no-store" });
        const json = (await res.json()) as Feed;
        if (activo) setFeed(json);
      } finally {
        if (activo) setCargando(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [slug]);

  return { feed, cargando };
}

function Buscador({ slug }: { slug: string }) {
  const [res, setRes] = useState<Busqueda | null>(null);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    const ci = inputRef.current?.value ?? "";
    if (!ci.trim()) return;
    setBuscando(true);
    try {
      const r = await fetch(`/api/${slug}/en-vivo?ci=${encodeURIComponent(ci)}`, {
        cache: "no-store",
      });
      const json = await r.json();
      setRes(json.busqueda ?? null);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={buscar} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            inputMode="numeric"
            placeholder="Buscar por cédula…"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={buscando}>
          {buscando ? "Buscando…" : "Buscar"}
        </Button>
        {res && (
          <Button type="button" variant="ghost" size="icon" onClick={() => setRes(null)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {res && (
        <div className="rounded-lg border bg-card p-4 text-sm">
          {res.error ? (
            <p className="text-muted-foreground">Cédula inválida.</p>
          ) : !res.encontrado ? (
            <p className="text-muted-foreground">
              <span className="font-mono">{res.ci}</span> — sin registros en esta jornada.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {nombreCompleto({ nombre: res.nombre ?? null, apellido: res.apellido ?? null })}{" "}
                <span className="font-mono text-xs text-muted-foreground">({res.ci})</span>
              </p>
              {res.estado === "Voto" ? (
                <p className="text-emerald-600 dark:text-emerald-400">
                  ✓ Ya votó {res.voto_at ? `a las ${horaAsuncion(res.voto_at)}` : ""}
                </p>
              ) : (
                <p className="text-amber-600 dark:text-amber-400">
                  Consultado{res.consulta_at ? ` a las ${horaAsuncion(res.consulta_at)}` : ""}, aún sin voto.
                </p>
              )}
              {res.mesa && res.orden && (
                <p className="text-muted-foreground">
                  Mesa {res.mesa} · Orden {res.orden}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EnVivoClient({ slug, tenantNombre }: { slug: string; tenantNombre: string }) {
  const { feed, cargando } = useFeed(slug);
  const votos = feed?.votos ?? [];
  const total = votos.length;

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-800 shadow-sm">
              <Vote className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-foreground">{tenantNombre}</p>
              <p className="text-xs text-muted-foreground">
                {feed?.jornada?.nombre ?? "En vivo"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              En vivo
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <Buscador slug={slug} />

        {cargando ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : !feed?.jornada ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No hay una jornada activa.
          </p>
        ) : (
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Votos entrando</span>
              <span className="text-xs text-muted-foreground">últimos {total}</span>
            </div>
            {total === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Todavía no entró ningún voto.
              </p>
            ) : (
              <div>
                <div className="grid grid-cols-[2.5rem_6rem_1fr_6rem_4rem] gap-3 border-b px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="text-right">#</span>
                  <span>CI</span>
                  <span>Nombre</span>
                  <span>Mesa/Orden</span>
                  <span className="text-right">Hora</span>
                </div>
                <ol className="divide-y">
                {votos.map((v, i) => (
                  <li
                    key={`${v.ci}-${v.hora}`}
                    className="grid grid-cols-[2.5rem_6rem_1fr_6rem_4rem] gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                      {total - i}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{v.ci}</span>
                    <span className="flex-1 font-medium text-foreground">
                      {nombreCompleto(v)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {v.mesa && v.orden ? `M ${v.mesa} · O ${v.orden}` : "—"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {horaAsuncion(v.hora)}
                    </span>
                  </li>
                ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
