/**
 * Acceso central y tipado a las variables de entorno.
 * Falla temprano y con mensaje claro si falta alguna requerida.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

/** Solo en el servidor: clave secreta que bypassa RLS. Nunca exponer al cliente. */
export function serverEnv() {
  return {
    supabaseSecretKey: required("SUPABASE_SECRET_KEY"),
  };
}
