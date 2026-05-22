#!/usr/bin/env python3
"""
import_schedule.py
==================
Imports CALENDARIO_MENSUAL_VALORACIONES_ASIGNACION_EQUITATIVA_V2.xlsx into
the Supabase `events` + `event_participants` tables.

Usage:
    python3 scripts/import_schedule.py [--dry-run]

Requirements:
    pip3 install openpyxl requests

The script:
  1. Reads Supabase credentials from apps/web/.env.local
  2. Ensures all 7 disciplines exist in the `sports` table
  3. Matches athletes in the Excel to existing DB records by name
  4. Bulk-inserts events + participants (200-row batches)
  5. Marks every inserted event with [SCHEDULE_IMPORT] in description
     so the script is safe to re-run (skips already-imported events)

Excel → system mappings
  ATLETISMO                       → atletismo   / Atletismo
  Acrobático-Gimnasia Artística   → gimnasia_artistica / Gimnasia Artística Femenil
  BOXEO                           → boxeo       / Boxeo
  BREAKING                        → breaking    / Breaking
  CANOTAJE                        → canotaje    / Canotaje
  Combate-Tae Kwon Do             → taekwondo   / Tae Kwon Do
  NATACIÓN                        → natacion    / Natación
"""

import os
import sys
import json
import argparse
import unicodedata
from datetime import datetime, timezone, timedelta
from collections import Counter

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
    "AO Deporte/CALENDARIO_MENSUAL_VALORACIONES_ASIGNACION_EQUITATIVA_V2.xlsx"
)
ENV_PATH = os.path.join(
    os.path.dirname(__file__), "..", ".env.local"
)
SHEET_NAME = "Agenda Cronológica"
IMPORT_MARKER = "[SCHEDULE_IMPORT]"
BATCH_SIZE = 200

# Mexico Central Standard Time (UTC-6, no DST since 2022)
CST = timezone(timedelta(hours=-6))

# Discipline: Excel label → system value
DISCIPLINE_MAP = {
    "ATLETISMO":                          "atletismo",
    "Acrobático-Gimnasia Artística Femenil": "gimnasia_artistica",
    "BOXEO":                              "boxeo",
    "BREAKING":                           "breaking",
    "CANOTAJE":                           "canotaje",
    "Combate-Tae Kwon Do":                "taekwondo",
    "NATACIÓN":                           "natacion",
}

# Discipline system value → canonical sports-table name
SPORT_NAME_MAP = {
    "atletismo":          "Atletismo",
    "gimnasia_artistica": "Gimnasia Artística Femenil",
    "boxeo":              "Boxeo",
    "breaking":           "Breaking",
    "canotaje":           "Canotaje",
    "taekwondo":          "Tae Kwon Do",
    "natacion":           "Natación",
}

# Assessment type (Excel) → event_type (DB)
ASSESSMENT_EVENT_TYPE = {
    "Valoración Médica":           "medical",
    "Valoración Psicológica":      "evaluation",
    "Valoración Nutrición":        "evaluation",
    "Valoración Fisioterapéutica": "evaluation",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_env(path):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


def normalize_name(name: str) -> str:
    """Lower-case and strip accents for fuzzy name matching."""
    nfkd = unicodedata.normalize("NFKD", name)
    stripped = "".join(c for c in nfkd if not unicodedata.combining(c))
    return stripped.lower().strip()


class SupabaseClient:
    def __init__(self, url, service_key):
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    def get(self, table, params=""):
        url = f"{self.url}/rest/v1/{table}"
        if params:
            url += f"?{params}"
        r = requests.get(url, headers=self.headers)
        r.raise_for_status()
        return r.json()

    def post(self, table, data, prefer="return=representation"):
        h = {**self.headers, "Prefer": prefer}
        r = requests.post(
            f"{self.url}/rest/v1/{table}",
            data=json.dumps(data, ensure_ascii=False).encode("utf-8"),
            headers=h,
        )
        if not r.ok:
            print(f"  ERROR {r.status_code}: {r.text[:500]}")
            r.raise_for_status()
        if prefer == "return=minimal":
            return []
        return r.json()

    def upsert(self, table, data, on_conflict):
        h = {
            **self.headers,
            "Prefer": f"return=representation,resolution=merge-duplicates",
        }
        r = requests.post(
            f"{self.url}/rest/v1/{table}?on_conflict={on_conflict}",
            data=json.dumps(data, ensure_ascii=False).encode("utf-8"),
            headers=h,
        )
        if not r.ok:
            print(f"  ERROR {r.status_code}: {r.text[:500]}")
            r.raise_for_status()
        return r.json()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Import schedule from Excel to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without writing to DB")
    args = parser.parse_args()

    dry = args.dry_run
    if dry:
        print("🔍  DRY RUN — no data will be written\n")

    # ── 1. Load credentials ──────────────────────────────────────────────────
    print("Loading credentials...")
    env = load_env(ENV_PATH)
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    service_key  = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        sys.exit("❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.local")
    db = SupabaseClient(supabase_url, service_key)

    # ── 2. Ensure sports entries ─────────────────────────────────────────────
    print("\nEnsuring sports entries in DB...")
    existing_sports = db.get("sports", "select=id,name")
    sport_id_by_name_lower = {s["name"].lower(): s["id"] for s in existing_sports}

    sport_id_map: dict[str, str] = {}   # disc_value → sports.id
    for disc_value, sport_name in SPORT_NAME_MAP.items():
        key = sport_name.lower()
        if key in sport_id_by_name_lower:
            sport_id_map[disc_value] = sport_id_by_name_lower[key]
            print(f"  ✓ {sport_name}")
        else:
            if not dry:
                result = db.upsert(
                    "sports",
                    {"name": sport_name, "category_type": "individual", "status": "active"},
                    on_conflict="name",
                )
                sport_id = result[0]["id"] if isinstance(result, list) else result["id"]
                sport_id_map[disc_value] = sport_id
                print(f"  ➕ Created: {sport_name} → {sport_id}")
            else:
                sport_id_map[disc_value] = f"<DRY:{sport_name}>"
                print(f"  ➕ Would create: {sport_name}")

    # ── 3. Resolve an admin profile to use as event creator ────────────────────
    print("\nResolving import creator profile...")
    admin_profiles = db.get(
        "profiles",
        "select=id,first_name,last_name&order=created_at&limit=1"
    )
    if not admin_profiles:
        sys.exit("❌  No profiles found in DB — cannot set created_by_profile_id")
    creator_id = admin_profiles[0]["id"]
    creator_name = f"{admin_profiles[0]['first_name']} {admin_profiles[0]['last_name']}"
    print(f"  Using profile: {creator_name} ({creator_id})")

    # ── 4. Load athletes from DB ──────────────────────────────────────────────
    print("\nLoading athletes from DB...")
    db_athletes = db.get("athletes", "select=id,first_name,last_name&order=last_name")
    # Two lookups: exact lower + accent-stripped
    athlete_by_exact: dict[str, str] = {}
    athlete_by_norm:  dict[str, str] = {}
    for a in db_athletes:
        full = f"{a['first_name']} {a['last_name']}"
        athlete_by_exact[full.lower()] = a["id"]
        athlete_by_norm[normalize_name(full)] = a["id"]
    print(f"  Loaded {len(db_athletes)} athletes")

    # ── 4. Check for already-imported events ─────────────────────────────────
    print("\nChecking for already-imported events...")
    existing_events = db.get(
        "events",
        f"select=title,start_at&description=ilike.{requests.utils.quote(IMPORT_MARKER + '%')}"
    )
    already_imported: set[tuple[str, str]] = set()
    for e in existing_events:
        already_imported.add((e["title"], e["start_at"][:16]))
    print(f"  {len(already_imported)} events already imported (will skip)")

    # ── 5. Parse Excel ────────────────────────────────────────────────────────
    print(f"\nParsing {EXCEL_PATH} ...")
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb[SHEET_NAME]

    events_to_insert:  list[dict] = []
    athlete_ids_for:   list[str]  = []
    not_found_athletes: set[str]  = set()
    unknown_disciplines: set[str] = set()
    skipped = 0

    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue  # header
        if not any(c is not None for c in row):
            continue

        cols = (list(row) + [None] * 11)[:11]
        date_val, _day, start_str, end_str, disc_excel, athlete_name, assess_type, \
            _role, _freq, professional, _ = cols

        if not date_val or not athlete_name or not assess_type:
            continue

        # Parse date
        if not isinstance(date_val, datetime):
            continue
        date = date_val.date()

        # Parse time strings (some cells may be time objects too)
        def to_hm(val):
            if val is None:
                return (14, 0)
            s = str(val).strip()
            parts = s.split(":")
            return int(parts[0]), int(parts[1])

        start_h, start_m = to_hm(start_str)
        end_h,   end_m   = to_hm(end_str)

        start_dt = datetime(date.year, date.month, date.day, start_h, start_m, tzinfo=CST)
        end_dt   = datetime(date.year, date.month, date.day, end_h, end_m, tzinfo=CST)
        start_iso = start_dt.isoformat()
        end_iso   = end_dt.isoformat()

        # Map discipline → sport_id
        disc_value = DISCIPLINE_MAP.get(disc_excel)
        if disc_excel and not disc_value:
            unknown_disciplines.add(disc_excel)
        sport_id = sport_id_map.get(disc_value) if disc_value else None

        # Map assessment → event_type
        event_type = ASSESSMENT_EVENT_TYPE.get(assess_type, "evaluation")

        # Find athlete by name
        name_key = str(athlete_name).strip()
        athlete_id = (
            athlete_by_exact.get(name_key.lower())
            or athlete_by_norm.get(normalize_name(name_key))
        )
        if not athlete_id:
            not_found_athletes.add(name_key)
            continue

        # Deduplication check
        title = f"{assess_type} — {name_key}"
        if (title, start_iso[:16]) in already_imported:
            skipped += 1
            continue

        events_to_insert.append({
            "title":                 title,
            "event_type":            event_type,
            "sport_id":              sport_id,
            "start_at":              start_iso,
            "end_at":                end_iso,
            "status":                "scheduled",
            "created_by_profile_id": creator_id,
            "description": (
                f"{IMPORT_MARKER} {assess_type} | {disc_excel} | "
                f"Profesionista: {professional}"
            ),
        })
        athlete_ids_for.append(athlete_id)

    # ── 6. Summary ────────────────────────────────────────────────────────────
    print(f"\n{'DRY RUN ' if dry else ''}Import summary:")
    print(f"  Events to insert:   {len(events_to_insert)}")
    print(f"  Already imported:   {skipped} (skipped)")
    print(f"  Athletes not found: {len(not_found_athletes)}")
    if unknown_disciplines:
        print(f"  Unknown disciplines: {unknown_disciplines}")
    if not_found_athletes:
        print("\n⚠️  Athletes not found in DB (will be skipped):")
        for n in sorted(not_found_athletes):
            print(f"    - {n}")

    assessment_counts = Counter(
        e["description"].split("|")[0].replace(IMPORT_MARKER, "").strip()
        for e in events_to_insert
    )
    print("\n  Breakdown by assessment type:")
    for k, v in assessment_counts.most_common():
        print(f"    {k}: {v}")

    if dry or not events_to_insert:
        if dry:
            print("\n✅  Dry run complete — no data written.")
        else:
            print("\nNothing to import.")
        return

    # ── 7. Batch-insert events ────────────────────────────────────────────────
    print("\nInserting events...")
    inserted_ids: list[str] = []
    for i in range(0, len(events_to_insert), BATCH_SIZE):
        batch = events_to_insert[i : i + BATCH_SIZE]
        result = db.post("events", batch)
        ids = [r["id"] for r in result]
        inserted_ids.extend(ids)
        print(f"  events {i+1}–{i+len(batch)} ✓")

    # ── 8. Batch-insert participants ─────────────────────────────────────────
    print("Inserting event participants...")
    participant_rows = [
        {
            "event_id":         event_id,
            "participant_id":   athlete_id,
            "participant_type": "athlete",
            "attendance_status":"planned",
        }
        for event_id, athlete_id in zip(inserted_ids, athlete_ids_for)
    ]
    for i in range(0, len(participant_rows), BATCH_SIZE):
        batch = participant_rows[i : i + BATCH_SIZE]
        db.post("event_participants", batch, prefer="return=minimal")
        print(f"  participants {i+1}–{i+len(batch)} ✓")

    print(f"\n✅  Import complete!")
    print(f"   {len(inserted_ids)} events inserted")
    print(f"   {len(participant_rows)} participant records inserted")
    if not_found_athletes:
        print(f"\n⚠️  {len(not_found_athletes)} athletes were not found and skipped.")
        print("   Add them via /admin/athletes and re-run this script to import their appointments.")


if __name__ == "__main__":
    main()
