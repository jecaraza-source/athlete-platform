#!/usr/bin/env python3
"""
import_citas.py
==============
Imports CALENDARIO_CITAS_DEPURADO_ACTIVOS_260626.xlsx into the Supabase
`events` + `event_participants` tables.

Source sheet : PROGRAMACIÓN DETALLADA
Columns      : MES | SEMANA | FECHA (DD/MM/YYYY) | SERVICIO | PROFESIONISTA
               | HORARIO | FOLIO | NOMBRE | DISCIPLINA | GRUPO

Usage:
    python3 scripts/import_citas.py [--dry-run]

Requirements:
    pip3 install openpyxl requests

The script:
  1. Reads Supabase credentials from apps/web/.env.local
  2. Loads all athletes from DB and builds a name-based lookup
  3. Groups appointments by (SERVICIO, PROFESIONISTA, FECHA, HORARIO) →
     one event per slot, with all participating athletes
  4. Bulk-inserts events + event_participants in 200-row batches
  5. Marks every event with [CITAS_IMPORT] in description so the script
     is safe to re-run (existing events are skipped)

Event-type mapping:
    MÉDICO       → medical
    FISIOTERAPIA → physio
    NUTRICIÓN    → nutrition
    PSICOLOGÍA   → psychology
"""

import os
import sys
import json
import argparse
import unicodedata
from datetime import datetime, timezone, timedelta
from collections import defaultdict

try:
    import openpyxl
except ImportError:
    sys.exit("Missing dependency: pip3 install openpyxl")

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: pip3 install requests")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

EXCEL_PATH = (
    "/Users/javierescobedo/Library/CloudStorage/Dropbox/"
    "AO Deporte/Entrenamientos/CALENDARIO_CITAS_DEPURADO_ACTIVOS_260626.xlsx"
)
SHEET_NAME   = "PROGRAMACIÓN DETALLADA"
ENV_PATH     = os.path.join(os.path.dirname(__file__), "..", ".env.local")
IMPORT_MARKER = "[CITAS_IMPORT]"
BATCH_SIZE   = 200

# Mexico Central Standard Time (UTC-6, no DST since 2022)
CST = timezone(timedelta(hours=-6))

# Appointment duration in minutes (no explicit end time in the Excel)
DURATION_MINUTES = 30

# Manual name corrections: Excel name (as-is) → canonical DB name
# Add entries here whenever the Excel has a typo or truncated name.
NAME_OVERRIDES: dict[str, str] = {
    "Jimena Espinosa Narváe": "Jimena Espinoza Narváez",
}

# SERVICIO → event_type
SERVICE_TYPE_MAP = {
    "MÉDICO":       "medical",
    "FISIOTERAPIA": "physio",
    "NUTRICIÓN":    "nutrition",
    "PSICOLOGÍA":   "psychology",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_env(path: str) -> dict:
    env: dict = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


def normalize_name(name: str) -> str:
    """Lower-case, strip accents, collapse spaces — for fuzzy name matching."""
    nfkd = unicodedata.normalize("NFKD", name)
    stripped = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(stripped.lower().split())


def parse_date_str(date_str: str):
    """Parse DD/MM/YYYY string → date object."""
    parts = str(date_str).strip().split("/")
    if len(parts) != 3:
        return None
    day, month, year = parts
    try:
        return datetime(int(year), int(month), int(day)).date()
    except ValueError:
        return None


def parse_time_str(time_str: str):
    """Parse HH:MM string → (hour, minute) tuple."""
    parts = str(time_str).strip().split(":")
    try:
        return int(parts[0]), int(parts[1])
    except (IndexError, ValueError):
        return 8, 0   # fallback


class SupabaseClient:
    def __init__(self, url: str, service_key: str):
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    def get(self, table: str, params: str = "") -> list:
        url = f"{self.url}/rest/v1/{table}"
        if params:
            url += f"?{params}"
        r = requests.get(url, headers=self.headers)
        r.raise_for_status()
        return r.json()

    def post(self, table: str, data: list, prefer: str = "return=representation") -> list:
        h = {**self.headers, "Prefer": prefer}
        r = requests.post(
            f"{self.url}/rest/v1/{table}",
            data=json.dumps(data, ensure_ascii=False).encode("utf-8"),
            headers=h,
        )
        if not r.ok:
            print(f"  ERROR {r.status_code}: {r.text[:600]}")
            r.raise_for_status()
        if prefer == "return=minimal":
            return []
        return r.json()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Import citas from Excel to Supabase")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and validate without writing to DB")
    args = parser.parse_args()
    dry = args.dry_run
    if dry:
        print("🔍  DRY RUN — no data will be written\n")

    # ── 1. Credentials ────────────────────────────────────────────────────────
    print("Loading credentials...")
    env = load_env(ENV_PATH)
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    service_key  = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        sys.exit("❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local")
    db = SupabaseClient(supabase_url, service_key)

    # ── 2. Resolve creator profile ────────────────────────────────────────────
    print("Resolving import creator profile...")
    profiles = db.get("profiles", "select=id,first_name,last_name&order=created_at&limit=1")
    if not profiles:
        sys.exit("❌  No profiles found in DB")
    creator_id   = profiles[0]["id"]
    creator_name = f"{profiles[0]['first_name']} {profiles[0]['last_name']}"
    print(f"  Using: {creator_name} ({creator_id})")

    # ── 3. Load athletes from DB ──────────────────────────────────────────────
    print("\nLoading athletes from DB...")
    # Paginate in case there are >1000 athletes
    db_athletes: list = []
    offset = 0
    while True:
        batch = db.get(
            "athletes",
            f"select=id,first_name,last_name&order=last_name&offset={offset}&limit=1000"
        )
        if not batch:
            break
        db_athletes.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000

    athlete_by_exact: dict[str, str] = {}
    athlete_by_norm:  dict[str, str] = {}
    # List of (normalized_full_name, athlete_id) used for prefix fallback
    athlete_norm_list: list[tuple[str, str]] = []
    for a in db_athletes:
        full = f"{a['first_name']} {a['last_name']}"
        athlete_by_exact[full.lower()] = a["id"]
        norm = normalize_name(full)
        athlete_by_norm[norm] = a["id"]
        athlete_norm_list.append((norm, a["id"]))
    print(f"  Loaded {len(db_athletes)} athletes")

    # ── 4. Check already-imported events ─────────────────────────────────────
    print("\nChecking for already-imported events...")
    existing = db.get(
        "events",
        f"select=title,start_at&description=ilike.{requests.utils.quote(IMPORT_MARKER + '%')}&limit=5000"
    )
    already_imported: set[tuple[str, str]] = set()
    for e in existing:
        already_imported.add((e["title"], e["start_at"][:16]))
    print(f"  {len(already_imported)} already-imported slots (will skip)")

    # ── 5. Parse Excel ────────────────────────────────────────────────────────
    print(f"\nParsing {EXCEL_PATH} ...")
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb[SHEET_NAME]

    rows = list(ws.iter_rows(values_only=True))
    data_rows = [r for r in rows[1:] if any(c is not None for c in r)]
    print(f"  {len(data_rows)} data rows found")

    # Group by slot key → list of (athlete_id, folio, nombre)
    # Slot key: (servicio, profesionista, fecha_str, horario)
    SlotKey = tuple  # (servicio, profesionista, fecha_str, horario)
    slots: dict[SlotKey, dict] = {}   # key → slot metadata
    slot_athletes: dict[SlotKey, list] = defaultdict(list)

    not_found: dict[str, int] = {}       # nombre → folio
    parse_errors: list[str]    = []
    unknown_services: set[str] = set()
    skipped_dup = 0

    for row in data_rows:
        # MES | SEMANA | FECHA | SERVICIO | PROFESIONISTA | HORARIO | FOLIO | NOMBRE | DISCIPLINA | GRUPO
        mes, semana, fecha_raw, servicio, profesionista, horario, folio, nombre, disciplina, grupo = \
            (list(row) + [None] * 10)[:10]

        if not fecha_raw or not servicio or not horario or not nombre:
            continue

        # Parse date
        date = parse_date_str(str(fecha_raw))
        if date is None:
            parse_errors.append(f"Bad date: {fecha_raw!r} (folio={folio})")
            continue

        # Parse time
        h, m = parse_time_str(str(horario))
        start_dt = datetime(date.year, date.month, date.day, h, m, tzinfo=CST)
        end_dt   = start_dt + timedelta(minutes=DURATION_MINUTES)
        start_iso = start_dt.isoformat()
        end_iso   = end_dt.isoformat()

        # Map service → event_type
        servicio_norm = str(servicio).strip().upper()
        event_type = SERVICE_TYPE_MAP.get(servicio_norm)
        if event_type is None:
            unknown_services.add(servicio_norm)
            event_type = "other"

        # Slot key
        key: SlotKey = (servicio_norm, str(profesionista).strip(), str(fecha_raw).strip(), str(horario).strip())

        # Build slot metadata (title uses profesionista)
        title = str(profesionista).strip()

        # Deduplication check
        if (title, start_iso[:16]) in already_imported:
            skipped_dup += 1
            continue

        if key not in slots:
            slots[key] = {
                "title":                 title,
                "event_type":            event_type,
                "sport_id":              None,
                "start_at":              start_iso,
                "end_at":                end_iso,
                "status":                "scheduled",
                "created_by_profile_id": creator_id,
                "description":           (
                    f"{IMPORT_MARKER} {servicio_norm} | "
                    f"Profesionista: {profesionista} | "
                    f"Mes: {mes} {semana}"
                ),
            }

        # Find athlete by name — four strategies:
        # 0) manual override  1) exact lower  2) accent-stripped norm  3) prefix
        nombre_str = str(nombre).strip()
        # Apply manual override before all other lookups
        canonical = NAME_OVERRIDES.get(nombre_str, nombre_str)
        nombre_norm = normalize_name(canonical)
        athlete_id = (
            athlete_by_exact.get(canonical.lower())
            or athlete_by_norm.get(nombre_norm)
            or next(
                (aid for norm, aid in athlete_norm_list if norm.startswith(nombre_norm)),
                None,
            )
        )
        if athlete_id:
            # Avoid adding the same athlete twice to the same slot
            existing_ids = [aid for aid, _ in slot_athletes[key]]
            if athlete_id not in existing_ids:
                slot_athletes[key].append((athlete_id, folio))
        else:
            not_found[nombre_str] = folio

    # ── 6. Summary ────────────────────────────────────────────────────────────
    total_events     = len(slots)
    total_athletes   = sum(len(v) for v in slot_athletes.values())

    print(f"\n{'[DRY RUN] ' if dry else ''}Import summary")
    print(f"  Slots (events) to insert:  {total_events}")
    print(f"  Participants to link:       {total_athletes}")
    print(f"  Already imported (skipped): {skipped_dup}")
    print(f"  Athletes not found in DB:   {len(not_found)}")

    if unknown_services:
        print(f"\n⚠️  Unknown services (mapped to 'other'): {unknown_services}")
    if parse_errors:
        print(f"\n⚠️  Parse errors ({len(parse_errors)}):")
        for e in parse_errors[:10]:
            print(f"    {e}")
    if not_found:
        print(f"\n⚠️  Athletes not found in DB (skipped):")
        for nombre, folio in sorted(not_found.items(), key=lambda x: x[0]):
            print(f"    Folio {folio:>4} → {nombre}")

    # Breakdown by service
    from collections import Counter
    type_counts: Counter = Counter()
    for key in slots:
        type_counts[key[0]] += 1
    print("\n  Breakdown by service:")
    for svc, cnt in type_counts.most_common():
        print(f"    {svc}: {cnt} events")

    if dry or not slots:
        print("\n✅  Dry run complete — nothing written." if dry else "\nNothing to import.")
        return

    # ── 7. Insert events ──────────────────────────────────────────────────────
    print("\nInserting events...")
    keys_ordered = list(slots.keys())
    events_list  = [slots[k] for k in keys_ordered]
    inserted_ids: list[str] = []

    for i in range(0, len(events_list), BATCH_SIZE):
        batch  = events_list[i : i + BATCH_SIZE]
        result = db.post("events", batch)
        ids    = [r["id"] for r in result]
        inserted_ids.extend(ids)
        print(f"  events {i+1}–{i+len(batch)} ✓")

    # ── 8. Insert participants ────────────────────────────────────────────────
    print("Inserting event participants...")
    participant_rows: list[dict] = []
    for event_id, key in zip(inserted_ids, keys_ordered):
        for athlete_id, _folio in slot_athletes[key]:
            participant_rows.append({
                "event_id":          event_id,
                "participant_id":    athlete_id,
                "participant_type":  "athlete",
                "attendance_status": "planned",
            })

    for i in range(0, len(participant_rows), BATCH_SIZE):
        batch = participant_rows[i : i + BATCH_SIZE]
        db.post("event_participants", batch, prefer="return=minimal")
        print(f"  participants {i+1}–{i+len(batch)} ✓")

    print(f"\n✅  Import complete!")
    print(f"   {len(inserted_ids)} events inserted")
    print(f"   {len(participant_rows)} participant links inserted")
    if not_found:
        print(f"\n⚠️  {len(not_found)} athletes were not found and skipped.")
        print("   Add them via /admin/athletes and re-run to import their appointments.")


if __name__ == "__main__":
    main()
