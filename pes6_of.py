#!/usr/bin/env python3
"""
APS → PES6 Option File patcher
================================
Reads APS player ownership data and patches a PES6 PC option file
so each manager's squad contains their APS players.

Usage:
  # 1. Ver todos los equipos con su índice:
  python pes6_of.py KONAMI-WIN32PES6OPT --list-clubs

  # 2. Aplicar transfers (con JSON de APS):
  python pes6_of.py KONAMI-WIN32PES6OPT --apply aps_export.json --output KONAMI-WIN32PES6OPT_APS

Formato de aps_export.json:
{
  "teams": [
    {
      "username": "benj",
      "team_name": "Celtic",
      "team_index": 42,
      "players": [1234, 5678, ...]
    }
  ]
}
"""

import json
import struct
import sys
import argparse

# ─── Encryption constants (from COFPES-OF-Editor-6 / PESEditor) ──────────────

OF_BYTE_LENGTH = 1191936

OF_BLOCK      = [12, 5144, 9544, 14288, 37116, 657956, 751472, 763804, 911144, 1170520]
OF_BLOCK_SIZE = [4844, 1268, 4730, 22816, 620000, 93501, 12320, 147328, 259364, 21032]

OF_KEY_PC = [
    115, 96, 225, 198, 31, 60, 173, 66, 11, 88, 185, 254, 55, 180, 5, 250,
    163, 80, 145, 54, 79, 44, 93, 178, 59, 72, 105, 110, 103, 164, 181, 106,
    211, 64, 65, 166, 127, 28, 13, 34, 107, 56, 25, 222, 151, 148, 101, 218,
    3, 48, 241, 22, 175, 12, 189, 146, 155, 40, 201, 78, 199, 132, 21, 74,
    51, 32, 161, 134, 223, 252, 109, 2, 203, 24, 121, 190, 247, 116, 197, 186,
    99, 16, 81, 246, 15, 236, 29, 114, 251, 8, 41, 46, 39, 100, 117, 42,
    147, 0, 1, 102, 63, 220, 205, 226, 43, 248, 217, 158, 87, 84, 37, 154,
    195, 240, 177, 214, 111, 204, 125, 82, 91, 232, 137, 14, 135, 68, 213, 10,
    243, 224, 97, 70, 159, 188, 45, 194, 139, 216, 57, 126, 183, 52, 133, 122,
    35, 208, 17, 182, 207, 172, 221, 50, 187, 200, 233, 238, 231, 36, 53, 234,
    83, 192, 193, 38, 255, 156, 141, 162, 235, 184, 153, 94, 23, 20, 229, 90,
    131, 176, 113, 150, 47, 140, 61, 18, 27, 168, 73, 206, 71, 4, 149, 202,
    179, 160, 33, 6, 95, 124, 237, 130, 75, 152, 249, 62, 119, 244, 69, 58,
    227, 144, 209, 118, 143, 108, 157, 242, 123, 136, 169, 174, 167, 228, 245, 170,
    19, 128, 129, 230, 191, 92, 77, 98, 171, 120, 89, 30, 215, 212, 165, 26,
    67, 112, 49, 86, 239, 76, 253, 210, 219, 104, 9, 142, 7, 196, 85, 138,
]

OF_KEY = [
    2058578050, 2058578078, 2058578109, 2058578079, 2058578084, 2058578115,
    2058578073, 2058578105, 2058578068, 2058578101, 2058578095, 2058578045,
    2058578100, 2058578111, 2058578096, 2058578068, 2058578101, 2058578117,
    2058578115, 2058578071, 2058578064, 2058578045, 2058578078, 2058578085,
    2058578062, 2058578116, 2058578109, 2058578045, 2058578115, 2058578076,
    2058578049, 2058578093, 2058578066, 2058578051, 2058578082, 2058578114,
    2058578045, 2058578093, 2058578052, 2058578112, 2058578073, 2058578063,
    2058578100, 2058578102, 2058578103, 2058578053, 2058578085, 2058578078,
    2058578077, 2058578115, 2058578076, 2058578086, 2058578116, 2058578111,
    2058578083, 2058578109, 2058578072, 2058578047, 2058578081, 2058578049,
    2058578074, 2058578048, 2058578086, 2058578110, 2058578098, 2058578102,
    2058578105, 2058578050, 2058578046, 2058578086, 2058578095, 2058578083,
    2058578065, 2058578062, 2058578047, 2058578116, 2058578109, 2058578100,
    2058578068, 2058578100, 2058578109, 2058578104, 2058578079, 2058578084,
    2058578084, 2058578083, 2058578084, 2058578098, 2058578096, 2058578070,
    2058578068, 2058578110, 2058578094, 2058578045, 2058578114, 2058578082,
    2058578116, 2058578068, 2058578114, 2058578097, 2058578085, 2058578115,
    2058578072, 2058578068, 2058578047, 2058578099, 2058578076, 2058578101,
    2058578086, 2058578117, 2058578052, 2058578109, 2058578070, 2058578050,
    2058578118, 2058578046, 2058578109, 2058578098, 2058578099, 2058578064,
    2058578048, 2058578103, 2058578069, 2058578075, 2058578068, 2058578085,
    2058578110, 2058578111, 2058578114, 2058578110, 2058578081, 2058578084,
    2058578077, 2058578073, 2058578084, 2058578100, 2058578104, 2058578063,
    2058578083, 2058578049, 2058578065, 2058578109, 2058578105, 2058578099,
    2058578105, 2058578062, 2058578069, 2058578070, 2058578065, 2058578066,
    2058578047, 2058578100, 2058578107, 2058578077, 2058578062, 2058578050,
    2058578113, 2058578080, 2058578065, 2058578083, 2058578095, 2058578111,
    2058578096, 2058578044, 2058578116, 2058578053, 2058578084, 2058578077,
    2058578118, 2058578100, 2058578072, 2058578044, 2058578073, 2058578104,
    2058578117, 2058578074, 2058578069, 2058578110, 2058578050, 2058578045,
    2058578045, 2058578047, 2058578047, 2058578106, 2058578064, 2058578099,
    2058578095, 2058578063, 2058578067, 2058578068, 2058578049, 2058578108,
    2058578098, 2058578115, 2058578099, 2058578097, 2058578106, 2058578097,
    2058578116, 2058578116, 2058578110, 2058578118, 2058578099, 2058578111,
    2058578106, 2058578109, 2058578101, 2058578093, 2058578077, 2058578053,
    2058578061, 2058578098, 2058578050, 2058578086, 2058578104, 2058578098,
    2058578113, 2058578102, 2058578065, 2058578077, 2058578082, 2058578044,
    2058578050, 2058578085, 2058578117, 2058578045, 2058578117, 2058578113,
    2058578082, 2058578051, 2058578110, 2058578103, 2058578096, 2058578069,
    2058578052, 2058578114, 2058578046, 2058578044, 2058578047, 2058578108,
    2058578083, 2058578075, 2058578077, 2058578069, 2058578050, 2058578101,
    2058578063, 2058578082, 2058578052, 2058578108, 2058578106, 2058578109,
    2058578112, 2058578062, 2058578071, 2058578051, 2058578047, 2058578097,
    2058578062, 2058578100, 2058578048, 2058578080, 2058578080, 2058578077,
    2058578047, 2058578048, 2058578096, 2058578100, 2058578118, 2058578105,
    2058578096, 2058578072, 2058578085, 2058578084, 2058578061, 2058578114,
    2058578044, 2058578049, 2058578053, 2058578093, 2058578064, 2058578049,
    2058578083, 2058578069, 2058578073, 2058578104, 2058578080, 2058578098,
    2058578103, 2058578093, 2058578049, 2058578044, 2058578099, 2058578094,
    2058578070, 2058578103, 2058578070, 2058578062, 2058578078, 2058578102,
    2058578104, 2058578109, 2058578068, 2058578067, 2058578108, 2058578108,
    2058578076, 2058578086, 2058578053, 2058578104, 2058578093, 2058578070,
    2058578105, 2058578110, 2058578094, 2058578112, 2058578086, 2058578049,
    2058578101, 2058578086, 2058578108, 2058578071, 2058578095, 2058578079,
    2058578097, 2058578116, 2058578111, 2058578046, 2058578103, 2058578071,
    2058578067, 2058578063, 2058578096, 2058578048, 2058578079, 2058578103,
    2058578068, 2058578114, 2058578079, 2058578072, 2058578102, 2058578115,
    2058578053, 2058578047, 2058578084, 2058578046, 2058578110, 2058578044,
    2058578108, 2058578101, 2058578078, 2058578073, 2058578086, 2058578049,
    2058578107, 2058578069, 2058578077, 2058578086, 2058578079, 2058578110,
    2058578048, 2058578116, 2058578101, 2058578108, 2058578081, 2058578093,
    2058578113, 2058578065, 2058578045, 2058578080, 2058578109, 2058578075,
    2058578097, 2058578071, 2058578049, 2058578053, 2058578078, 2058578050,
    2058578075, 2058578067, 2058578083, 2058578061, 2058578116, 2058578116,
    2058578075, 2058578093, 2058578116, 2058578100, 2058578093, 2058578052,
    2058578085, 2058578047, 2058578095, 2058578081, 2058578045, 2058578044,
    2058578101, 2058578097, 2058578110, 2058578115, 2058578096, 2058578069,
    2058578053, 2058578050, 2058578112, 2058578085, 2058578104, 2058578082,
    2058578073, 2058578099, 2058578081, 2058578045, 2058578079, 2058578071,
    2058578080, 2058578047, 2058578113, 2058578076, 2058578082, 2058578117,
    2058578086, 2058578046, 2058578099, 2058578068, 2058578074, 2058578108,
    2058578064, 2058578077, 2058578115, 2058578066, 2058578074, 2058578104,
    2058578082, 2058578115, 2058578117, 2058578082, 2058578117, 2058578048,
    2058578053, 2058578107, 2058578079, 2058578116, 2058578081, 2058578086,
    2058578064, 2058577996,
]

# ─── Squad offsets (from PESEditor / Squads.java) ─────────────────────────────
# Teams  0-63:  23-player squads
# Teams 64-72:  invalid (skip)
# Teams 73-212: 32-player squads

NUM23  = 657956   # shirt numbers, teams 0-72 (1 byte/player × 23)
NUM32  = 659635   # shirt numbers, teams 73-212 (1 byte/player × 32)
SLOT23 = 664372   # player IDs, teams 0-72 (2 bytes/player × 23)
SLOT32 = 667730   # player IDs, teams 73-212 (2 bytes/player × 32)

# ─── Club names ───────────────────────────────────────────────────────────────
CLUB_BASE    = 751472
CLUB_BYTES   = 88
CLUB_TOTAL   = 140

# ─── Helpers ─────────────────────────────────────────────────────────────────

def read_uint32(data, offset):
    return struct.unpack_from('<I', data, offset)[0]

def write_uint32(data, offset, val):
    struct.pack_into('<I', data, offset, val & 0xFFFFFFFF)

# ─── Crypto ───────────────────────────────────────────────────────────────────

def convert_data(data):
    """XOR with cycling 256-byte PC key. Symmetric — same call encrypts and decrypts."""
    key = 0
    for i in range(len(data)):
        data[i] ^= OF_KEY_PC[key]
        key = (key + 1) & 0xFF


def decrypt_blocks(data):
    """Block-level decryption (call after convert_data)."""
    for b in range(1, len(OF_BLOCK)):
        k = 0
        start = OF_BLOCK[b]
        end   = start + OF_BLOCK_SIZE[b]
        for a in range(start, end - 3, 4):
            c = read_uint32(data, a)
            p = ((c - OF_KEY[k]) + 0x7AB3684C) ^ 0x7AB3684C
            data[a:a+4] = (p % 0x100000000).to_bytes(4, 'little')
            k = (k + 1) % 446


def encrypt_blocks(data):
    """Block-level encryption (call before convert_data when saving)."""
    for b in range(1, len(OF_BLOCK)):
        k = 0
        start = OF_BLOCK[b]
        end   = start + OF_BLOCK_SIZE[b]
        for a in range(start, end - 3, 4):
            p = read_uint32(data, a)
            c = (OF_KEY[k] + ((p ^ 0x7AB3684C) - 0x7AB3684C)) & 0xFFFFFFFF
            data[a:a+4] = c.to_bytes(4, 'little')
            k = (k + 1) % 446


def update_checksums(data):
    """Recalculate block checksums (stored 8 bytes before each block start)."""
    for b in range(len(OF_BLOCK)):
        checksum = 0
        start = OF_BLOCK[b]
        end   = start + OF_BLOCK_SIZE[b]
        for a in range(start, end - 3, 4):
            checksum = (checksum + read_uint32(data, a)) & 0xFFFFFFFF
        data[start-8 : start-4] = checksum.to_bytes(4, 'little')

# ─── Option file I/O ─────────────────────────────────────────────────────────

def load_option_file(path):
    with open(path, 'rb') as f:
        raw = f.read()
    if len(raw) != OF_BYTE_LENGTH:
        raise ValueError(f'Tamaño incorrecto: {len(raw)} bytes (esperado {OF_BYTE_LENGTH})')
    data = bytearray(raw)
    convert_data(data)
    decrypt_blocks(data)
    return data


def save_option_file(data, path):
    out = bytearray(data)
    update_checksums(out)
    encrypt_blocks(out)
    convert_data(out)
    with open(path, 'wb') as f:
        f.write(out)
    print(f'  Guardado: {path}')

# ─── Club names ───────────────────────────────────────────────────────────────

def read_club_names(data):
    clubs = {}
    for i in range(CLUB_TOTAL):
        off   = CLUB_BASE + i * CLUB_BYTES
        raw   = data[off : off + 48]
        name  = raw.split(b'\x00')[0].decode('latin-1', errors='replace').strip()
        clubs[i] = name
    return clubs

# ─── Squad read/write ─────────────────────────────────────────────────────────

def squad_offsets(team_idx):
    """Returns (slot_offset, num_offset, squad_size) or None if invalid index."""
    if 0 <= team_idx <= 63:
        return (SLOT23 + team_idx * 23 * 2,
                NUM23  + team_idx * 23,
                23)
    elif 73 <= team_idx <= 212:
        return (SLOT32 + (team_idx - 73) * 32 * 2,
                NUM32  + (team_idx - 73) * 32,
                32)
    return None


def read_squad(data, team_idx):
    """Returns list of (player_id, shirt_number) for non-empty slots."""
    offs = squad_offsets(team_idx)
    if offs is None:
        return []
    slot_off, num_off, size = offs
    result = []
    for i in range(size):
        pid  = int.from_bytes(data[slot_off + i*2 : slot_off + i*2 + 2], 'little')
        num  = data[num_off + i]
        if pid != 0:
            result.append((pid, num))
    return result


def write_squad(data, team_idx, player_ids, shirt_numbers=None):
    """
    Overwrites a team's roster with the given player IDs.
    player_ids    : list of int (PES6 player IDs)
    shirt_numbers : list of int (1-99). Auto-assigned 1,2,3... if None.
    Empty slots are padded with 0.
    """
    offs = squad_offsets(team_idx)
    if offs is None:
        raise ValueError(f'Índice de equipo inválido: {team_idx} (rango 64-72 reservado)')
    slot_off, num_off, size = offs

    if len(player_ids) > size:
        print(f'  AVISO: {len(player_ids)} jugadores > capacidad {size}, se trunca.')
        player_ids = player_ids[:size]

    nums = shirt_numbers if shirt_numbers else list(range(1, len(player_ids) + 1))

    # Write player IDs and shirt numbers, pad remainder with 0
    for i in range(size):
        if i < len(player_ids):
            pid = int(player_ids[i])
            num = int(nums[i]) if i < len(nums) else i + 1
        else:
            pid, num = 0, 0
        data[slot_off + i*2]     = pid & 0xFF
        data[slot_off + i*2 + 1] = (pid >> 8) & 0xFF
        data[num_off + i]         = num & 0xFF

# ─── Commands ────────────────────────────────────────────────────────────────

def cmd_list_clubs(of_path):
    print(f'Cargando {of_path} ...')
    data  = load_option_file(of_path)
    clubs = read_club_names(data)

    print(f'\n{"Idx":>4}  {"Nombre":<32}  {"Jugadores":>9}')
    print('-' * 52)
    for idx in range(CLUB_TOTAL):
        name = clubs.get(idx, '')
        if not name:
            continue
        # Skip invalid range
        if 64 <= idx <= 72:
            print(f'{idx:4d}  {"(reservado)":<32}')
            continue
        squad = read_squad(data, idx)
        print(f'{idx:4d}  {name:<32}  {len(squad):>5} jug.')

    print('\nUsá el índice (Idx) en tu aps_export.json para cada equipo.')


def cmd_apply(of_path, json_path, out_path):
    print(f'Cargando option file: {of_path}')
    data  = load_option_file(of_path)
    clubs = read_club_names(data)
    print('  Desencriptado OK')

    print(f'Cargando APS export: {json_path}')
    with open(json_path, encoding='utf-8') as f:
        aps = json.load(f)

    for team in aps['teams']:
        idx      = int(team['team_index'])
        pids     = [int(p) for p in team['players']]
        nums     = team.get('shirt_numbers')
        manager  = team.get('username', '?')
        of_name  = clubs.get(idx, f'Team {idx}')

        print(f'  [{idx:3d}] {of_name:<28} ← {manager} ({len(pids)} jugadores)')
        write_squad(data, idx, pids, nums)

    print(f'\nGuardando resultado...')
    save_option_file(data, out_path)
    print('Listo. Copiá el archivo al directorio de saves de PES6.')


def cmd_read_squad(of_path, team_idx):
    """Debug: print current squad of a team."""
    data  = load_option_file(of_path)
    clubs = read_club_names(data)
    squad = read_squad(data, team_idx)
    print(f'Equipo [{team_idx}]: {clubs.get(team_idx, "?")}')
    print(f'Jugadores ({len(squad)}):')
    for pid, num in squad:
        print(f'  #{num:2d}  ID {pid}')

# ─── Entry point ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Parchea un option file de PES6 con los transfers de APS'
    )
    parser.add_argument('option_file', help='Ruta al option file (ej: KONAMI-WIN32PES6OPT)')
    parser.add_argument('--list-clubs',  action='store_true',
                        help='Listar todos los equipos con su índice y salir')
    parser.add_argument('--apply',       metavar='APS_JSON',
                        help='JSON exportado de APS con los planteles')
    parser.add_argument('--output',      metavar='OUTPUT', default='KONAMI-WIN32PES6OPT_APS',
                        help='Archivo de salida (default: KONAMI-WIN32PES6OPT_APS)')
    parser.add_argument('--read-squad',  metavar='TEAM_IDX', type=int,
                        help='Mostrar plantel actual de un equipo (debug)')
    args = parser.parse_args()

    if args.list_clubs:
        cmd_list_clubs(args.option_file)
    elif args.apply:
        cmd_apply(args.option_file, args.apply, args.output)
    elif args.read_squad is not None:
        cmd_read_squad(args.option_file, args.read_squad)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
