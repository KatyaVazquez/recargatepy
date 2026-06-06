-- Fijar search_path en las funciones (evita ataques por search_path mutable).

CREATE OR REPLACE FUNCTION eventos_solo_insert()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'La tabla eventos es append-only: % no permitido', TG_OP;
END;
$$;

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID LANGUAGE SQL STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;
