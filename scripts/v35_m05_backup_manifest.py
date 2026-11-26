"""D04 Backup & Recovery Sanitized Inventory Manifest Generator.

Generates an auditable, secret-free manifest covering database migrations,
private storage buckets, configuration key names (no secret values),
35-day max rotation policy, and RPO/RTO readiness targets marked unproven
until disposable restore telemetry passes.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_VALUE_RE = re.compile(r"(sb_secret_|eyJ[a-zA-Z0-9_-]+\.|password=|POSTGRES_PASSWORD=[^\n]+)", re.I)


def parse_env_example_keys(env_path: Path) -> list[str]:
    if not env_path.is_file():
        return []
    keys: list[str] = []
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key = line.split("=", 1)[0].strip()
        if key:
            keys.append(key)
    return sorted(set(keys))


def build_backup_manifest(root: Path = ROOT) -> dict:
    migrations = sorted((root / "supabase/migrations").glob("*.sql"))
    env_keys = parse_env_example_keys(root / ".env.example")
    wrangler_dev = root / "wrangler.dev.jsonc"

    config_files = []
    for rel in (".env.example", "wrangler.dev.jsonc", "package.json", "package-lock.json"):
        p = root / rel
        if p.is_file():
            config_files.append({
                "path": rel,
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                "bytes": p.stat().st_size,
            })

    manifest = {
        "schema_version": "2026.11-m05-d04",
        "policy": {
            "encrypted_off_primary_required": True,
            "max_rotation_days": 35,
            "rpo_target_hours": 24,
            "rto_target_hours": 8,
            "target_status": "target_unproven",
            "disposable_trial_only_for_dev_qa": True,
            "real_data_restore_authorized": False,
        },
        "components": {
            "database": {
                "engine": "PostgreSQL 17 / Supabase",
                "migrations_count": len(migrations),
                "latest_migration": migrations[-1].name if migrations else None,
            },
            "private_storage_buckets": [
                {
                    "bucket": "tenant-documents",
                    "access": "private",
                    "metadata_table": "public.documents",
                    "verification_method": "checksum_and_inventory_only",
                },
                {
                    "bucket": "org-assets",
                    "access": "private",
                    "metadata_table": "public.organization_settings.logo_path",
                    "verification_method": "checksum_and_inventory_only",
                },
            ],
            "configuration_checklist": {
                "env_variable_names_only": env_keys,
                "wrangler_dev_present": wrangler_dev.is_file(),
                "tracked_config_hashes": config_files,
                "secrets_stored_in_manifest": False,
            },
        },
        "selective_recovery_guard": {
            "single_tenant_isolation_required": True,
            "deleted_or_pseudonymized_reintroduction_blocked": True,
        },
    }

    serialized = json.dumps(manifest, sort_keys=True)
    if FORBIDDEN_VALUE_RE.search(serialized):
        raise ValueError("Sanitization failure: secret pattern detected in backup manifest")
    manifest["manifest_sha256"] = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    return manifest


def self_test() -> None:
    manifest = build_backup_manifest()
    assert manifest["policy"]["max_rotation_days"] <= 35
    assert manifest["policy"]["rpo_target_hours"] == 24
    assert manifest["policy"]["rto_target_hours"] == 8
    assert manifest["policy"]["target_status"] == "target_unproven"
    assert manifest["policy"]["real_data_restore_authorized"] is False
    assert manifest["components"]["configuration_checklist"]["secrets_stored_in_manifest"] is False
    assert manifest["components"]["database"]["migrations_count"] >= 40
    assert len(manifest["manifest_sha256"]) == 64
    print("BACKUP_MANIFEST_SELF_TEST_PASS:", manifest["manifest_sha256"])


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        print(json.dumps(build_backup_manifest(), indent=2, ensure_ascii=False))
