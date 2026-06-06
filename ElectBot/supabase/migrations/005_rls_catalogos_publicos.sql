-- Habilita RLS en catálogos nacionales con lectura para usuarios autenticados.
-- Escritura solo via service_role (bypassa RLS) en la carga del padrón.

ALTER TABLE departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE distritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE secciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE locales_votacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE electores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_departamentos" ON departamentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_read_distritos" ON distritos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_read_secciones" ON secciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_read_locales" ON locales_votacion
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_read_electores" ON electores
  FOR SELECT TO authenticated USING (true);
