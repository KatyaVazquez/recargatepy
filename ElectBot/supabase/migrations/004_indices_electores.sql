-- Índices sobre electores (creados DESPUES de la carga inicial de 2.8M filas).
-- ci_normalizado ya está indexado como PRIMARY KEY.

CREATE INDEX idx_electores_municipio
  ON electores (cod_dpto, cod_dist);

CREATE INDEX idx_electores_seccion
  ON electores (cod_dpto, cod_dist, cod_seccion);

CREATE INDEX idx_electores_mesa
  ON electores (cod_dpto, cod_dist, cod_seccion, cod_local, mesa);

CREATE INDEX idx_electores_apellido_trgm
  ON electores USING gin (apellido gin_trgm_ops);

CREATE INDEX idx_electores_nombre_trgm
  ON electores USING gin (nombre gin_trgm_ops);
