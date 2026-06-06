"use client";

import { useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { editarOperador } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CandidatoOpcion = { id: string; nombre: string; lista: string | null; opcion: number | null };
type Operador = {
  id: string;
  nombre: string | null;
  telefono: string;
  rol: "Mesa_Guia" | "Veedor" | "KP";
  mesa: number | null;
  puesto: number | null;
  candidato_id: string | null;
};

export function EditarOperadorButton({
  slug,
  operador,
  candidatos,
}: {
  slug: string;
  operador: Operador;
  candidatos: CandidatoOpcion[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [rol, setRol] = useState<"Mesa_Guia" | "Veedor" | "KP">(operador.rol);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await editarOperador(null, formData);
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        title="Editar operador"
        onClick={() => {
          setRol(operador.rol);
          setAbierto(true);
        }}
      >
        <Pencil className="h-4 w-4" />
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Editar operador</h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={onSubmit} className="space-y-4">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={operador.id} />

              <div className="space-y-1.5">
                <Label htmlFor="e-nombre">Nombre</Label>
                <Input id="e-nombre" name="nombre" defaultValue={operador.nombre ?? ""} placeholder="Juan Pérez" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e-telefono">
                  Teléfono <span className="text-red-500">*</span>
                </Label>
                <Input id="e-telefono" name="telefono" defaultValue={operador.telefono} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="e-rol">Rol</Label>
                  <select
                    id="e-rol"
                    name="rol"
                    value={rol}
                    onChange={(e) => setRol(e.target.value as "Mesa_Guia" | "Veedor" | "KP")}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <option value="Mesa_Guia">Mesa Guía</option>
                    <option value="Veedor">Veedor</option>
                    <option value="KP">KP</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  {rol === "Mesa_Guia" ? (
                    <>
                      <Label htmlFor="e-puesto">Puesto</Label>
                      <Input
                        id="e-puesto"
                        name="puesto"
                        type="number"
                        min={1}
                        defaultValue={operador.puesto ?? ""}
                      />
                    </>
                  ) : rol === "Veedor" ? (
                    <>
                      <Label htmlFor="e-mesa">Mesa</Label>
                      <Input
                        id="e-mesa"
                        name="mesa"
                        type="number"
                        min={1}
                        defaultValue={operador.mesa ?? ""}
                      />
                    </>
                  ) : (
                    <p className="pt-7 text-xs text-muted-foreground">KP: saluda por cédula.</p>
                  )}
                </div>
              </div>

              {(rol === "Mesa_Guia" || rol === "KP") && (
                <div className="space-y-1.5">
                  <Label htmlFor="e-candidato">Candidato (equipo)</Label>
                  <select
                    id="e-candidato"
                    name="candidato_id"
                    defaultValue={operador.candidato_id ?? ""}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <option value="">— Sin asignar —</option>
                    {candidatos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                        {c.lista ? ` (${c.lista}${c.opcion ? `·${c.opcion}` : ""})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
