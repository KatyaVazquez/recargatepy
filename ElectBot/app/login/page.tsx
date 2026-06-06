import { Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-slate-950 p-4">
      {/* fondo decorativo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-red-700/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-red-900/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-800 shadow-lg shadow-red-700/30">
            <Vote className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">ElectBot</h1>
          <p className="mt-1 text-sm text-slate-400">Inteligencia electoral en tiempo real</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <form action={signIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="admin@municipio.com"
                className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                Contraseña
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
              />
            </div>
            {error === "credenciales" && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                Email o contraseña incorrectos.
              </p>
            )}
            {error === "tenant" && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                Tu cuenta no pertenece a este municipio.
              </p>
            )}
            <Button
              type="submit"
              className="w-full bg-gradient-to-br from-red-600 to-red-800 text-white hover:from-red-700 hover:to-red-900"
            >
              Ingresar
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Acceso exclusivo para administradores del municipio.
        </p>
      </div>
    </div>
  );
}
