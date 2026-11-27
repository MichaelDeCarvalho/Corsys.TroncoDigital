"""D04 Backup & Recovery Sanitized Inventory Manifest Generator.

Generates an auditable, secret-free manifest covering database migrations,
private storage buckets, configuration key names (no secret values),
35-day max rotation policy, RPO/RTO readiness targets marked unproven,
and optional disposable CI trial telemetry (SHA-256 digests, encryption check,
step durations in milliseconds, and cleanup verification) without exposing raw dumps.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_VALUE_RE = re.compile(
    r"(sb_secret_|eyJ[a-zA-Z0-9_-]+\.|password=|POSTGRES_PASSWORD=[^\n]+|szqkdekwhzxsoxorgvaz|supabase\.co)",
    re.I,
)


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


def build_backup_manifest(root: Path = ROOT, trial_report_path: Path | None = None) -> dict:
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

    manifest: dict = {
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

    if trial_report_path is not None:
        raw_trial = json.loads(trial_report_path.read_text(encoding="utf-8"))
        manifest["disposable_trial_evidence"] = {
            "execution_environment": str(raw_trial.get("execution_environment", "disposable_pg17_ci")),
            "production_rpo_rto_proven": False,
            "raw_dump_published": False,
            "source_db_name": str(raw_trial.get("source_db_name", "v35_m05_source_trial")),
            "restore_db_name": str(raw_trial.get("restore_db_name", "v35_m05_restore_trial")),
            "migrations_applied": int(raw_trial.get("migrations_applied", len(migrations))),
            "dump_sha256": str(raw_trial["dump_sha256"]),
            "dump_bytes": int(raw_trial["dump_bytes"]),
            "encrypted_dump_sha256": str(raw_trial["encrypted_dump_sha256"]),
            "encrypted_dump_bytes": int(raw_trial["encrypted_dump_bytes"]),
            "encryption_cipher": str(raw_trial.get("encryption_cipher", "AES-256-CBC-PBKDF2")),
            "decrypted_sha256_match": bool(raw_trial["decrypted_sha256_match"]),
            "source_vs_restore_diff_zero": bool(raw_trial["source_vs_restore_diff_zero"]),
            "verification_checks_pass": bool(raw_trial["verification_checks_pass"]),
            "selective_recovery_pass": bool(raw_trial["selective_recovery_pass"]),
            "durations_ms": {
                str(k): int(v) for k, v in dict(raw_trial.get("durations_ms", {})).items()
            },
        }

    serialized = json.dumps(manifest, sort_keys=True)
    if FORBIDDEN_VALUE_RE.search(serialized):
        raise ValueError("Sanitization failure: secret or forbidden environment pattern detected in backup manifest")
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

    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", delete=True) as tmp:
        json.dump(
            {
                "execution_environment": "github_actions_disposable_pg17",
                "source_db_name": "v35_m05_source_trial",
                "restore_db_name": "v35_m05_restore_trial",
                "migrations_applied": manifest["components"]["database"]["migrations_count"],
                "dump_sha256": "a" * 64,
                "dump_bytes": 102400,
                "encrypted_dump_sha256": "b" * 64,
                "encrypted_dump_bytes": 102432,
                "encryption_cipher": "AES-256-CBC-PBKDF2",
                "decrypted_sha256_match": True,
                "source_vs_restore_diff_zero": True,
                "verification_checks_pass": True,
                "selective_recovery_pass": True,
                "durations_ms": {
                    "prepare_and_seed_ms": 1200,
                    "backup_and_encrypt_ms": 450,
                    "restore_and_verify_ms": 800,
                    "selective_recovery_ms": 95,
                    "total_trial_ms": 2545,
                },
            },
            tmp,
        )
        tmp.flush()
        enriched = build_backup_manifest(trial_report_path=Path(tmp.name))
        assert enriched["policy"]["target_status"] == "target_unproven"
        assert enriched["disposable_trial_evidence"]["production_rpo_rto_proven"] is False
        assert enriched["disposable_trial_evidence"]["raw_dump_published"] is False
        assert enriched["disposable_trial_evidence"]["decrypted_sha256_match"] is True
        assert enriched["disposable_trial_evidence"]["selective_recovery_pass"] is True

    print("BACKUP_MANIFEST_SELF_TEST_PASS:", manifest["manifest_sha256"])


def main() -> None:
    parser = argparse.ArgumentParser(description="CorSys V35 M05.02 Sanitized Backup Manifest Generator")
    parser.add_argument("--self-test", action="store_true", help="Run built-in self-test assertions")
    parser.add_argument("--trial-report", type=Path, default=None, help="Path to sanitized disposable trial JSON telemetry")
    parser.add_argument("--output", type=Path, default=None, help="Optional path to write manifest JSON")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return

    manifest = build_backup_manifest(trial_report_path=args.trial_report)
    rendered = json.dumps(manifest, indent=2, ensure_ascii=False)
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
