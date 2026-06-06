"use client";

import { useState } from "react";
import { Send, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resultadoAVista, type Tono, type Vista } from "@/lib/resultado-vista";
import type { ResultadoMensaje } from "@/lib/orquestador";

const TONO: Record<Tono, string> = {
  ok: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40",
  info: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40",
  warn: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
  danger: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
};
const TONO_TITULO: Record<Tono, string> = {
  ok: "text-emerald-700 dark:text-emerald-300",
  info: "text-blue-700 dark:text-blue-300",
  warn: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
};

type Rol = "Mesa_Guia" | "Veedor" | "KP";

// El ícono cambia de color según el rol (veedor en verde, pedido del cliente).
const ICONO_ROL: Record<Rol, string> = {
  Mesa_Guia: "bg-gradient-to-br from-red-600 to-red-800",
  Veedor: "bg-gradient-to-br from-emerald-500 to-emerald-700",
  KP: "bg-gradient-to-br from-amber-500 to-amber-700",
};

const ROL_LABEL: Record<Rol, string> = {
  Mesa_Guia: "Mesa Guía",
  Veedor: "Veedor",
  KP: "KP",
};

export function PwaClient({
  slug,
  token,
  nombre,
  rol,
  tenantNombre,
}: {
  slug: string;
  token: string;
  nombre: string;
  rol: Rol;
  tenantNombre: string;
}) {
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<"ci" | "orden">("ci");
  const [vista, setVista] = useState<Vista | null>(null);
  const [enviando, setEnviando] = useState(false);
  const rolLabel = ROL_LABEL[rol];

  // Solo el veedor puede elegir entre cédula y número de orden.
  const usaOrden = rol === "Veedor" && modo === "orden";

  const placeholder =
    rol === "Veedor"
      ? modo === "orden"
        ? "N° de orden en tu mesa"
        : "CI a marcar (o CORREGIR <ci>)"
      : "Número de cédula";

  const botonLabel = enviando
    ? "Enviando…"
    : rol === "Veedor"
      ? "Marcar voto"
      : rol === "KP"
        ? "Registrar saludo"
        : "Consultar";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/${slug}/pwa/operacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, texto, modo: rol === "Veedor" ? modo : "ci" }),
      });
      if (!res.ok) {
        setVista({ tono: "danger", titulo: "Error", lineas: ["No se pudo procesar. Reintentá."] });
        return;
      }
      const { resultado } = (await res.json()) as { resultado: ResultadoMensaje };
      setVista(resultadoAVista(resultado));
      setTexto("");
    } catch {
      setVista({ tono: "danger", titulo: "Sin conexión", lineas: ["Reintentá en unos segundos."] });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${ICONO_ROL[rol]}`}>
            <Vote className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{nombre}</p>
            <p className="text-xs text-muted-foreground">
              {rolLabel} · {tenantNombre}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            Contingencia
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        {rol === "Veedor" && (
          <div className="grid grid-cols-2 gap-2">
            {(["ci", "orden"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant={modo === m ? "default" : "outline"}
                onClick={() => {
                  setModo(m);
                  setTexto("");
                }}
                className="h-10"
              >
                {m === "ci" ? "Cédula" : "Orden"}
              </Button>
            ))}
          </div>
        )}

        <form onSubmit={enviar} className="space-y-3">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={placeholder}
            inputMode={usaOrden ? "numeric" : "text"}
            autoFocus
            className="h-14 text-center text-lg"
          />
          <Button type="submit" disabled={enviando} className="h-12 w-full text-base">
            <Send className="h-4 w-4" />
            {botonLabel}
          </Button>
        </form>

        {vista && (
          <div className={`rounded-xl border p-4 ${TONO[vista.tono]}`}>
            <p className={`font-bold ${TONO_TITULO[vista.tono]}`}>{vista.titulo}</p>
            <div className="mt-2 space-y-0.5">
              {vista.lineas.map((l, i) => (
                <p key={i} className="text-sm text-foreground">
                  {l}
                </p>
              ))}
            </div>
            {vista.nota && <p className="mt-3 text-sm font-medium text-foreground/80">{vista.nota}</p>}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Solo usar la PWA cuando el administrador active el canal de contingencia.
        </p>
      </main>
    </div>
  );
}
