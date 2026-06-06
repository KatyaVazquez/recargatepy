#!/usr/bin/env python3
"""Inspect FoxPro/dBase DBF file headers and sample rows."""
import struct
import sys
from pathlib import Path

def read_dbf_meta(path):
    with open(path, 'rb') as f:
        header = f.read(32)
        version = header[0]
        last_update = (1900 + header[1], header[2], header[3])
        num_records = struct.unpack('<I', header[4:8])[0]
        header_len = struct.unpack('<H', header[8:10])[0]
        record_len = struct.unpack('<H', header[10:12])[0]
        code_page = header[29]

        fields = []
        while True:
            field_descriptor = f.read(32)
            if not field_descriptor or field_descriptor[0] == 0x0D:
                break
            if len(field_descriptor) < 32:
                break
            name = field_descriptor[:11].split(b'\x00')[0].decode('ascii', errors='replace')
            ftype = chr(field_descriptor[11])
            length = field_descriptor[16]
            decimals = field_descriptor[17]
            fields.append({'name': name, 'type': ftype, 'length': length, 'decimals': decimals})

        # Read first N rows
        f.seek(header_len)
        sample_rows = []
        for i in range(5):
            rec = f.read(record_len)
            if len(rec) < record_len:
                break
            deleted = rec[0:1] == b'*'
            row = {'_deleted': deleted}
            offset = 1
            for fld in fields:
                raw = rec[offset:offset+fld['length']]
                offset += fld['length']
                if fld['type'] in ('C',):
                    try:
                        val = raw.decode('latin-1').rstrip()
                    except:
                        val = repr(raw)
                elif fld['type'] in ('N', 'F'):
                    try:
                        val = raw.decode('ascii').strip()
                    except:
                        val = repr(raw)
                elif fld['type'] == 'D':
                    val = raw.decode('ascii').strip()
                elif fld['type'] == 'L':
                    val = raw.decode('ascii').strip()
                elif fld['type'] == 'M':
                    val = raw.decode('ascii').strip() + ' (memo)'
                else:
                    val = repr(raw)
                row[fld['name']] = val
            sample_rows.append(row)

        return {
            'version': hex(version),
            'last_update': last_update,
            'num_records': num_records,
            'header_len': header_len,
            'record_len': record_len,
            'code_page': hex(code_page),
            'num_fields': len(fields),
            'fields': fields,
            'sample_rows': sample_rows,
        }


def print_report(path):
    print(f'\n{"="*70}\nFILE: {path}\n{"="*70}')
    try:
        meta = read_dbf_meta(path)
    except Exception as e:
        print(f'  ERROR: {e}')
        return
    print(f'Records: {meta["num_records"]:,}')
    print(f'Fields:  {meta["num_fields"]}')
    print(f'Last update: {meta["last_update"]}')
    print(f'Code page byte: {meta["code_page"]}')
    print(f'Record length: {meta["record_len"]} bytes')
    print('\nFIELDS:')
    print(f'  {"name":<12} {"type":<5} {"len":<5} {"dec":<4}')
    for fld in meta['fields']:
        print(f'  {fld["name"]:<12} {fld["type"]:<5} {fld["length"]:<5} {fld["decimals"]:<4}')
    print('\nSAMPLE ROWS (first 5):')
    for i, row in enumerate(meta['sample_rows']):
        print(f'  --- row {i} (deleted={row["_deleted"]}) ---')
        for k, v in row.items():
            if k == '_deleted':
                continue
            print(f'    {k:<12} = {v!r}')


if __name__ == '__main__':
    base = Path('/Users/derlis/Desktop/bot-padron/ANR2026')
    for name in ['mas_pda.dbf', 'secc_local.dbf', 'seccio.dbf']:
        print_report(base / name)
