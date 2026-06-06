"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { crearCandidato, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <UserPlus className="h-4 w-4" />
      {pending ? "Agregando…" : "Agregar candidato"}
    </Button>
  );
}

export function CandidatoForm({ slug }: { slug: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(crearCandidato, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      formRef.current?.reset();
    } else if (state && !state.ok) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="space-y-1.5">
        <Label htmlFor="tipo">Tipo</Label>
        <select
          id="tipo"
          name="tipo"
          defaultValue="Concejal"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          <option value="Concejal">Concejal</option>
          <option value="Intendente">Intendente</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nombre">
          Nombre <span className="text-red-500">*</span>
        </Label>
        <Input id="nombre" name="nombre" placeholder="Oscar Cantero" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lista">
          Lista <span className="text-xs text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="lista" name="lista" placeholder="2A" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="opcion">
          Opción <span className="text-xs text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="opcion" name="opcion" type="number" min={1} placeholder="24" />
      </div>
      <div className="sm:col-span-2 lg:col-span-1">
        <SubmitButton />
      </div>
    </form>
  );
}
