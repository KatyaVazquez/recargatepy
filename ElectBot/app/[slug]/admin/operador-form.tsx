"use client";

import { useRef, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { crearOperador } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CandidatoOpcion = { id: string; nombre: string; lista: string | null; opcion: number | null };

export function OperadorForm({
  slug,
  candidatos,
}: {
  slug: string;
  candidatos: CandidatoOpcion[];
}) {
  const [rol, setRol] = useState<"Mesa_Guia" | "Veedor" | "KP">("Mesa_Guia");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await crearOperador(null, formData);
      if (res?.ok) {
        toast.success(res.message);
        formRef.current?.reset();
        setRol("Mesa_Guia");
      } else if (res) {
        toast.error(res.message);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" name="nombre" placeholder="Juan Pérez" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="telefono">
          Teléfono <span className="text-red-500">*</span>
        </Label>
        <Input id="telefono" name="telefono" placeholder="0981 123456" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rol">Rol</Label>
        <select
          id="rol"
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
            <Label htmlFor="puesto">
              Puesto <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="puesto" name="puesto" type="number" min={1} placeholder="N° de puesto" />
          </>
        ) : rol === "Veedor" ? (
          <>
            <Label htmlFor="mesa">
              Mesa <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="mesa" name="mesa" type="number" min={1} placeholder="N° de mesa" />
          </>
        ) : (
          <p className="pt-7 text-xs text-muted-foreground">
            El KP saluda por cédula; no necesita mesa.
          </p>
        )}
      </div>
      {(rol === "Mesa_Guia" || rol === "KP") && (
        <div className="space-y-1.5">
          <Label htmlFor="candidato_id">
            Candidato <span className="text-xs text-muted-foreground">(equipo)</span>
          </Label>
          <select
            id="candidato_id"
            name="candidato_id"
            defaultValue=""
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
      <div className="sm:col-span-2 lg:col-span-5">
        <Button type="submit" disabled={pending}>
          <UserPlus className="h-4 w-4" />
          {pending ? "Agregando…" : "Agregar operador"}
        </Button>
      </div>
    </form>
  );
}
