#!/usr/bin/env python3
"""Analyze geographic distribution: secciones per distrito (municipio)."""
import struct
from pathlib import Path
from collections import defaultdict

def read_dbf(path):
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
                raw = rec[offset:offset+fld['length']]
                offset += fld['length']
                if fld['type'] == 'C':
                    val = raw.decode('latin-1').rstrip()
                elif fld['type'] in ('N', 'F'):
                    try:
                        val = int(raw.decode('ascii').strip() or '0')
                    except ValueError:
                        val = raw.decode('ascii').strip()
                else:
                    val = raw.decode('latin-1', errors='replace').strip()
                row[fld['name']] = val
            rows.append(row)
        return rows

base = Path('/Users/derlis/Desktop/bot-padron/ANR2026')

print('Reading seccio.dbf ...')
secciones = read_dbf(base / 'seccio.dbf')

# Distritos = municipios. Group by (COD_DPTO, COD_DIST) and count secciones
distrito_secciones = defaultdict(lambda: {'secciones': 0, 'ndept': '', 'ndist': ''})
departamento_distritos = defaultdict(lambda: {'distritos': set(), 'ndept': ''})

for s in secciones:
    key = (s['CODIGO_DEP'], s['CODIGO_DIS'])
    distrito_secciones[key]['secciones'] += 1
    distrito_secciones[key]['ndept'] = s['NDEPART']
    distrito_secciones[key]['ndist'] = s['NDISTRITO']
    departamento_distritos[s['CODIGO_DEP']]['distritos'].add(s['CODIGO_DIS'])
    departamento_distritos[s['CODIGO_DEP']]['ndept'] = s['NDEPART']

print(f'\nTotal secciones en seccio.dbf: {len(secciones)}')
print(f'Total departamentos: {len(departamento_distritos)}')
print(f'Total distritos (municipios): {len(distrito_secciones)}')

print('\n=== DEPARTAMENTOS ===')
for cod, info in sorted(departamento_distritos.items()):
    print(f'  Depto {cod:2d} {info["ndept"]:<25} -> {len(info["distritos"])} distritos')

print('\n=== DISTRIBUCION DE SECCIONES POR DISTRITO ===')
hist = defaultdict(int)
for key, info in distrito_secciones.items():
    hist[info['secciones']] += 1
print('  Secciones por distrito | Cantidad de distritos')
for n in sorted(hist):
    print(f'  {n:>4} secciones        | {hist[n]:>4} distritos')

print('\n=== TOP 20 DISTRITOS CON MAS SECCIONES ===')
top = sorted(distrito_secciones.items(), key=lambda x: -x[1]['secciones'])[:20]
for (dep, dist), info in top:
    print(f'  Depto {dep:2d} Dist {dist:3d} {info["ndept"]:<20} / {info["ndist"]:<25} -> {info["secciones"]} secciones')

print('\n=== EJEMPLO: distritos con 1 sola seccion ===')
single = [(k, v) for k, v in distrito_secciones.items() if v['secciones'] == 1][:10]
for (dep, dist), info in single:
    print(f'  Depto {dep:2d} Dist {dist:3d} {info["ndept"]:<20} / {info["ndist"]}')

# Now: count electors per distrito (sample by reading mas_pda.dbf)
print('\n\nReading mas_pda.dbf (this may take 30-60s, 2.8M records)...')
import time
t0 = time.time()

# Stream count
with open(base / 'mas_pda.dbf', 'rb') as f:
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

    # Get field offsets for COD_DPTO and COD_DIST
    offsets = {}
    off = 1
    for fld in fields:
        offsets[fld['name']] = (off, fld['length'])
        off += fld['length']

    cod_dpto_off, cod_dpto_len = offsets['COD_DPTO']
    cod_dist_off, cod_dist_len = offsets['COD_DIST']

    f.seek(header_len)
    distrito_electores = defaultdict(int)
    count_active = 0
    count_deleted = 0
    for _ in range(num_records):
        rec = f.read(record_len)
        if len(rec) < record_len:
            break
        if rec[0:1] == b'*':
            count_deleted += 1
            continue
        count_active += 1
        try:
            d = int(rec[cod_dpto_off:cod_dpto_off+cod_dpto_len].decode('ascii').strip() or '0')
            dist = int(rec[cod_dist_off:cod_dist_off+cod_dist_len].decode('ascii').strip() or '0')
            distrito_electores[(d, dist)] += 1
        except Exception:
            pass

elapsed = time.time() - t0
print(f'Parsed {count_active:,} active records ({count_deleted:,} deleted) in {elapsed:.1f}s')

print('\n=== TOP 20 DISTRITOS POR CANTIDAD DE ELECTORES ===')
top_e = sorted(distrito_electores.items(), key=lambda x: -x[1])[:20]
for (dep, dist), n in top_e:
    info = distrito_secciones.get((dep, dist), {'ndept': '?', 'ndist': '?', 'secciones': 0})
    print(f'  Depto {dep:2d} Dist {dist:3d} {info["ndept"]:<20} / {info["ndist"]:<25} -> {n:>7,} electores en {info["secciones"]} secciones')

print('\n=== DISTRIBUCION GLOBAL ===')
all_counts = list(distrito_electores.values())
all_counts.sort()
n = len(all_counts)
print(f'  Total distritos con electores: {n}')
print(f'  Min: {min(all_counts):,}')
print(f'  Max: {max(all_counts):,}')
print(f'  Mediana: {all_counts[n//2]:,}')
print(f'  Promedio: {sum(all_counts)//n:,}')
print(f'  Total electores: {sum(all_counts):,}')

# Buckets
buckets = [(0,1000), (1000,5000), (5000,10000), (10000,30000), (30000,100000), (100000, 10**9)]
print('\n  Distribución por rangos:')
for lo, hi in buckets:
    c = sum(1 for x in all_counts if lo <= x < hi)
    print(f'    {lo:>6,} - {hi:>9,}: {c:>3} distritos')
