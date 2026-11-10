"""Cash flow RPC gate against disposable PostgreSQL and the actual ledger view."""
from concurrent.futures import ThreadPoolExecutor
import json
import time
from pathlib import Path
import subprocess
import os

def sql(query, code=None, app="cash-flow"):
    p = subprocess.run(
        ["psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose",
         "-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-d", "cash_flow_gate"],
        input=query, text=True, capture_output=True, timeout=20,
        env={**os.environ, "PGPASSWORD": "onboarding-ci", "PGAPPNAME": app},
    )
    if code:
        assert p.returncode and code in p.stderr, p.stderr
    else:
        assert p.returncode == 0, p.stderr
    return p.stdout.strip()

def uid(n):
    return f"00000000-0000-4000-8000-{n:012d}"

a,b,cash,other,c1,c2,pay,rev,part,member,charge,receipt,receivable,c3 = map(uid, range(1,15))
root = Path(__file__).resolve().parents[1] / "supabase/migrations"

def source(pattern):
    path, = root.glob(pattern)
    return path.read_text(encoding="utf-8")

view = source("*post_v31_views_security.sql").split("create or replace view public.v_financial_account_movements",1)[1].split(";",1)[0]
permission = source("*security_rls.sql").split("create or replace function private.require_permission(",1)[1].split("$$;",1)[0]
active = source("*financial_views.sql").split("create or replace view public.v_active_allocations",1)[1].split(";",1)[0]
# Roles already exist in the CI cluster. Authorization claims are simulated.
sql(f"""
create schema private; create schema auth;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('qa.actor',true),'')::uuid $$;
create function private.has_permission(uuid,text) returns boolean language sql stable as
$$ select $1=auth.uid() and $2='finance.read' and $1 in ('{a}','{b}') $$;
create or replace function private.require_permission({permission}$$;
create table financial_accounts(id uuid,organization_id uuid,name text);
create table financial_categories(id uuid,organization_id uuid,name text);
create table account_opening_entries(id uuid,organization_id uuid,financial_account_id uuid,effective_date date,amount numeric);
create table institutional_payable_payments(id uuid,organization_id uuid,financial_account_id uuid,payment_date date,amount numeric,created_at timestamptz,reference text,notes text);
create table institutional_payable_payment_reversals(payment_id uuid,organization_id uuid,reversal_date date);
create table institutional_receipts(id uuid,organization_id uuid,financial_account_id uuid,receipt_date date,amount numeric,created_at timestamptz,reference text,notes text);
create table institutional_receipt_reversals(receipt_id uuid,organization_id uuid,reversal_date date);
create table payments(id uuid,organization_id uuid,member_id uuid,financial_account_id uuid,payment_date date,amount numeric,source_kind text,reference text,notes text);
create table payment_reversals(id uuid,payment_id uuid,organization_id uuid,reversal_date date,created_at timestamptz);
create table member_credit_reversals(id uuid,member_credit_id uuid);
create table financial_account_transfers(id uuid,organization_id uuid,from_account_id uuid,to_account_id uuid,transfer_date date,amount numeric);
create table financial_account_transfer_reversals(transfer_id uuid,reversal_date date);
create table institutional_payable_payment_allocations(id uuid,organization_id uuid,payable_payment_id uuid,payable_id uuid,amount numeric,created_at timestamptz);
create table institutional_payable_allocation_reversals(allocation_id uuid,organization_id uuid,created_at timestamptz);
create table institutional_payables(id uuid,organization_id uuid,category_id uuid,description text);
create table institutional_payable_corrections(organization_id uuid,payable_id uuid,new_category_id uuid,new_description text,correction_seq bigint,created_at timestamptz);
create table institutional_receipt_allocations(organization_id uuid,id uuid,receipt_id uuid,receivable_id uuid,created_at timestamptz);
create table institutional_receipt_allocation_reversals(organization_id uuid,allocation_id uuid,created_at timestamptz);
create table institutional_receivables(id uuid,organization_id uuid,category_id uuid,description text);
create table institutional_receivable_corrections(organization_id uuid,receivable_id uuid,new_category_id uuid,new_description text,correction_seq bigint,created_at timestamptz);
create table receivable_allocations(id uuid,organization_id uuid,member_id uuid,payment_id uuid,member_credit_id uuid,charge_id uuid,created_at timestamptz);
create table allocation_reversals(id uuid,organization_id uuid,allocation_id uuid,created_at timestamptz);
create table charges(id uuid,organization_id uuid,member_id uuid,category_id uuid,description text);
create view public.v_active_allocations{active};
create view public.v_financial_account_movements{view};
""")
migration = source("*v35_cash_flow_detail.sql").strip().splitlines()
assert migration[0]=="begin;" and migration[-1]=="commit;"
body="\n".join(migration[1:-1])
exists="select to_regprocedure('public.read_tenant_cash_flow_detail(uuid,date,date,integer)') is not null;"
assert sql("begin;\n"+body+"\n"+exists+"rollback;"+exists)=="t\nf"
sql("begin;\n"+body+"\ncommit;")
sql(f"""
insert into financial_accounts values ('{cash}','{a}','Caixa A'),('{other}','{b}','Caixa B'),('{part}','{a}','Banco A');
insert into financial_categories values ('{c1}','{a}','Energia'),('{c2}','{a}','Internet'),('{c3}','{b}','Outra Loja');
insert into account_opening_entries values ('{uid(50)}','{a}','{cash}','2026-01-01',100),('{uid(51)}','{b}','{other}','2026-01-01',999);
insert into financial_account_transfers values ('{uid(52)}','{a}','{cash}','{part}','2026-01-02',10);
insert into institutional_payables values ('{uid(30)}','{a}','{c1}','Fatura original'),('{uid(31)}','{a}','{c2}','Internet mensal');
insert into institutional_payable_corrections values ('{a}','{uid(30)}','{c2}','Correção posterior',1,'2026-01-04');
insert into institutional_payable_payments values
 ('{pay}','{a}','{cash}','2026-01-02',50,'2026-01-02',null,null),
 ('{rev}','{a}','{cash}','2026-01-01',20,'2026-01-01',null,null);
insert into institutional_payable_payment_allocations values
 ('{uid(40)}','{a}','{pay}','{uid(30)}',30,'2026-01-02'),
 ('{uid(41)}','{a}','{pay}','{uid(31)}',10,'2026-01-02'),
 ('{uid(42)}','{a}','{rev}','{uid(30)}',20,'2026-01-01');
insert into institutional_payable_allocation_reversals values ('{uid(42)}','{a}','2026-01-03');
insert into institutional_payable_payment_reversals values ('{rev}','{a}','2026-01-03');
insert into payments values ('{member}','{a}','{member}','{cash}','2026-01-02',5,'operational',null,null);
insert into charges values ('{charge}','{a}','{member}','{c1}','Origem da cobrança');
insert into receivable_allocations values ('{uid(43)}','{a}','{member}','{member}',null,'{charge}','2026-01-02');
insert into institutional_receipts values ('{receipt}','{a}','{cash}','2026-01-02',7,'2026-01-02',null,null);
insert into institutional_receivables values ('{receivable}','{a}','{c2}','Origem do recebível');
insert into institutional_receipt_allocations values ('{a}','{uid(44)}','{receipt}','{receivable}','2026-01-02');
""")
def call(org=a, page=0):
    return f"select public.read_tenant_cash_flow_detail('{org}','2026-01-02','2026-01-03',{page});"

def as_user(actor=a):
    return f"set role authenticated; set qa.actor='{actor}';"

sql("set role anon;"+call(),"42501")
sql(as_user(uid(99))+call(),"42501")
sql(as_user(a)+call(b),"42501")
assert json.loads(sql(as_user(b)+call(b)))["opening"]==999
result=json.loads(sql(as_user()+call()))
assert (result["opening"],result["closing"],result["expense_net"],result["total"])==(80,62,30,4)
assert [row["balance"] for row in result["history"]]==[42,62]
assert [row["amount"] for row in result["expenses"]]==[10,10,10]
assert {row["category"] for row in result["expenses"]}=={"Energia","Internet",None}
assert {row["description"] for row in result["rows"]}=={
    "Fatura original","Fatura original • Internet mensal","Origem da cobrança","Origem do recebível"}
assert json.loads(sql(as_user()+call(page=1)))["rows"]==[]

# Observe a committed change from another connection while the first reader holds its snapshot.
with ThreadPoolExecutor(max_workers=1) as pool:
    reader=pool.submit(sql,"begin isolation level repeatable read;"+as_user()+call()+"select pg_sleep(4);"+call()+"commit;",None,"cash-reader")
    for _ in range(70):
        if sql("select count(*) from pg_stat_activity where application_name='cash-reader' and wait_event='PgSleep';")=="1":
            break
        time.sleep(.05)
    else:
        raise AssertionError("Reader did not hold its transaction")
    sql(f"insert into account_opening_entries values ('{uid(99)}','{a}','{cash}','2026-01-03',1);")
    snapshots=[json.loads(line) for line in reader.result().splitlines() if line]
    assert snapshots==[result,result]
assert json.loads(sql(as_user()+call()))["closing"]==63
sql(f"update institutional_payable_payment_allocations set amount=51 where id='{uid(40)}';")
sql(as_user()+call(),"23514")
print("PASS cash flow rollback, permissions, A/B isolation, partial allocations, reversals and concurrent snapshots")
