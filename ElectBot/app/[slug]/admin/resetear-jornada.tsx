"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { resetearJornada } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** tenantNombre: el admin debe tipearlo para confirmar el borrado. */
export function ResetearJornada({ slug, tenantNombre }: { slug: string; tenantNombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await resetearJornada(null, formData);
      if (res?.ok) {
        toast.success(res.message);
        setAbierto(false);
      } else if (res) {
        toast.error(res.message);
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
        <Trash2 className="h-4 w-4" />
        Resetear jornada
      </Button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAbierto(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-red-600">
                <AlertTriangle className="h-4 w-4" /> Resetear jornada
              </h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Borra <strong>participaciones, alertas y eventos</strong> de la jornada activa.
              Conserva operadores y candidatos. Esta acción no se puede deshacer.
            </p>
            <form action={onSubmit} className="space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <div className="space-y-1.5">
                <Label htmlFor="confirmacion">
                  Escribí <span className="font-mono font-semibold">{tenantNombre}</span> para confirmar
                </Label>
                <Input id="confirmacion" name="confirmacion" autoComplete="off" placeholder={tenantNombre} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="destructive" disabled={pending}>
                  <Trash2 className="h-4 w-4" />
                  {pending ? "Borrando…" : "Resetear jornada"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
