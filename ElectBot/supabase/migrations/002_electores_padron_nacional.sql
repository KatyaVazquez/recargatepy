-- ════════════════════════════════════════════════════════════════════════
-- Padrón nacional ANR (~2.8M electores). Read-only en runtime.
-- Tabla compartida entre todos los tenants. Carga vía scripts/migrate_padron.py
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE electores (
  ci_normalizado TEXT PRIMARY KEY,
  ci_original TEXT NOT NULL,
  apellido TEXT NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  fecha_nacimiento DATE,
  sexo SMALLINT, -- 1 masculino, 2 femenino

  -- ubicación geográfica / electoral
  cod_dpto SMALLINT NOT NULL,
  cod_dist SMALLINT NOT NULL,
  cod_seccion SMALLINT NOT NULL,
  cod_local SMALLINT NOT NULL,
  mesa SMALLINT NOT NULL,
  orden SMALLINT NOT NULL,

  -- denormalizado para responder al operador sin JOIN (lookup en <1ms)
  nombre_local TEXT,
  nombre_seccion TEXT,
  nombre_distrito TEXT,
  nombre_departamento TEXT,

  FOREIGN KEY (cod_dpto, cod_dist, cod_seccion, cod_local)
    REFERENCES locales_votacion(cod_dpto, cod_dist, cod_seccion, cod_local)
);

COMMENT ON TABLE electores IS 'Padrón nacional ANR 2026. ~2.8M filas. Read-only en runtime.';
