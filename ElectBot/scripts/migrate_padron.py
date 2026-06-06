#!/usr/bin/env python3
"""
Migra el padrón ANR desde FoxPro (.dbf) a Supabase Postgres vía PostgREST.

Lee:
  ANR2026/mas_pda.dbf      (2.804.550 electores)
  ANR2026/secc_local.dbf   (512 locales)
  ANR2026/seccio.dbf       (411 secciones, con nombres de depto/distrito)

Pobla:
  departamentos, distritos, secciones, locales_votacion (catálogos)
  electores (padrón nacional con campos denormalizados)

Sin dependencias externas (urllib + json + struct de stdlib).

Uso:
  python3 scripts/migrate_padron.py

Variables de entorno requeridas (.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SECRET_KEY (bypassa RLS)
"""
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

# ─── Config ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
DBF_DIR = ROOT / 'ANR2026'
BATCH_SIZE = 5000  # filas por POST. 5k es buen balance entre throughput y memoria.


def load_env():
    env = {}
    env_file = ROOT / '.env.local'
    if not env_file.exists():
        print(f'ERROR: {env_file} no existe', file=sys.stderr)
        sys.exit(1)
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    return env


ENV = load_env()
SUPABASE_URL = ENV.get('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = ENV.get('SUPABASE_SECRET_KEY') or ENV.get('SUPABASE_SERVICE_ROLE_KEY')
if not SUPABASE_URL or not SUPABASE_KEY:
    print('ERROR: SUPABASE_URL o SUPABASE_KEY faltan en .env.local', file=sys.stderr)
    sys.exit(1)


# ─── DBF parsing (sin dependencias) ──────────────────────────────────────────
def read_dbf(path):
    """Lee un DBF de FoxPro/dBase devuelve list[dict]. Encoding Latin-1."""
    with open(path, 'rb') as f:
        header = f.read(32)
        num_records = struct.unpack('<I', header[4:8])[0]
        header_len = struct.unpack('<H', header[8:10])[0]
        record_len = struct.unpack('<H', header[10:12])[0]

        fields = []
        while True:
            fd = f.read(32)
            if not fd or fd[0] == 0x0D or len(fd) < 32:
                break
            name = fd[:11].split(b'\x00')[0].decode('ascii', errors='replace')
            ftype = chr(fd[11])
            length = fd[16]
            fields.append({'name': name, 'type': ftype, 'length': length})

        f.seek(header_len)
        rows = []
        for _ in range(num_records):
            rec = f.read(record_len)
            if len(rec) < record_len:
                break
            if rec[0:1] == b'*':
                continue
            row = {}
            offset = 1
            for fld in fields:
                raw = rec[offset:offset + fld['length']]
                offset += fld['length']
                if fld['type'] == 'C':
                    val = raw.decode('latin-1').rstrip()
                elif fld['type'] in ('N', 'F'):
                    s = raw.decode('ascii').strip()
                    try:
                        val = int(s) if s else None
                    except ValueError:
                        val = None
                elif fld['type'] == 'D':
                    s = raw.decode('ascii').strip()
                    val = s if s and s != '00000000' else None
                else:
                    val = raw.decode('latin-1', errors='replace').strip()
                row[fld['name']] = val
            rows.append(row)
        return rows


def stream_dbf(path):
    """Iterador sobre un DBF, devuelve dicts uno por uno (memoria constante)."""
    with open(path, 'rb') as f:
        header = f.read(32)
        num_records = struct.unpack('<I', header[4:8])[0]
        header_len = struct.unpack('<H', header[8:10])[0]
        record_len = struct.unpack('<H', header[10:12])[0]

        fields = []
        while True:
            fd = f.read(32)
            if not fd or fd[0] == 0x0D or len(fd) < 32:
                break
            name = fd[:11].split(b'\x00')[0].decode('ascii', errors='replace')
            ftype = chr(fd[11])
            length = fd[16]
            fields.append({'name': name, 'type': ftype, 'length': length})

        f.seek(header_len)
        for _ in range(num_records):
            rec = f.read(record_len)
            if len(rec) < record_len:
                break
            if rec[0:1] == b'*':
                continue
            row = {}
            offset = 1
            for fld in fields:
                raw = rec[offset:offset + fld['length']]
                offset += fld['length']
                if fld['type'] == 'C':
                    val = raw.decode('latin-1').rstrip()
                elif fld['type'] in ('N', 'F'):
                    s = raw.decode('ascii').strip()
                    try:
                        val = int(s) if s else None
                    except ValueError:
                        val = None
                elif fld['type'] == 'D':
                    s = raw.decode('ascii').strip()
                    val = s if s and s != '00000000' else None
                else:
                    val = raw.decode('latin-1', errors='replace').strip()
                row[fld['name']] = val
            yield row


# ─── HTTP helper (PostgREST) ─────────────────────────────────────────────────
def post_batch(table, rows, retries=3):
    """POST con upsert (resolution=merge-duplicates) y reintentos."""
    url = f'{SUPABASE_URL}/rest/v1/{table}'
    body = json.dumps(rows, ensure_ascii=False).encode('utf-8')
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
    }
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=60) as resp:
                if resp.status in (200, 201, 204):
                    return
                raise RuntimeError(f'HTTP {resp.status}: {resp.read()[:500]!r}')
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')[:1000]
            last_err = f'HTTP {e.code}: {err_body}'
            if e.code == 409 or e.code == 400:
                # Error de datos, no reintentar
                raise RuntimeError(last_err)
            time.sleep(2 ** attempt)
        except (urllib.error.URLError, TimeoutError) as e:
            last_err = repr(e)
            time.sleep(2 ** attempt)
    raise RuntimeError(f'Falló después de {retries} reintentos: {last_err}')


def insert_in_batches(table, rows, batch_size=BATCH_SIZE, label=None):
    label = label or table
    total = len(rows)
    if total == 0:
        print(f'  {label}: nada que insertar')
        return
    print(f'  {label}: insertando {total:,} filas en batches de {batch_size:,}...')
    t0 = time.time()
    inserted = 0
    for i in range(0, total, batch_size):
        chunk = rows[i:i + batch_size]
        post_batch(table, chunk)
        inserted += len(chunk)
        elapsed = time.time() - t0
        rate = inserted / elapsed if elapsed > 0 else 0
        eta = (total - inserted) / rate if rate > 0 else 0
        pct = 100 * inserted / total
        print(f'    [{pct:5.1f}%] {inserted:>10,} / {total:,} '
              f'({rate:>7,.0f} filas/s, ETA {eta:>4.0f}s)')
    elapsed = time.time() - t0
    print(f'  {label}: ✓ {total:,} filas en {elapsed:.1f}s ({total/elapsed:,.0f} filas/s)')


def stream_insert(table, iterator, batch_size=BATCH_SIZE, total_hint=None, label=None):
    """Inserta filas de un iterador en batches sin cargar todo en memoria."""
    label = label or table
    print(f'  {label}: streaming en batches de {batch_size:,} '
          f'(esperado ~{total_hint:,} filas)...' if total_hint else
          f'  {label}: streaming en batches de {batch_size:,}...')
    t0 = time.time()
    inserted = 0
    buffer = []
    for row in iterator:
        buffer.append(row)
        if len(buffer) >= batch_size:
            post_batch(table, buffer)
            inserted += len(buffer)
            buffer = []
            elapsed = time.time() - t0
            rate = inserted / elapsed if elapsed > 0 else 0
            if total_hint:
                eta = (total_hint - inserted) / rate if rate > 0 else 0
                pct = 100 * inserted / total_hint
                print(f'    [{pct:5.1f}%] {inserted:>10,} / {total_hint:,} '
                      f'({rate:>7,.0f} filas/s, ETA {eta:>5.0f}s)')
            else:
                print(f'    {inserted:>10,} filas ({rate:>7,.0f} filas/s)')
    if buffer:
        post_batch(table, buffer)
        inserted += len(buffer)
    elapsed = time.time() - t0
    print(f'  {label}: ✓ {inserted:,} filas en {elapsed:.1f}s ({inserted/elapsed:,.0f} filas/s)')
    return inserted


# ─── Construcción de catálogos ───────────────────────────────────────────────
def scan_electores_para_catalogos():
    """Primer pase rápido sobre mas_pda.dbf: descubre todas las combinaciones
    únicas (dpto, dist, sec, local) que aparecen en electores. Devuelve un set."""
    print('Pre-scan de mas_pda.dbf para descubrir todas las combinaciones geográficas...')
    t0 = time.time()
    combos = set()
    dist_combos = set()
    sec_combos = set()
    dptos = set()
    n = 0
    for row in stream_dbf(DBF_DIR / 'mas_pda.dbf'):
        dp = row.get('COD_DPTO')
        di = row.get('COD_DIST')
        sec = row.get('CODIGO_SEC')
        loc = row.get('SLOCAL')
        if dp is not None:
            dptos.add(dp)
            if di is not None:
                dist_combos.add((dp, di))
                if sec is not None:
                    sec_combos.add((dp, di, sec))
                    if loc is not None:
                        combos.add((dp, di, sec, loc))
        n += 1
    elapsed = time.time() - t0
    print(f'  {n:,} registros escaneados en {elapsed:.1f}s')
    print(f'  Tuplas únicas en electores:')
    print(f'    departamentos: {len(dptos)}')
    print(f'    distritos:     {len(dist_combos)}')
    print(f'    secciones:     {len(sec_combos)}')
    print(f'    locales:       {len(combos)}')
    return {
        'dptos': dptos,
        'distritos': dist_combos,
        'secciones': sec_combos,
        'locales': combos,
    }


def build_catalogs():
    """Lee seccio.dbf y secc_local.dbf, construye los 4 catálogos."""
    print('Leyendo seccio.dbf...')
    secciones_raw = read_dbf(DBF_DIR / 'seccio.dbf')
    print(f'  {len(secciones_raw)} secciones')

    print('Leyendo secc_local.dbf...')
    locales_raw = read_dbf(DBF_DIR / 'secc_local.dbf')
    print(f'  {len(locales_raw)} locales')

    # departamentos: cod_dpto -> nombre
    dpto_map = {}
    for s in secciones_raw:
        cod = s.get('CODIGO_DEP')
        if cod is not None and cod not in dpto_map:
            dpto_map[cod] = s.get('NDEPART', '').strip() or f'DEPTO {cod}'
    departamentos = [{'cod_dpto': k, 'nombre': v} for k, v in sorted(dpto_map.items())]

    # distritos: (cod_dpto, cod_dist) -> nombre
    dist_map = {}
    for s in secciones_raw:
        key = (s.get('CODIGO_DEP'), s.get('CODIGO_DIS'))
        if key[0] is None or key[1] is None:
            continue
        if key not in dist_map:
            dist_map[key] = s.get('NDISTRITO', '').strip() or f'DISTRITO {key[1]}'
    distritos = [
        {'cod_dpto': k[0], 'cod_dist': k[1], 'nombre': v}
        for k, v in sorted(dist_map.items())
    ]

    # secciones: una fila por (cod_dpto, cod_dist, cod_seccion)
    sec_map = {}
    for s in secciones_raw:
        key = (s.get('CODIGO_DEP'), s.get('CODIGO_DIS'), s.get('CODIGO_SEC'))
        if any(k is None for k in key):
            continue
        if key not in sec_map:
            sec_map[key] = {
                'cod_dpto': key[0],
                'cod_dist': key[1],
                'cod_seccion': key[2],
                'nombre': (s.get('DESCRIPCIO') or '').strip() or f'SECCION {key[2]}',
                'descripcion': (s.get('W_SECCIO') or '').strip() or None,
                'direccion': (s.get('DIRECCION') or '').strip() or None,
            }
    secciones = sorted(sec_map.values(), key=lambda x: (x['cod_dpto'], x['cod_dist'], x['cod_seccion']))

    # locales: (cod_dpto, cod_dist, cod_seccion, cod_local) -> {nombre, direccion}
    # Filtramos locales cuya seccion no exista en seccio.dbf (huérfanos por
    # inconsistencia de la fuente, ej Depto 90 EEUU).
    secciones_validas = set(sec_map.keys())
    loc_map = {}
    locales_huerfanos = 0
    for l in locales_raw:
        key = (
            l.get('CODIGO_DEP'),
            l.get('CODIGO_DIS'),
            l.get('CODIGO_SEC'),
            l.get('CODIGO_LOC'),
        )
        if any(k is None for k in key):
            continue
        sec_key = (key[0], key[1], key[2])
        if sec_key not in secciones_validas:
            locales_huerfanos += 1
            continue
        if key not in loc_map:
            loc_map[key] = {
                'cod_dpto': key[0],
                'cod_dist': key[1],
                'cod_seccion': key[2],
                'cod_local': key[3],
                'nombre': (l.get('NOMBRE_LOC') or '').strip() or f'LOCAL {key[3]}',
                'direccion': (l.get('DIRECCION') or '').strip() or None,
            }
    if locales_huerfanos:
        print(f'  ⚠ {locales_huerfanos} locales huérfanos (seccion inexistente) ignorados')

    # === Auto-completar catálogos con combinaciones que aparecen en electores
    # pero faltan en seccio.dbf / secc_local.dbf, para no perder ningún elector ===
    discovered = scan_electores_para_catalogos()

    # Departamentos faltantes
    for cod in discovered['dptos']:
        if cod not in dpto_map:
            dpto_map[cod] = f'DEPTO {cod}'
            print(f'  + auto: departamento {cod}')
    # Distritos faltantes
    for key in discovered['distritos']:
        if key not in dist_map:
            dist_map[key] = f'DISTRITO {key[1]}'
            print(f'  + auto: distrito {key}')
    # Secciones faltantes
    for key in discovered['secciones']:
        if key not in sec_map:
            sec_map[key] = {
                'cod_dpto': key[0],
                'cod_dist': key[1],
                'cod_seccion': key[2],
                'nombre': f'SECCION {key[2]}',
                'descripcion': None,
                'direccion': None,
            }
            print(f'  + auto: seccion {key}')
    # Locales faltantes
    auto_locales = 0
    for key in discovered['locales']:
        if key not in loc_map:
            loc_map[key] = {
                'cod_dpto': key[0],
                'cod_dist': key[1],
                'cod_seccion': key[2],
                'cod_local': key[3],
                'nombre': f'LOCAL {key[3]} (sin nombre en secc_local.dbf)',
                'direccion': None,
            }
            auto_locales += 1
    if auto_locales:
        print(f'  + auto: {auto_locales} locales agregados al catálogo desde electores')

    # Recomputar las listas finales
    departamentos = [{'cod_dpto': k, 'nombre': v} for k, v in sorted(dpto_map.items())]
    distritos = [{'cod_dpto': k[0], 'cod_dist': k[1], 'nombre': v}
                 for k, v in sorted(dist_map.items())]
    secciones = sorted(sec_map.values(),
                       key=lambda x: (x['cod_dpto'], x['cod_dist'], x['cod_seccion']))
    locales = sorted(loc_map.values(),
                     key=lambda x: (x['cod_dpto'], x['cod_dist'], x['cod_seccion'], x['cod_local']))

    print(f'\nCatálogos construidos:')
    print(f'  departamentos:    {len(departamentos)}')
    print(f'  distritos:        {len(distritos)}')
    print(f'  secciones:        {len(secciones)}')
    print(f'  locales_votacion: {len(locales)}')

    # Build lookup maps para denormalizar electores
    dpto_name = dict(dpto_map)  # cod_dpto -> nombre
    dist_name = dict(dist_map)  # (cod_dpto, cod_dist) -> nombre
    sec_name = {k: v['nombre'] for k, v in sec_map.items()}  # (dpto,dist,sec) -> nombre
    loc_name = {k: v['nombre'] for k, v in loc_map.items()}  # (dpto,dist,sec,local) -> nombre

    return {
        'departamentos': departamentos,
        'distritos': distritos,
        'secciones': secciones,
        'locales': locales,
        'lookups': {
            'dpto': dpto_name,
            'dist': dist_name,
            'sec': sec_name,
            'loc': loc_name,
        },
    }


# ─── Construcción de electores ───────────────────────────────────────────────
def normalize_ci(num):
    """Convierte NUMERO_CED (int) a CI normalizado (string sin separadores)."""
    if num is None:
        return None
    return str(int(num))


def parse_fecha(s):
    """'20010612' -> '2001-06-12' o None."""
    if not s or len(s) != 8:
        return None
    try:
        return f'{s[0:4]}-{s[4:6]}-{s[6:8]}'
    except Exception:
        return None


def stream_electores(lookups, total_records, locales_validos):
    """Itera por mas_pda.dbf y emite filas listas para insertar, deduplicando."""
    seen_cis = set()
    skipped_no_ci = 0
    skipped_dup = 0
    skipped_no_local = 0
    emitted = 0

    dpto_l = lookups['dpto']
    dist_l = lookups['dist']
    sec_l = lookups['sec']
    loc_l = lookups['loc']

    for row in stream_dbf(DBF_DIR / 'mas_pda.dbf'):
        ced = row.get('NUMERO_CED')
        if ced is None:
            skipped_no_ci += 1
            continue
        ci = str(int(ced))
        if ci in seen_cis:
            skipped_dup += 1
            continue
        seen_cis.add(ci)

        dp = row.get('COD_DPTO')
        di = row.get('COD_DIST')
        sec = row.get('CODIGO_SEC')
        loc = row.get('SLOCAL')
        mesa = row.get('MESA') or 0
        orden = row.get('ORDEN') or 0

        # Si el local no está en el catálogo, lo saltamos (FK constraint rompería)
        if (dp, di, sec, loc) not in locales_validos:
            skipped_no_local += 1
            continue

        apellido = (row.get('APELLIDO') or '').strip()
        nombre_str = (row.get('NOMBRE') or '').strip()
        direccion = (row.get('DIRECCION') or '').strip() or None

        emitted += 1
        yield {
            'ci_normalizado': ci,
            'ci_original': ci,
            'apellido': apellido,
            'nombre': nombre_str,
            'direccion': direccion,
            'fecha_nacimiento': parse_fecha(row.get('FECHA_NACI')),
            'sexo': row.get('CODIGO_SEX'),
            'cod_dpto': dp,
            'cod_dist': di,
            'cod_seccion': sec,
            'cod_local': loc,
            'mesa': mesa,
            'orden': orden,
            'nombre_local': loc_l.get((dp, di, sec, loc)),
            'nombre_seccion': sec_l.get((dp, di, sec)),
            'nombre_distrito': dist_l.get((dp, di)),
            'nombre_departamento': dpto_l.get(dp),
        }

    print(f'\nEstadísticas de carga:')
    print(f'  emitidos:           {emitted:>10,}')
    print(f'  duplicados (skip):  {skipped_dup:>10,}')
    print(f'  sin CI (skip):      {skipped_no_ci:>10,}')
    print(f'  local inválido:     {skipped_no_local:>10,}')
    print(f'  total fuente:       {total_records:>10,}')


# ─── Main ────────────────────────────────────────────────────────────────────
def main():
    print(f'Supabase: {SUPABASE_URL}\n')

    # Construir y subir catálogos
    print('═══ Catálogos ═══')
    catalogs = build_catalogs()

    print('\nInsertando catálogos a Supabase...')
    insert_in_batches('departamentos', catalogs['departamentos'])
    insert_in_batches('distritos', catalogs['distritos'])
    insert_in_batches('secciones', catalogs['secciones'])
    insert_in_batches('locales_votacion', catalogs['locales'])

    # Subir electores
    print('\n═══ Electores ═══')

    # Cuento records primero (rápido, solo lee el header)
    with open(DBF_DIR / 'mas_pda.dbf', 'rb') as f:
        h = f.read(32)
        total = struct.unpack('<I', h[4:8])[0]
    print(f'Records en mas_pda.dbf: {total:,}')

    # Set de locales válidos (para skip de FK violations)
    locales_validos = {
        (l['cod_dpto'], l['cod_dist'], l['cod_seccion'], l['cod_local'])
        for l in catalogs['locales']
    }
    print(f'Locales válidos en catálogo: {len(locales_validos):,}')

    inserted = stream_insert(
        'electores',
        stream_electores(catalogs['lookups'], total, locales_validos),
        total_hint=total,
        label='electores',
    )

    print(f'\n✓ Carga completa. Total insertado: {inserted:,}')


if __name__ == '__main__':
    main()
