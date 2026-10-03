"""Static preservation gate. Does not prove runtime or UI parity with the HTML pilot."""
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
baseline = json.loads((root / 'docs/engineering/v35-preservation-baseline.json').read_text())
runtime = json.loads((root / 'docs/engineering/v35-dev-runtime-manifest.json').read_text())
historical = json.loads((root / 'docs/engineering/v35-source-manifest.json').read_text())
errors = []
if baseline['source_sha256'] != historical['source_sha256']:
    errors.append('V35 source archive changed without reconciliation')
for path in baseline['required_documents']:
    if not (root / path).is_file():
        errors.append(f'Missing V35 document: {path}')
for entry in baseline['decisions'] + runtime['migrations']:
    path = root / entry['path']
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
        errors.append(f'Historical decision/applied migration changed: {entry["path"]}')
sql = '\n'.join(p.read_text() for p in sorted((root / 'supabase/migrations').glob('*.sql')))
# Declaration inventory only; changed grants, definitions and runtime behavior require separate tests.
declarations = {(kind.lower(), name.lower()) for kind, name in re.findall(
    r'create\s+(?:or\s+replace\s+)?(table|function|view)\s+(?:if\s+not\s+exists\s+)?((?:public|private)\.\w+)', sql, re.I)}
for obj in baseline['schema_objects']:
    if (obj['kind'], obj['name']) not in declarations:
        errors.append(f'Missing V35 declaration: {obj["kind"]} {obj["name"]}')
# Prototype integrity and traceability; no evaluation of attached JavaScript.
pilot_manifest = root / 'docs/engineering/v35-pilot-baseline.json'
if not pilot_manifest.is_file():
    errors.append('Missing pilot baseline')
else:
    pilot = json.loads(pilot_manifest.read_text())
    for entry in (pilot['reference'], pilot['inventory']):
        path = root / entry['path']
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
            errors.append(f'Pilot reference/inventory changed without reconciliation: {entry["path"]}')
    for name in pilot['required_documents']:
        if not (root / name).is_file():
            errors.append(f'Missing pilot scope document: {name}')
    inventory_path = root / pilot['inventory']['path']
    if inventory_path.is_file():
        inventory = json.loads(inventory_path.read_text())
        screens = [s['id'] for s in inventory['sections']]
        if screens != pilot['required_screens'] or len(set(screens)) != 21:
            errors.append('Pilot screen inventory differs from accepted 21 screens')
        if inventory['source']['sha256'] != pilot['source_original_sha256']:
            errors.append('Original pilot hash differs from baseline')
        counts = {
            'screen_fields': sum(len(s['fields']) for s in inventory['sections']),
            'shared_fields': len(inventory['shared']['fields']),
            'dynamic_field_occurrences': sum(len(s['fields']) for s in inventory['fragments']),
            'dynamic_fragments': len(inventory['fragments']),
        }
        if counts != pilot['counts']:
            errors.append('Pilot field/fragment occurrences differ from baseline')
        for document in ['docs/V35_PILOT_PARITY.md', 'docs/V35_PILOT_INVENTORY.md']:
            if (root / document).is_file():
                content = (root / document).read_text()
                for screen in screens:
                    if screen not in content:
                        errors.append(f'Missing pilot screen trace in {document}: {screen}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: {len(baseline["decisions"])} ADRs, {len(runtime["migrations"])} applied migrations, '
      f'{len(baseline["required_documents"])} documents and {len(baseline["schema_objects"])} schema declarations and 21 pilot screens preserved.')
