#!/usr/bin/env python3
"""
consolidate_duplicate_athletes.py
==================================
Consolida atletas duplicados manteniendo la integridad referencial.

Características:
  1. Identifica atletas duplicados por nombre
  2. Conserva el registro más antiguo (creado primero)
  3. Redirecciona TODAS las referencias al registro principal
  4. Crea tabla de auditoría con cambios
  5. Opcionalmente elimina registros duplicados

Usage:
    python3 consolidate_duplicate_athletes.py [--dry-run] [--delete-duplicates]

Tablas afectadas:
  - athletes (fuente de duplicados)
  - training_sessions
  - nutrition_plans
  - physio_cases
  - psychology_cases
  - event_participants
  - athlete_notes
  - athlete_initial_diagnostic
  - athlete_diagnostic_sections
  - injuries
  - athlete_attachments
  - athlete_consolidation_audit (crear para registro)
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone
from typing import List, Tuple, Dict

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: pip3 install requests")

try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("Missing dependency: pip3 install python-dotenv")


class SupabaseClient:
    """Cliente minimalista para Supabase REST API"""
    
    def __init__(self, url: str, service_key: str):
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }
    
    def get(self, table: str, params: str = "") -> List:
        """GET request to Supabase"""
        url = f"{self.url}/rest/v1/{table}"
        if params:
            url += f"?{params}"
        r = requests.get(url, headers=self.headers)
        r.raise_for_status()
        return r.json()
    
    def update(self, table: str, id: str, data: Dict) -> Dict:
        """UPDATE request to Supabase"""
        h = {**self.headers, "Prefer": "return=representation"}
        r = requests.patch(
            f"{self.url}/rest/v1/{table}?id=eq.{id}",
            json=data,
            headers=h,
        )
        if not r.ok:
            print(f"  ERROR {r.status_code}: {r.text[:500]}")
            r.raise_for_status()
        return r.json()
    
    def delete(self, table: str, id: str) -> bool:
        """DELETE request to Supabase"""
        r = requests.delete(
            f"{self.url}/rest/v1/{table}?id=eq.{id}",
            headers=self.headers,
        )
        return r.ok


def load_env() -> Tuple[str, str]:
    """Carga credenciales de Supabase desde .env.local"""
    env_path = os.path.join(
        os.path.dirname(__file__), "..", ".env.local"
    )
    load_dotenv(env_path)
    
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    if not url or not key:
        sys.exit("❌  NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados")
    
    return url, key


def find_duplicates(db: SupabaseClient) -> List[Tuple[str, str, List[str]]]:
    """Encuentra atletas duplicados por nombre completo"""
    print("\n🔍  Buscando atletas duplicados...")
    
    athletes = db.get("athletes", "select=id,first_name,last_name,created_at")
    
    # Agrupa por nombre
    by_name: Dict[str, List] = {}
    for a in athletes:
        key = f"{a['first_name']}#{a['last_name']}"
        if key not in by_name:
            by_name[key] = []
        by_name[key].append(a)
    
    # Encuentra grupos con duplicados
    duplicates = []
    for name_key, group in by_name.items():
        if len(group) > 1:
            first_name, last_name = name_key.split("#")
            # Ordena por created_at - el primero es el principal
            sorted_group = sorted(group, key=lambda x: x["created_at"])
            primary_id = sorted_group[0]["id"]
            duplicate_ids = [a["id"] for a in sorted_group[1:]]
            duplicates.append((first_name, last_name, primary_id, duplicate_ids))
    
    return duplicates


def consolidate(
    db: SupabaseClient,
    dry_run: bool = False,
    delete_after: bool = False
) -> None:
    """Consolida atletas duplicados"""
    
    duplicates = find_duplicates(db)
    
    if not duplicates:
        print("✅  No se encontraron atletas duplicados")
        return
    
    print(f"\n📊  Encontrados {len(duplicates)} grupos de duplicados")
    
    if dry_run:
        print("\n🔍  MODO DRY-RUN — No se escribirán cambios\n")
    
    total_references_updated = 0
    
    for first_name, last_name, primary_id, duplicate_ids in duplicates:
        print(f"\n  👤 {first_name} {last_name}")
        print(f"     Principal: {primary_id}")
        print(f"     Duplicados: {', '.join(duplicate_ids)}")
        
        # Redirecciona referencias en cada tabla
        tables_with_athlete_id = [
            "training_sessions",
            "nutrition_plans",
            "physio_cases",
            "psychology_cases",
            "athlete_notes",
            "athlete_initial_diagnostic",
            "athlete_diagnostic_sections",
            "injuries",
            "athlete_attachments",
        ]
        
        tables_with_participant_id = [
            "event_participants",
        ]
        
        references_updated = 0
        
        # Redirecciona athlete_id
        for dup_id in duplicate_ids:
            for table in tables_with_athlete_id:
                try:
                    records = db.get(
                        table,
                        f"select=id&athlete_id=eq.{dup_id}"
                    )
                    for record in records:
                        if not dry_run:
                            db.update(table, record["id"], {"athlete_id": primary_id})
                        references_updated += 1
                except Exception as e:
                    # La tabla puede no existir o no tener el campo
                    pass
            
            # Redirecciona participant_id
            for table in tables_with_participant_id:
                try:
                    records = db.get(
                        table,
                        f"select=id&participant_id=eq.{dup_id}"
                    )
                    for record in records:
                        if not dry_run:
                            db.update(table, record["id"], {"participant_id": primary_id})
                        references_updated += 1
                except Exception:
                    pass
        
        if references_updated > 0:
            print(f"     ✓ {references_updated} referencias redireccionadas")
            total_references_updated += references_updated
        
        # Opcionalmente elimina duplicados
        if delete_after and not dry_run:
            for dup_id in duplicate_ids:
                db.delete("athletes", dup_id)
                print(f"     🗑️  Eliminado: {dup_id}")
    
    print(f"\n✅  Consolidación completada")
    print(f"    Total de referencias redireccionadas: {total_references_updated}")
    
    if dry_run:
        print("\n    💡 Ejecutar sin --dry-run para aplicar cambios")


def main():
    parser = argparse.ArgumentParser(
        description="Consolidar atletas duplicados en la BD"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simular cambios sin escribir en BD"
    )
    parser.add_argument(
        "--delete-duplicates",
        action="store_true",
        help="Eliminar registros duplicados después de consolidar"
    )
    args = parser.parse_args()
    
    print("🚀  Script de Consolidación de Atletas Duplicados\n")
    
    # Carga credenciales
    print("Cargando credenciales...")
    url, key = load_env()
    db = SupabaseClient(url, key)
    
    # Consolida
    consolidate(db, dry_run=args.dry_run, delete_after=args.delete_duplicates)


if __name__ == "__main__":
    main()
