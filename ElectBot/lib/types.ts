/** Tipos del dominio. Hand-written y mínimos (solo lo que usamos). */

export type Canal = "Telegram" | "PWA";
export type RolOperador = "Mesa_Guia" | "Veedor" | "KP";
export type Severidad = "Amarilla" | "Naranja" | "Roja" | "Critica";

export type Tenant = {
  id: string;
  slug: string;
  nombre: string;
  cod_dpto: number;
  cod_dist: number;
  status: "activo" | "suspendido";
};

export type Jornada = {
  id: string;
  tenant_id: string;
  nombre: string;
  filtro_secciones: number[] | null; // null = todo el municipio
  estado: "activa" | "cerrada";
  correccion_ventana_minutos: number;
};

export type Usuario = {
  id: string;
  tenant_id: string;
  telegram_id: number | null;
  telefono: string;
  nombre: string | null;
  rol: RolOperador;
  cod_seccion: number | null;
  cod_local: number | null;
  mesa: number | null;
  puesto: number | null;
  candidato_id: string | null; // Equipo/concejal asignado (Mesa Guía o KP)
  estado: "Activo" | "Bloqueado";
};

export type TipoCandidato = "Intendente" | "Concejal";

export type Candidato = {
  id: string;
  tenant_id: string;
  tipo: TipoCandidato;
  nombre: string;
  lista: string | null;
  opcion: number | null;
  orden: number;
};

export type Elector = {
  ci_normalizado: string;
  apellido: string;
  nombre: string;
  cod_dpto: number;
  cod_dist: number;
  cod_seccion: number;
  cod_local: number;
  mesa: number;
  orden: number;
  nombre_local: string | null;
  nombre_seccion: string | null;
  nombre_distrito: string | null;
};

/** Contexto de una operación, común a Telegram y PWA. */
export type Contexto = {
  tenant: Tenant;
  jornada: Jornada;
  usuario: Usuario;
  canal: Canal;
};
