import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Pass the path to the unpacked PGlite dist/index.js. The database is in memory.
const runtime = process.argv[2]
assert(runtime, 'Pass the path to the PGlite module')
const { PGlite } = await import(pathToFileURL(resolve(runtime)).href)
const db = new PGlite()
const migration = name => readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8')
const v33 = migration('20261002202042_202609090014_v33_saas_control_plane')
const v34 = migration('20261002202054_202609100015_v34_master_operations')

function statement(source, start, end) {
  const first = source.indexOf(start)
  const last = source.indexOf(end, first)
  assert(first >= 0 && last >= first, start)
  return source.slice(first, last + end.length)
}

const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`
const [master, support, memberA, memberB, outsider, orgA, orgB, ticketA, ticketB, internal] =
  Array.from({ length: 10 }, (_, index) => id(index + 1))
const tickets = 'public.saas_support_tickets'
const events = 'public.saas_support_ticket_events'
const eventIds = `select id from ${events} order by created_at, id`

async function caller(user, aal) {
  await db.exec('reset role; set role authenticated')
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: user, aal })])
}

async function visible(expected) {
  const { rows } = await db.query(eventIds)
  assert.deepEqual(rows.map(row => Number(row.id)), expected)
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema private;
    create table auth.users(id uuid primary key);
    create table public.organizations(id uuid primary key);
    create table public.platform_staff(user_id uuid, active boolean, role text);
    create table public.user_roles(organization_id uuid, user_id uuid);
    create function auth.jwt() returns jsonb language sql stable as
      $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as
      $$ select (auth.jwt()->>'sub')::uuid $$;
    ${['has_aal2', 'is_platform_staff', 'is_tenant_user'].map(name =>
      statement(v33, `create or replace function private.${name}(`, '$$;')).join('\n')}
    ${statement(v33, `create table ${tickets} (`, '\n);')}
    ${statement(v33, `create table ${events} (`, '\n);')}
    ${statement(v34, `alter table ${tickets}\n  add column`, ';')}
    alter table ${tickets} alter column organization_id drop not null;
    alter table ${events} alter column organization_id drop not null;
    ${statement(v34, `alter table ${events}\n  add constraint`, ';')}
    alter table ${tickets} enable row level security;
    alter table ${events} enable row level security;
    ${statement(v34, 'create policy saas_support_tickets_select', ';')}
    ${statement(v34, 'create policy saas_support_ticket_events_select', ';')}
    grant usage on schema auth, private to authenticated;
    grant select on ${tickets}, ${events} to authenticated;
    grant select, insert on ${events} to service_role;
    insert into auth.users values ('${master}'), ('${support}'), ('${memberA}'), ('${memberB}');
    insert into public.organizations values ('${orgA}'), ('${orgB}');
    insert into public.platform_staff values ('${master}', true, 'MASTER'), ('${support}', true, 'SUPPORT');
    insert into public.user_roles values ('${orgA}', '${memberA}'), ('${orgB}', '${memberB}');
    insert into ${tickets}(id, organization_id, ticket_scope, subject, opened_by_user_id) values
      ('${ticketA}', '${orgA}', 'tenant', 'Loja A', '${memberA}'),
      ('${ticketB}', '${orgB}', 'tenant', 'Loja B', '${memberB}'),
      ('${internal}', null, 'internal', 'Interno', '${master}');
    insert into ${events}(organization_id, ticket_id, to_status, visibility, reason, actor_user_id, created_at) values
      ('${orgA}', '${ticketA}', 'new', 'customer', 'fixture reason', '${memberA}', '2030-01-01'),
      ('${orgA}', '${ticketA}', 'working', 'internal', null, null, '2030-01-01'),
      ('${orgB}', '${ticketB}', 'new', 'customer', null, null, '2030-01-01'),
      (null, '${internal}', 'new', 'internal', null, null, '2030-01-01');
  `)
  await db.exec(migration('20261111223000_v35_support_event_read_projection'))

  for (const [user, aal, expected] of [
    [master, 'aal2', [1, 2, 3, 4]],
    [support, 'aal2', [1, 2, 3, 4]],
    [master, 'aal1', []],
    [support, 'aal1', []],
    [outsider, 'aal2', []],
    [memberA, 'aal1', [1]],
    [memberB, 'aal1', [3]],
  ]) {
    await caller(user, aal)
    await visible(expected)
  }

  for (const user of [memberA, master]) {
    await caller(user, 'aal2')
    for (const column of ['reason', 'actor_user_id', '*']) {
      await assert.rejects(db.query(`select ${column} from ${events}`), { code: '42501' })
    }
    await assert.rejects(db.query(`update ${events} set to_status = 'closed'`), { code: '42501' })
  }
  await db.exec('reset role; set role anon')
  await assert.rejects(db.query(eventIds), { code: '42501' })

  await db.exec(`reset role; set role service_role;
    insert into ${events}(ticket_id, to_status, visibility, reason) values
      ('${internal}', 'working', 'internal', 'internal writer');`)
  const { rows } = await db.query(`select reason from ${events} where id = 5`)
  assert.deepEqual(rows, [{ reason: 'internal writer' }])

  const { rows: [version] } = await db.query('show server_version')
  console.log(`PASS PostgreSQL ${version.server_version}: Master and Support AAL2, Loja A/B, anonymous denial, stable order, restricted projection and internal writer`)
} finally {
  await db.close()
}
