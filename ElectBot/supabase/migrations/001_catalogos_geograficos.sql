-- ════════════════════════════════════════════════════════════════════════
-- Catálogos geográficos del padrón nacional ANR Paraguay.
-- Compartidos entre todos los tenants (read-only).
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE departamentos (
  cod_dpto SMALLINT PRIMARY KEY,
  nombre TEXT NOT NULL
);

CREATE TABLE distritos (
  cod_dpto SMALLINT NOT NULL,
  cod_dist SMALLINT NOT NULL,
  nombre TEXT NOT NULL,
  PRIMARY KEY (cod_dpto, cod_dist),
  FOREIGN KEY (cod_dpto) REFERENCES departamentos(cod_dpto)
);

CREATE TABLE secciones (
  cod_dpto SMALLINT NOT NULL,
  cod_dist SMALLINT NOT NULL,
  cod_seccion SMALLINT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  direccion TEXT,
  PRIMARY KEY (cod_dpto, cod_dist, cod_seccion),
  FOREIGN KEY (cod_dpto, cod_dist) REFERENCES distritos(cod_dpto, cod_dist)
);

CREATE TABLE locales_votacion (
  cod_dpto SMALLINT NOT NULL,
  cod_dist SMALLINT NOT NULL,
  cod_seccion SMALLINT NOT NULL,
  cod_local SMALLINT NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  PRIMARY KEY (cod_dpto, cod_dist, cod_seccion, cod_local),
  FOREIGN KEY (cod_dpto, cod_dist, cod_seccion)
    REFERENCES secciones(cod_dpto, cod_dist, cod_seccion)
);

COMMENT ON TABLE departamentos IS 'Catálogo nacional: 17 departamentos + capital + 3 exterior';
COMMENT ON TABLE distritos IS 'Catálogo nacional: 266 distritos (= municipios)';
COMMENT ON TABLE secciones IS 'Catálogo nacional: 411 secciones del partido';
COMMENT ON TABLE locales_votacion IS 'Catálogo nacional: 512 locales de votación';
