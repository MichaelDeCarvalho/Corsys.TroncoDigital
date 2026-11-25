"""Owner A04/E03: real PostgreSQL negatives and rollback in a disposable CI DB."""
from pathlib import Path
import json
import check_commercial_concurrency_pg as pg

pg.PGDATABASE = 'platform_identity_gate'
pg.assert_disposable_target()
assert pg.sql('select current_database()') == 'platform_identity_gate'
foundation=pg.source('202609040001')
core=pg.source('202609040002')
saas=pg.source('202609080006')
v33=pg.source('202609090014')
pg.sql('''
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;
create schema auth; create schema private;
create table auth.users(id uuid primary key);
create table public.organizations(id uuid primary key);
create function auth.jwt() returns jsonb language sql stable as
 $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
''')
pg.sql('\n'.join([
 pg.function(foundation,'private','set_updated_at'),
 pg.function(core,'private','prevent_financial_mutation'),
 pg.table(saas,'platform_staff'),pg.table(saas,'saas_master_audit_logs'),
 pg.table(v33,'saas_platform_configuration'),
 *(pg.function(v33,'private',n) for n in ('has_aal2','is_platform_staff','require_platform_staff')),
 pg.trigger(v33,'saas_platform_configuration_set_updated_at'),
 pg.trigger(saas,'saas_master_audit_logs_immutable'),
]))
pg.sql('''grant usage on schema public,auth,private to authenticated,anon;
insert into public.saas_platform_configuration(singleton) values(true);
''')
migration=Path('supabase/migrations/20261125210000_v35_platform_identity_master_edit.sql').read_text()
body='\n'.join(migration.strip().splitlines()[1:-1])
exists="select to_regprocedure('public.save_platform_identity(jsonb,timestamptz,text)') is not null;"
assert pg.sql('begin;'+body+exists+'rollback;'+exists)=='t\nf'
pg.sql(body)
master='00000000-0000-4000-8000-000000000001'
support='00000000-0000-4000-8000-000000000002'
tenant='00000000-0000-4000-8000-000000000003'
pg.sql(f"insert into auth.users values('{master}'),('{support}'),('{tenant}'); insert into platform_staff(user_id,role) values('{master}','MASTER'),('{support}','SUPPORT');")
token=pg.sql('select updated_at from saas_platform_configuration')
fields=['trade_name','legal_name','tax_id','postal_code','address_line','city','state_code','billing_email','support_email','support_phone']
data={k:None for k in fields};data['trade_name']='CorSys QA'
def call(payload=data, expected=token):
 return "select public.save_platform_identity('%s'::jsonb,'%s'::timestamptz,'QA cadastro');"%(json.dumps(payload),expected)
def actor(user,aal):
 return "set role authenticated; set request.jwt.claims='%s';"%json.dumps({'sub':user,'aal':aal})
pg.sql('set role anon;'+call(),succeeds=False,error_code='42501')
pg.sql(actor(master,'aal1')+call(),succeeds=False,error_code='42501')
for user in (support,tenant): pg.sql(actor(user,'aal2')+call(),succeeds=False,error_code='42501')
pg.sql('set role authenticated;'+call(),succeeds=False,error_code='28000')
for payload in ({**data,'default_due_day':'20'},{k:v for k,v in data.items() if k!='city'},{**data,'trade_name':None},{**data,'tax_id':'invalid'},{**data,'billing_email':'broken'},{**data,'city':42}):
 pg.sql(actor(master,'aal2')+call(payload),succeeds=False,error_code='22023')
pg.sql(actor(master,'aal2')+call(expected='2000-01-01T00:00:00Z'),succeeds=False,error_code='PT409')
pg.sql(actor(master,'aal2')+"update saas_platform_configuration set trade_name='bypass' where singleton;",succeeds=False,error_code='42501')
changed={**data,'tax_id':'00.000.000/E08G-12','postal_code':'80000-000','state_code':'pr','support_email':'qa@example.test'}
out=pg.sql('begin;'+actor(master,'aal2')+call(changed)+'''reset role;
select (trade_name='CorSys QA' and tax_id='00000000E08G12' and postal_code='80000000' and state_code='PR' and default_due_day=10 and default_trial_days=14) from saas_platform_configuration;
select count(*)=1 and bool_and(metadata->'changed_fields' ? 'tax_id') and bool_and(not(metadata::text like '%qa@example.test%')) from saas_master_audit_logs;
rollback;
select trade_name='Corsys Tronco Digital' from saas_platform_configuration;
select count(*)=0 from saas_master_audit_logs;
''')
assert out.splitlines()[-4:]==['t','t','t','t'],out
print('PLATFORM_IDENTITY_PG_PASS: DDL rollback, MASTER/AAL2, allowlist, CAS, audit privacy, atomic rollback')
