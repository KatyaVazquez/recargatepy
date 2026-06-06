"use client";

import { useEffect, useState } from "react";
import { Vote, Coins, Clock, Handshake, Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { horaAsuncion } from "@/lib/fecha";

type Resumen = {
  padron_total: number;
  votaron: number;
  votos_registrados: number;
  votos_estimados: number;
  consultas_totales: number;
  saludos_kp: number;
  consultados: number;
  pendientes: number;
  alertas: Partial<Record<"Amarilla" | "Naranja" | "Roja" | "Critica", number>>;
  evolucion_horaria: { hora: string; votos: number }[];
  ranking_operadores: { nombre: string; votos: number }[];
  ranking_candidatos: { nombre: string; votos: number }[];
  saludos_por_candidato?: { nombre: string; saludos: number }[];
  ranking_mesas: { mesa: number; votos: number; padron_mesa?: number }[];
};

type Data = {
  jornada: { nombre: string } | null;
  resumen?: Resumen;
  actualizado?: string;
};

const REFRESH_MS = 30_000;

function useDashboard(slug: string) {
  const [data, setData] = useState<Data | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/${slug}/dashboard`, { cache: "no-store" });
        const json = (await res.json()) as Data;
        if (activo) setData(json);
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

  return { data, cargando };
}

function pct(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

export function DashboardClient({ slug, tenantNombre }: { slug: string; tenantNombre: string }) {
  const { data, cargando } = useDashboard(slug);

  if (cargando) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
        Cargando métricas…
      </div>
    );
  }
  if (!data?.jornada || !data.resumen) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
        No hay una jornada activa.
      </div>
    );
  }

  const r = data.resumen;
  const rankingOperadores = r.ranking_operadores.slice(0, 20);
  const saludosPorCandidato = r.saludos_por_candidato ?? [];
  const participacion = pct(r.votaron, r.padron_total);
  const maxHora = Math.max(1, ...r.evolucion_horaria.map((e) => e.votos));
  // "TEAM …" en lugar de "Comité …" (branding pedido por el cliente).
  const nombreEquipo = tenantNombre.replace(/^comit[ée]\s*/i, "TEAM ");

  return (
    <div className="min-h-svh bg-background">
      {/* header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-800 shadow-sm">
              <Vote className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-foreground">{nombreEquipo}</p>
              <p className="text-xs text-muted-foreground">{data.jornada.nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {data.actualizado ? `Actualizado ${horaAsuncion(data.actualizado)}` : "En vivo"}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* participación + stats */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="shadow-sm lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Participación</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div
                className="relative flex h-44 w-44 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(var(--color-chart-1, #2563eb) ${participacion}%, var(--muted) 0)`,
                }}
              >
                <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-card">
                  <span className="text-3xl font-bold text-foreground">{participacion}%</span>
                  <span className="text-xs text-muted-foreground">votó</span>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {r.votaron.toLocaleString("es-PY")} de {r.padron_total.toLocaleString("es-PY")}
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:col-span-2">
            <StatBig icon={Vote} label="Total de Votos Registrados" value={r.votos_registrados} tint="text-emerald-600 dark:text-emerald-400" />
            <StatBig icon={Coins} label="Votos Totales Estimados" value={r.votos_estimados} tint="text-amber-600 dark:text-amber-400" />
            <StatBig icon={Clock} label="Consultas Totales" value={r.consultas_totales} tint="text-red-600 dark:text-red-400" />
            <StatBig icon={Handshake} label="Saludos (KP)" value={r.saludos_kp} tint="text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        {/* fila 1: evolución + votos por candidato */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Evolución horaria</CardTitle>
            </CardHeader>
            <CardContent>
              {r.evolucion_horaria.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin votos todavía.</p>
              ) : (
                <div className="flex h-40 items-end justify-between gap-1">
                  {r.evolucion_horaria.map((e) => (
                    <div key={e.hora} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-red-600 to-red-400"
                        style={{ height: `${(e.votos / maxHora) * 100}%`, minHeight: 4 }}
                        title={`${e.votos} votos`}
                      />
                      <span className="text-[10px] text-muted-foreground">{e.hora}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-red-500" /> Intención por Candidato
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(r.ranking_candidatos ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin actividad todavía.</p>
              ) : (
                <ol className="space-y-2">
                  {r.ranking_candidatos.map((c, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                          {i + 1}
                        </span>
                        <span className="text-sm text-foreground">{c.nombre}</span>
                      </span>
                      <span className="text-sm font-semibold text-foreground">{c.votos}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* fila 2: ranking veedores + votos por mesa */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-amber-500" /> Ranking de Operadores
              </CardTitle>
              <p className="text-xs text-muted-foreground">Top 20 por consultas procesadas.</p>
            </CardHeader>
            <CardContent>
              {rankingOperadores.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin actividad todavía.</p>
              ) : (
                <ol className="space-y-2">
                  {rankingOperadores.map((op, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                          {i + 1}
                        </span>
                        <span className="text-sm text-foreground">{op.nombre}</span>
                      </span>
                      <span className="text-sm font-semibold text-foreground">{op.votos}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-slate-500" /> Votos por mesa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(r.ranking_mesas ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin actividad todavía.</p>
              ) : (
                <ol className="space-y-2">
                  {r.ranking_mesas.map((m, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                          {i + 1}
                        </span>
                        <span className="text-sm text-foreground">Mesa {m.mesa}</span>
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {m.padron_mesa ? `${m.votos}/${m.padron_mesa}` : m.votos}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {saludosPorCandidato.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Handshake className="h-4 w-4 text-indigo-500" /> Saludos KP por equipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {saludosPorCandidato.map((c, i) => (
                  <li key={`${c.nombre}-${i}`} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm text-foreground">{c.nombre}</span>
                    <span className="text-sm font-semibold text-foreground">{c.saludos}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  );
}

function StatBig({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Vote;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="py-6">
        <Icon className={`h-5 w-5 ${tint}`} />
        <p className="mt-3 text-3xl font-bold text-foreground">
          {value.toLocaleString("es-PY")}
        </p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
