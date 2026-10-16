"""SQL grammar only: no database, dependency, RLS or PL/pgSQL runtime validation."""
from pathlib import Path
from pglast import parse_sql

root = Path(__file__).resolve().parents[1]
paths = sorted((root / 'supabase/migrations').glob('*.sql'))
paths += sorted((root / 'scripts').glob('*.sql'))
failures = []
for path in paths:
    try:
        statements = parse_sql(path.read_text())
        print(f'PASS SQL grammar: {path.relative_to(root)} ({len(statements)} statements)')
    except Exception as error:
        failures.append(path)
        print(f'FAIL: {path.relative_to(root)}: {error}')
print('Database execution, PL/pgSQL bodies, JWT/RLS and concurrency: NOT EVALUATED')
raise SystemExit(bool(failures))
