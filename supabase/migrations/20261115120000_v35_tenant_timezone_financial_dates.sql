-- V35 M04.03 / M06.01 (ADR-0048): Regra oficial de data civil financeira por Loja
-- Fonte de verdade: public.organization_settings.timezone (default 'America/Sao_Paulo').
-- Valida fusos IANA permitidos (fail-closed) e centraliza a data civil atual da Loja em
-- private.tenant_current_date(p_organization_id uuid), eliminando a divergência entre UTC
-- e horário local (especialmente na virada diária 21:00–23:59 BRT) em Dashboard,
-- Inadimplência, Fluxo de Caixa, vencimentos, competências e relatórios financeiros.

create or replace function private.is_valid_iana_timezone(
  p_timezone text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_timezone is not null
    and pg_catalog.length(pg_catalog.btrim(p_timezone)) between 3 and 100
    and p_timezone = pg_catalog.btrim(p_timezone)
    and pg_catalog.lower(p_timezone) not in ('localtime', 'posixrules')
    and (
      p_timezone = 'UTC'
      or p_timezone ~ '^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)+$'
    )
    and exists (
      select 1
      from pg_catalog.pg_timezone_names tz
      where tz.name = p_timezone
    );
$$;

revoke all on function private.is_valid_iana_timezone(text) from PUBLIC, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'organization_settings_timezone_format_check'
      and conrelid = 'public.organization_settings'::regclass
  ) then
    alter table public.organization_settings
      add constraint organization_settings_timezone_format_check
      check (
        pg_catalog.btrim(timezone) <> ''
        and timezone = pg_catalog.btrim(timezone)
        and pg_catalog.lower(timezone) not in ('localtime', 'posixrules')
        and (
          timezone = 'UTC'
          or timezone ~ '^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)+$'
        )
      );
  end if;
end $$;

create or replace function private.validate_organization_settings_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.timezone is null then
    new.timezone := 'America/Sao_Paulo';
  end if;

  if not private.is_valid_iana_timezone(new.timezone) then
    raise exception 'invalid organization IANA timezone: %', coalesce(new.timezone, '<null>')
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_organization_settings_timezone() from PUBLIC, anon, authenticated;

drop trigger if exists organization_settings_timezone_guard on public.organization_settings;
create trigger organization_settings_timezone_guard
before insert or update of timezone on public.organization_settings
for each row execute function private.validate_organization_settings_timezone();

create or replace function private.tenant_current_date_at(
  p_organization_id uuid,
  p_reference_at timestamptz
)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  if p_organization_id is null or p_reference_at is null then
    raise exception 'organization and reference timestamp are required'
      using errcode = '22023';
  end if;

  select s.timezone
    into v_tz
  from public.organization_settings s
  where s.organization_id = p_organization_id;

  v_tz := coalesce(v_tz, 'America/Sao_Paulo');

  if not private.is_valid_iana_timezone(v_tz) then
    raise exception 'invalid organization IANA timezone configured for tenant'
      using errcode = '22023';
  end if;

  return (p_reference_at at time zone v_tz)::date;
end;
$$;

revoke all on function private.tenant_current_date_at(uuid, timestamptz) from PUBLIC, anon, authenticated;

create or replace function private.tenant_current_date(
  p_organization_id uuid
)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select private.tenant_current_date_at(p_organization_id, pg_catalog.clock_timestamp());
$$;

revoke all on function private.tenant_current_date(uuid) from PUBLIC, anon, authenticated;

-- 1. Dashboard financeiro da Loja (6 KPIs canônicos)
create or replace function public.read_tenant_financial_dashboard(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_member_open numeric(14,2);v_inst_open numeric(14,2);
 v_member_overdue numeric(14,2);v_inst_overdue numeric(14,2);
 v_payables numeric(14,2);v_payables_overdue numeric(14,2);
 v_received numeric(14,2);v_balance numeric(14,2);
 v_bad integer;
 v_today date;
begin
 perform private.require_permission(p_organization_id,'finance.read');
 if p_organization_id is null then raise exception 'organization required' using errcode='22023';end if;
 v_today := private.tenant_current_date(p_organization_id);
 select count(*) into v_bad from public.v_charge_balances c where c.organization_id=p_organization_id and c.integrity_ok is not true;
 if v_bad>0 then raise exception 'member balance integrity mismatch' using errcode='23514';end if;
 select count(*) into v_bad from public.v_institutional_receivable_effective r
 where r.organization_id=p_organization_id and r.integrity_ok is not true;
 if v_bad>0 then raise exception 'receivable integrity mismatch' using errcode='23514';end if;
 select count(*) into v_bad from public.v_institutional_payable_effective p
 where p.organization_id=p_organization_id and p.integrity_ok is not true;
 if v_bad>0 then raise exception 'payable integrity mismatch' using errcode='23514';end if;
 select coalesce(sum(c.open_amount),0)::numeric(14,2),
   coalesce(sum(c.open_amount) filter(where c.due_date<v_today),0)::numeric(14,2)
 into v_member_open,v_member_overdue from public.v_charge_balances c
 where c.organization_id=p_organization_id and not c.is_cancelled;
 select coalesce(sum(r.open_amount),0)::numeric(14,2),
   coalesce(sum(r.open_amount) filter(where r.due_date<v_today),0)::numeric(14,2)
 into v_inst_open,v_inst_overdue from public.v_institutional_receivable_effective r
 where r.organization_id=p_organization_id and not r.is_canceled;
 select coalesce(sum(p.open_amount),0)::numeric(14,2),
   coalesce(sum(p.open_amount) filter(where p.due_date<v_today),0)::numeric(14,2)
 into v_payables,v_payables_overdue from public.v_institutional_payable_effective p
 where p.organization_id=p_organization_id and not p.is_canceled;
 select coalesce(sum(m.signed_amount) filter(
   where m.movement_date>=date_trunc('month',v_today)::date
   and m.movement_date<=v_today
   and m.movement_type in ('member_payment','member_payment_reversal',
     'institutional_receipt','institutional_receipt_reversal')),0)::numeric(14,2),
   coalesce(sum(m.signed_amount) filter(where m.movement_date<=v_today),0)::numeric(14,2)
 into v_received,v_balance from public.v_financial_account_movements m
 where m.organization_id=p_organization_id;
 return jsonb_build_object(
 'organization_id',p_organization_id,'as_of',v_today,
 'member_open',v_member_open,'institutional_open',v_inst_open,
 'receivables_open',(v_member_open+v_inst_open)::numeric(14,2),
 'receivables_overdue',(v_member_overdue+v_inst_overdue)::numeric(14,2),
 'received_this_month',v_received,'cash_bank_balance',v_balance,
 'payables_open',v_payables,'payables_overdue',v_payables_overdue,
 'integrity_ok',true);
end $$;
revoke all on function public.read_tenant_financial_dashboard(uuid) from PUBLIC,anon,authenticated;
grant execute on function public.read_tenant_financial_dashboard(uuid) to authenticated;

-- 2. Relatório paginado de inadimplência
create or replace function public.read_tenant_delinquency(
 p_organization_id uuid,p_limit integer,p_offset integer
) returns table (
 member_id uuid,full_name text,member_status text,
 overdue_items bigint,overdue_amount numeric,available_credit numeric,
 oldest_due date,net_position numeric
) language plpgsql stable security definer set search_path='' as $$
declare
 v_today date;
begin
 perform private.require_permission(p_organization_id,'finance.read');
 if p_organization_id is null or p_limit is null or p_limit not between 1 and 100
  or p_offset is null or p_offset<0 or p_offset>10000
 then raise exception 'invalid delinquency pagination' using errcode='22023';end if;
 v_today := private.tenant_current_date(p_organization_id);
 if exists(select 1 from public.v_charge_balances c
  where c.organization_id=p_organization_id and c.integrity_ok is not true)
 or exists(select 1 from public.v_member_financial_position pos
  where pos.organization_id=p_organization_id and pos.integrity_ok is not true)
 then raise exception 'delinquency financial integrity mismatch' using errcode='23514';end if;
 return query
 with overdue as (
  select c.member_id,
   count(*)::bigint as count_items,
   sum(c.open_amount)::numeric(14,2) as amount,
   min(c.due_date) as first_due
  from public.v_charge_balances c
  where c.organization_id=p_organization_id and not c.is_cancelled
   and c.due_date<v_today and c.open_amount>0
  group by c.member_id
 )
 select m.id,m.full_name,m.status,
  d.count_items,d.amount,coalesce(pos.available_credit,0)::numeric(14,2),
  d.first_due,coalesce(pos.net_position,0)::numeric(14,2)
 from overdue d
 join public.members m on m.organization_id=p_organization_id and m.id=d.member_id
 left join public.v_member_financial_position pos
  on pos.organization_id=m.organization_id and pos.member_id=m.id
 order by d.amount desc,m.full_name,m.id
 limit p_limit offset p_offset;
end $$;
revoke all on function public.read_tenant_delinquency(uuid,integer,integer) from PUBLIC,anon,authenticated;
grant execute on function public.read_tenant_delinquency(uuid,integer,integer) to authenticated;

-- 3. Resumo global e filtragem paginada por faixas de inadimplência
create or replace function public.read_tenant_delinquency_bucket_summary(
 p_organization_id uuid
) returns table (
 bucket_id text,
 member_count bigint,
 overdue_items bigint,
 overdue_amount numeric,
 server_date date
) language plpgsql stable security definer set search_path='' as $$
declare
 v_today date;
begin
 perform private.require_permission(p_organization_id,'finance.read');
 if p_organization_id is null then
  raise exception 'invalid organization' using errcode='22023';
 end if;
 v_today := private.tenant_current_date(p_organization_id);
 if exists(select 1 from public.v_charge_balances c
  where c.organization_id=p_organization_id and c.integrity_ok is not true)
 or exists(select 1 from public.v_member_financial_position pos
  where pos.organization_id=p_organization_id and pos.integrity_ok is not true)
 then raise exception 'delinquency financial integrity mismatch' using errcode='23514';end if;

 return query
 with canonical_buckets(bucket_id, sort_order) as (
  values
   ('up30'::text, 1),
   ('31-60'::text, 2),
   ('61-90'::text, 3),
   ('over90'::text, 4)
 ),
 overdue as (
  select c.member_id,
   count(*)::bigint as count_items,
   sum(c.open_amount)::numeric(14,2) as amount,
   min(c.due_date) as first_due
  from public.v_charge_balances c
  where c.organization_id=p_organization_id and not c.is_cancelled
   and c.due_date<v_today and c.open_amount>0
  group by c.member_id
 ),
 member_buckets as (
  select d.*,
   (v_today - d.first_due) as days_overdue,
   case
    when (v_today - d.first_due) <= 30 then 'up30'
    when (v_today - d.first_due) <= 60 then '31-60'
    when (v_today - d.first_due) <= 90 then '61-90'
    else 'over90'
   end as b_id
  from overdue d
 ),
 grouped as (
  select
   b.b_id::text as bucket_id,
   count(*)::bigint as member_count,
   sum(b.count_items)::bigint as overdue_items,
   sum(b.amount)::numeric(14,2) as overdue_amount
  from member_buckets b
  group by b.b_id
 )
 select
  cb.bucket_id,
  coalesce(g.member_count, 0)::bigint,
  coalesce(g.overdue_items, 0)::bigint,
  coalesce(g.overdue_amount, 0)::numeric(14,2),
  v_today
 from canonical_buckets cb
 left join grouped g on g.bucket_id = cb.bucket_id
 order by cb.sort_order;
end $$;

create or replace function public.read_tenant_delinquency_filtered(
 p_organization_id uuid,
 p_bucket text,
 p_limit integer,
 p_offset integer
) returns table (
  member_id uuid,full_name text,member_status text,
  overdue_items bigint,overdue_amount numeric,available_credit numeric,
  oldest_due date,net_position numeric
) language plpgsql stable security definer set search_path='' as $$
declare
 v_today date;
begin
 perform private.require_permission(p_organization_id,'finance.read');
 if p_organization_id is null or p_limit is null or p_limit not between 1 and 100
  or p_offset is null or p_offset<0 or p_offset>10000
 then raise exception 'invalid delinquency pagination' using errcode='22023';end if;
 if p_bucket is not null and p_bucket not in ('up30','31-60','61-90','over90') then
  raise exception 'invalid delinquency bucket' using errcode='22023';
 end if;
 v_today := private.tenant_current_date(p_organization_id);
 if exists(select 1 from public.v_charge_balances c
  where c.organization_id=p_organization_id and c.integrity_ok is not true)
 or exists(select 1 from public.v_member_financial_position pos
  where pos.organization_id=p_organization_id and pos.integrity_ok is not true)
 then raise exception 'delinquency financial integrity mismatch' using errcode='23514';end if;

 return query
 with overdue as (
  select c.member_id,
   count(*)::bigint as count_items,
   sum(c.open_amount)::numeric(14,2) as amount,
   min(c.due_date) as first_due
  from public.v_charge_balances c
  where c.organization_id=p_organization_id and not c.is_cancelled
   and c.due_date<v_today and c.open_amount>0
  group by c.member_id
 ),
 member_buckets as (
  select d.*,
   (v_today - d.first_due) as days_overdue,
   case
    when (v_today - d.first_due) <= 30 then 'up30'
    when (v_today - d.first_due) <= 60 then '31-60'
    when (v_today - d.first_due) <= 90 then '61-90'
    else 'over90'
   end as b_id
  from overdue d
 )
 select m.id,m.full_name,m.status,
  b.count_items,b.amount,coalesce(pos.available_credit,0)::numeric(14,2),
  b.first_due,coalesce(pos.net_position,0)::numeric(14,2)
 from member_buckets b
 join public.members m on m.organization_id=p_organization_id and m.id=b.member_id
 left join public.v_member_financial_position pos
  on pos.organization_id=m.organization_id and pos.member_id=m.id
 where (p_bucket is null or b.b_id = p_bucket)
 order by b.amount desc,m.full_name,m.id
 limit p_limit offset p_offset;
end $$;

revoke all on function public.read_tenant_delinquency_bucket_summary(uuid) from PUBLIC,anon,authenticated;
grant execute on function public.read_tenant_delinquency_bucket_summary(uuid) to authenticated;

revoke all on function public.read_tenant_delinquency_filtered(uuid,text,integer,integer) from PUBLIC,anon,authenticated;
grant execute on function public.read_tenant_delinquency_filtered(uuid,text,integer,integer) to authenticated;

-- 4. Transferências entre contas financeiras da Loja
create or replace function public.register_tenant_account_transfer_idempotent(
 p_organization_id uuid,p_from_account_id uuid,p_to_account_id uuid,
 p_transfer_date date,p_amount numeric,p_reference text,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_open numeric;v_accounts integer;v_period date;v_ref text;v_today date;
begin
 perform private.require_permission(p_organization_id,'institutional.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_from_account_id is null or p_to_account_id is null or p_from_account_id=p_to_account_id
  or p_transfer_date is null or p_transfer_date>v_today or p_transfer_date<date '2020-01-01'
  or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
  or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2)
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_reference is not null and length(btrim(p_reference))>120
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid financial account transfer' using errcode='22023';end if;
 v_ref:=nullif(btrim(p_reference),'');
 v_period:=date_trunc('month',p_transfer_date)::date;
 v_id:=private.idempotency_begin(p_organization_id,'register_tenant_account_transfer_idempotent',
  btrim(p_idempotency_key),jsonb_build_object('from',p_from_account_id,'to',p_to_account_id,
  'date',p_transfer_date,'amount',p_amount,'reference',v_ref,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.financial_accounts
  where organization_id=p_organization_id and id in (p_from_account_id,p_to_account_id)
   and active=true order by id for update;
 get diagnostics v_accounts=row_count;
 if v_accounts<>2 then raise exception 'active source/destination accounts not found in tenant'
   using errcode='23503';end if;
 if private.is_period_closed(p_organization_id,v_period) then
  raise exception 'transfer posting period closed' using errcode='55000';end if;
 select coalesce(sum(m.signed_amount),0)::numeric(14,2) into v_open
 from public.v_financial_account_movements m
 where m.organization_id=p_organization_id and m.financial_account_id=p_from_account_id
 and m.movement_date<=p_transfer_date;
 if v_open<p_amount then raise exception 'insufficient available ledger balance in source account'
  using errcode='23514';end if;
 insert into public.financial_account_transfers(
  organization_id,from_account_id,to_account_id,transfer_date,accounting_period,
  amount,reference,reason,created_by
 )values(
  p_organization_id,p_from_account_id,p_to_account_id,p_transfer_date,v_period,
  p_amount,v_ref,btrim(p_reason),auth.uid()
 ) returning id into v_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'financial_account_transfer.post','financial_account_transfer',v_id,
  jsonb_build_object('from',p_from_account_id,'to',p_to_account_id,'amount',p_amount,
   'transfer_date',p_transfer_date,'accounting_period',v_period,'reference',v_ref),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.register_tenant_account_transfer_idempotent(uuid,uuid,uuid,date,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.register_tenant_account_transfer_idempotent(uuid,uuid,uuid,date,numeric,text,text,text) to authenticated;

create or replace function public.reverse_tenant_account_transfer_idempotent(
 p_organization_id uuid,p_transfer_id uuid,p_reversal_date date,
 p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_transfer public.financial_account_transfers%rowtype;
 v_period date;v_dest_balance numeric;v_account_count integer;v_today date;
begin
 perform private.require_permission(p_organization_id,'institutional.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_transfer_id is null or p_reversal_date is null or p_reversal_date>v_today
  or p_reversal_date<date '2020-01-01'
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid account transfer reversal' using errcode='22023';end if;
 v_period:=date_trunc('month',p_reversal_date)::date;
 v_id:=private.idempotency_begin(p_organization_id,'reverse_tenant_account_transfer_idempotent',
  btrim(p_idempotency_key),jsonb_build_object('transfer',p_transfer_id,
  'date',p_reversal_date,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 select * into v_transfer from public.financial_account_transfers
 where organization_id=p_organization_id and id=p_transfer_id for update;
 if not found then raise exception 'transfer not found in tenant' using errcode='23503';end if;
 if p_reversal_date<v_transfer.transfer_date
 then raise exception 'reversal cannot predate original transfer' using errcode='22023';end if;
 if exists(select 1 from public.financial_account_transfer_reversals
   where transfer_id=p_transfer_id and organization_id=p_organization_id)
 then raise exception 'transfer already reversed' using errcode='23514';end if;
 perform id from public.financial_accounts
 where organization_id=p_organization_id and id in(v_transfer.from_account_id,v_transfer.to_account_id)
 order by id for update;
 get diagnostics v_account_count=row_count;
 if v_account_count<>2 then raise exception 'account not found for transfer reversal'
  using errcode='23503';end if;
 if private.is_period_closed(p_organization_id,v_period) then
  raise exception 'reversal period closed' using errcode='55000';end if;
 select coalesce(sum(m.signed_amount),0)::numeric(14,2) into v_dest_balance
 from public.v_financial_account_movements m
 where m.organization_id=p_organization_id and m.financial_account_id=v_transfer.to_account_id
 and m.movement_date<=p_reversal_date;
 if v_dest_balance<v_transfer.amount then
   raise exception 'insufficient destination ledger balance for reversal' using errcode='23514';end if;
 insert into public.financial_account_transfer_reversals(
  transfer_id,organization_id,reversal_date,accounting_period,reason,created_by
 )values(p_transfer_id,p_organization_id,p_reversal_date,v_period,btrim(p_reason),auth.uid());
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'financial_account_transfer.reverse','financial_account_transfer',
 p_transfer_id,jsonb_build_object('reversal_date',p_reversal_date,'original_date',v_transfer.transfer_date,
  'amount',v_transfer.amount,'from',v_transfer.from_account_id,'to',v_transfer.to_account_id),
 btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),p_transfer_id);
 return p_transfer_id;
end $$;
revoke all on function public.reverse_tenant_account_transfer_idempotent(uuid,uuid,date,text,text) from public,anon,authenticated;
grant execute on function public.reverse_tenant_account_transfer_idempotent(uuid,uuid,date,text,text) to authenticated;

-- 5. Conciliação bancária (importação de extrato respeitando data civil da Loja)
create or replace function public.stage_tenant_bank_statement(p_organization_id uuid,p_account_id uuid,
 p_file_name text,p_file_sha256 text,p_lines jsonb,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_line jsonb;v_n integer:=0;v_date date;v_amount numeric;v_today date;
begin
 perform private.require_permission(p_organization_id,'reconciliation.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_file_name is null or length(p_file_name) not between 1 and 200
  or p_file_sha256 is null or p_file_sha256!~'^[a-f0-9]{64}$'
  or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 500
  or octet_length(p_lines::text)>1000000
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid statement import' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'stage_tenant_bank_statement',btrim(p_idempotency_key),
  jsonb_build_object('account',p_account_id,'name',p_file_name,'hash',p_file_sha256,'lines',p_lines,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.financial_accounts where organization_id=p_organization_id and id=p_account_id and active for share;
 if not found then raise exception 'active account not found in tenant' using errcode='23503';end if;
 for v_line in select value from jsonb_array_elements(p_lines) loop
  if jsonb_typeof(v_line) is distinct from 'object'
   or v_line->>'date' is null or (v_line->>'date')!~'^\d{4}-\d{2}-\d{2}$'
   or v_line->>'description' is null or length(btrim(v_line->>'description')) not between 1 and 500
   or v_line->>'amount' is null or (v_line->>'amount')!~'^-?\d{1,12}(\.\d{1,2})?$'
   or v_line->>'external_id' is not null and length(btrim(v_line->>'external_id')) not between 1 and 200
  then raise exception 'invalid statement line' using errcode='22023';end if;
  v_date:=(v_line->>'date')::date;v_amount:=(v_line->>'amount')::numeric;
  if v_date<date '2020-01-01' or v_date>v_today or v_amount=0 or abs(v_amount)>999999999999.99
  then raise exception 'invalid statement date or amount' using errcode='22023';end if;
 end loop;
 insert into public.bank_statement_imports(organization_id,financial_account_id,period_start,period_end,file_name,file_sha256,imported_by)
 select p_organization_id,p_account_id,min((value->>'date')::date),max((value->>'date')::date),p_file_name,p_file_sha256,auth.uid()
 from jsonb_array_elements(p_lines) returning id into v_id;
 for v_line in select value from jsonb_array_elements(p_lines) loop
  v_n:=v_n+1;
  insert into public.bank_statement_lines(organization_id,statement_import_id,line_number,transaction_date,description,amount,external_id)
   values(p_organization_id,v_id,v_n,(v_line->>'date')::date,btrim(v_line->>'description'),(v_line->>'amount')::numeric,nullif(btrim(v_line->>'external_id'),''));
 end loop;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'bank_statement.stage','bank_statement_import',v_id,
  jsonb_build_object('account',p_account_id,'sha256',p_file_sha256,'line_count',v_n),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.stage_tenant_bank_statement(uuid,uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.stage_tenant_bank_statement(uuid,uuid,text,text,jsonb,text,text) to authenticated;

-- 6. Acordo de dívida de integrante (data do acordo e janela de competência por Loja)
create or replace function public.preview_member_debt_agreement(
 p_organization_id uuid,p_member_id uuid,p_charge_ids uuid[],p_amount numeric,
 p_installment_count integer,p_agreement_date date,p_first_due date
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_schedule jsonb;v_snapshot jsonb;v_total numeric;v_count integer;
 v_categories integer;v_category uuid;v_mapping record;v_allow boolean;v_cents bigint;
 v_today date;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 perform private.require_permission(p_organization_id,'charges.adjust');
 v_today := private.tenant_current_date(p_organization_id);
 if p_member_id is null or p_charge_ids is null or cardinality(p_charge_ids) not between 1 and 50
  or array_position(p_charge_ids,null) is not null
  or (select count(distinct x) from unnest(p_charge_ids)x)<>cardinality(p_charge_ids)
  or p_amount is null or p_amount::text in('NaN','Infinity','-Infinity')
  or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2)
  or p_installment_count is null or p_installment_count not between 1 and 24
  or p_amount*100<p_installment_count
  or p_agreement_date is null or not isfinite(p_agreement_date) or p_agreement_date>v_today
  or p_agreement_date<(date_trunc('month',v_today)-interval '12 months')::date
  or p_first_due is null or not isfinite(p_first_due) or p_first_due<p_agreement_date
  or p_first_due>(p_agreement_date+interval '12 months')::date
 then raise exception 'invalid debt agreement parameters' using errcode='22023';end if;
 perform id from public.members where organization_id=p_organization_id and id=p_member_id;
 if not found then raise exception 'member not found in tenant' using errcode='23503';end if;
 select count(*),count(distinct c.category_id),sum(b.open_amount),
  jsonb_agg(jsonb_build_object('charge_id',c.id,'category_id',c.category_id,
   'account',c.accounting_account_id,'plan',c.accounting_plan_id,
   'effective',b.effective_amount,'allocated',b.allocated_amount,'open',b.open_amount) order by c.id)
 into v_count,v_categories,v_total,v_items
 from public.charges c join public.v_charge_balances b on b.charge_id=c.id and b.organization_id=c.organization_id
 where c.organization_id=p_organization_id and c.member_id=p_member_id and c.id=any(p_charge_ids)
  and not b.is_cancelled and b.integrity_ok and b.open_amount>0 and c.issue_date<=p_agreement_date;
 if v_count<>cardinality(p_charge_ids) then raise exception 'charge absent or no longer open in tenant/member' using errcode='23503';end if;
 if v_categories<>1 or p_amount>v_total or v_total>999999999999.99 then raise exception 'agreement requires one category and cannot increase debt' using errcode='23514';end if;
 select category_id into v_category from public.charges where organization_id=p_organization_id and id=p_charge_ids[1];
 select allow_installments into v_allow from public.financial_categories where organization_id=p_organization_id
  and id=v_category and active and domain='member_receivable';
 if not found or (p_installment_count>1 and not v_allow) then raise exception 'category not eligible for installments' using errcode='23514';end if;
 if private.is_period_closed(p_organization_id,date_trunc('month',p_agreement_date)::date)
 then raise exception 'agreement accounting period closed' using errcode='55000';end if;
 select * into v_mapping from private.resolve_category_account(p_organization_id,v_category,p_agreement_date);
 if not found or exists(select 1 from public.charges where organization_id=p_organization_id and id=any(p_charge_ids)
  and (accounting_plan_id is distinct from v_mapping.accounting_plan_id or accounting_account_id is distinct from v_mapping.accounting_account_id))
 then raise exception 'agreement accounting classification unavailable or changed' using errcode='23514';end if;
 v_cents:=(p_amount*100)::bigint;
 select jsonb_agg(jsonb_build_object('number',n,'due_date',(p_first_due+make_interval(months=>n-1))::date,
  'amount',((v_cents/p_installment_count)+case when n<=v_cents%p_installment_count then 1 else 0 end)/100.0) order by n)
 into v_schedule from generate_series(1,p_installment_count)n;
 v_snapshot:=jsonb_build_object('organization_id',p_organization_id,'member_id',p_member_id,'category_id',v_category,
  'original_amount',v_total,'negotiated_amount',p_amount,'installment_count',p_installment_count,
  'agreement_date',p_agreement_date,'first_due',p_first_due,'items',v_items,'installments',v_schedule,
  'plan_id',v_mapping.accounting_plan_id,'account_id',v_mapping.accounting_account_id);
 return v_snapshot||jsonb_build_object('fingerprint',encode(extensions.digest(v_snapshot::text,'sha256'),'hex'));
end $$;
revoke all on function public.preview_member_debt_agreement(uuid,uuid,uuid[],numeric,integer,date,date) from public,anon,authenticated;
grant execute on function public.preview_member_debt_agreement(uuid,uuid,uuid[],numeric,integer,date,date) to authenticated;

-- 7. Geração mensal de cobranças de integrantes, regras recorrentes e vigências por Loja
create or replace function public.preview_monthly_charge_generation(
 p_organization_id uuid,p_rule_id uuid,p_competence date
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_rule public.recurring_rules%rowtype;v_category public.financial_categories%rowtype;
 v_mapping uuid;v_count integer;v_create integer;v_exempt integer;v_existing integer;v_missing integer;
 v_checksum text;v_closed boolean;v_today date;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 v_today := private.tenant_current_date(p_organization_id);
 if p_rule_id is null or p_competence is null or extract(day from p_competence)<>1
   or p_competence<(date_trunc('month',v_today)-interval '12 months')::date
   or p_competence>=(date_trunc('month',v_today)+interval '13 months')::date
 then raise exception 'monthly competence out of supported range' using errcode='22023';end if;
 select * into v_rule from public.recurring_rules
 where id=p_rule_id and organization_id=p_organization_id;
 if not found then raise exception 'monthly rule not found in organization' using errcode='23503';end if;
 select * into v_category from public.financial_categories
 where id=v_rule.category_id and organization_id=p_organization_id;
 select a.accounting_account_id into v_mapping
 from private.resolve_category_account(p_organization_id,v_rule.category_id,p_competence) a;
 select count(*),count(*) filter(where decision='create'),
   count(*) filter(where decision='exempt'),count(*) filter(where decision='existing'),
   count(*) filter(where decision='missing_price'),
   encode(extensions.digest(coalesce(string_agg(
     member_id::text||'|'||coalesce(amount::text,'NULL')||'|'||decision||'|'||due_date::text,
     ';' order by member_id),'')||'|'||p_organization_id::text||'|'||
       p_rule_id::text||'|'||p_competence::text,'sha256'),'hex')
 into v_count,v_create,v_exempt,v_existing,v_missing,v_checksum
 from private.monthly_charge_candidates(p_organization_id,p_rule_id,p_competence);
 v_closed:=private.is_period_closed(p_organization_id,p_competence);
 return jsonb_build_object(
  'organization_id',p_organization_id,'rule_id',p_rule_id,'competence',p_competence,
  'rule_name',v_rule.name,'ready',
    v_rule.active and v_rule.frequency='monthly'
    and coalesce(v_category.active,false) and coalesce(v_category.allow_recurrence,false)
    and v_category.domain='member_receivable'
    and v_mapping is not null and not v_closed and v_count>0 and v_count<=200
    and v_missing=0 and v_create>0,
  'eligible_members',v_count,'to_create',v_create,'exempt',v_exempt,
  'already_generated',v_existing,'missing_price',v_missing,
  'accounting_mapping_ready',v_mapping is not null,'period_closed',v_closed,
  'fingerprint',v_checksum
 );
end $$;
revoke all on function public.preview_monthly_charge_generation(uuid,uuid,date) from PUBLIC,anon,authenticated;
grant execute on function public.preview_monthly_charge_generation(uuid,uuid,date) to authenticated;

create or replace function public.create_tenant_monthly_rule(p_organization_id uuid,p_category_id uuid,p_name text,p_unit_amount numeric,p_valid_from date,p_due_day integer,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_version uuid; v_today date;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_category_id is null or p_name is null or length(btrim(p_name)) not between 1 and 120
  or p_unit_amount is null or p_unit_amount::text in ('NaN','Infinity','-Infinity') or p_unit_amount<=0 or p_unit_amount>999999999999.99 or p_unit_amount<>round(p_unit_amount,2)
  or p_valid_from is null or p_valid_from<=date_trunc('month',v_today)::date or extract(day from p_valid_from)<>1
  or p_due_day is null or p_due_day not between 1 and 31 or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'invalid monthly rule input' using errcode='22023'; end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_tenant_monthly_rule',p_idempotency_key,jsonb_build_object('category',p_category_id,'name',btrim(p_name),'amount',p_unit_amount,'from',p_valid_from,'due',p_due_day,'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 if not exists(select 1 from public.financial_categories where id=p_category_id and organization_id=p_organization_id and active and allow_recurrence and domain='member_receivable') then raise exception 'category outside organization or ineligible' using errcode='23503'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':monthly-rule:'||lower(btrim(p_name)),0));
 if exists(select 1 from public.recurring_rules where organization_id=p_organization_id and lower(btrim(name))=lower(btrim(p_name))) then raise exception 'rule name already exists' using errcode='23505'; end if;
 insert into public.recurring_rules(organization_id,category_id,name,frequency,due_day) values(p_organization_id,p_category_id,btrim(p_name),'monthly',p_due_day) returning id into v_id;
 insert into public.recurring_rule_versions(recurring_rule_id,valid_from_competence,unit_amount) values(v_id,p_valid_from,p_unit_amount) returning id into v_version;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'recurring_rule.create','recurring_rule',v_id,jsonb_build_object('category_id',p_category_id,'version_id',v_version,'from',p_valid_from,'unit_amount',p_unit_amount,'due_day',p_due_day),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id); return v_id;
end $$;
revoke all on function public.create_tenant_monthly_rule(uuid,uuid,text,numeric,date,integer,text,text) from public,anon,authenticated;
grant execute on function public.create_tenant_monthly_rule(uuid,uuid,text,numeric,date,integer,text,text) to authenticated;

create or replace function public.schedule_tenant_monthly_price(p_organization_id uuid, p_rule_id uuid, p_expected_version_id uuid, p_unit_amount numeric, p_valid_from date, p_reason text, p_idempotency_key text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_id uuid; v_rule public.recurring_rules%rowtype; v_previous public.recurring_rule_versions%rowtype; v_today date;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_rule_id is null or p_expected_version_id is null or p_unit_amount is null or p_unit_amount::text in ('NaN','Infinity','-Infinity') or p_unit_amount<=0 or p_unit_amount>999999999999.99 or p_unit_amount<>round(p_unit_amount,2)
  or p_valid_from is null or p_valid_from<=date_trunc('month',v_today)::date or extract(day from p_valid_from)<>1
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'invalid monthly price input' using errcode='22023'; end if;
 v_id:=private.idempotency_begin(p_organization_id,'schedule_tenant_monthly_price',p_idempotency_key,jsonb_build_object('rule',p_rule_id,'expected',p_expected_version_id,'amount',p_unit_amount,'from',p_valid_from,'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 select * into v_rule from public.recurring_rules where organization_id=p_organization_id and id=p_rule_id for update;
 if not found then raise exception 'rule outside organization' using errcode='23503'; end if;
 if not v_rule.active or v_rule.frequency<>'monthly' or not exists(select 1 from public.financial_categories where id=v_rule.category_id and organization_id=p_organization_id and active and allow_recurrence and domain='member_receivable') then raise exception 'rule or category ineligible' using errcode='22023'; end if;
 if not exists(select 1 from public.recurring_rule_versions where id=p_expected_version_id and recurring_rule_id=p_rule_id) then raise exception 'price version outside rule' using errcode='23503'; end if;
 select * into v_previous from public.recurring_rule_versions where recurring_rule_id=p_rule_id order by valid_from_competence desc limit 1 for update;
 if not found or v_previous.id<>p_expected_version_id or v_previous.valid_to_competence is not null then raise exception 'monthly price version conflict' using errcode='PT409'; end if;
 if p_valid_from<=v_previous.valid_from_competence then raise exception 'price must follow latest competence' using errcode='22023'; end if;
 update public.recurring_rule_versions set valid_to_competence=(p_valid_from-interval '1 month')::date where id=v_previous.id;
 insert into public.recurring_rule_versions(recurring_rule_id,valid_from_competence,unit_amount) values(p_rule_id,p_valid_from,p_unit_amount) returning id into v_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'recurring_rule.price_schedule','recurring_rule',p_rule_id,jsonb_build_object('version_id',v_previous.id,'unit_amount',v_previous.unit_amount,'to',v_previous.valid_to_competence),jsonb_build_object('version_id',v_id,'from',p_valid_from,'unit_amount',p_unit_amount,'previous_to',(p_valid_from-interval '1 month')::date),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id); return v_id;
end $function$;
revoke all on function public.schedule_tenant_monthly_price(uuid,uuid,uuid,numeric,date,text,text) from public,anon,authenticated;
grant execute on function public.schedule_tenant_monthly_price(uuid,uuid,uuid,numeric,date,text,text) to authenticated;

create or replace function public.schedule_member_configuration(
 p_organization_id uuid,p_member_id uuid,p_kind text,p_reference_id uuid,
 p_effective_from date,p_effective_to date,p_term_type text,p_override_amount numeric,
 p_reason text,p_idempotency_key text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_permission text; v_today date;
begin
 v_permission:=case when p_kind='office' then 'members.write' else 'settings.manage' end;
 perform private.require_permission(p_organization_id,v_permission);
 v_today := private.tenant_current_date(p_organization_id);
 if p_kind is null or p_kind not in ('office','term') or p_member_id is null or p_reference_id is null or p_effective_from is null
  or p_effective_to<p_effective_from or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'invalid configuration input' using errcode='22023'; end if;
 if p_kind='office' then
  if p_effective_from<v_today or p_term_type is not null or p_override_amount is not null then raise exception 'office must start today or later without financial terms' using errcode='22023'; end if;
 else
  if p_effective_from<=date_trunc('month',v_today)::date or extract(day from p_effective_from)<>1
   or (p_effective_to is not null and extract(day from p_effective_to)<>1)
   or p_term_type is null or p_term_type not in ('standard','exempt','override_amount') then raise exception 'future first-of-month terms required' using errcode='22023'; end if;
  if (p_term_type='override_amount' and (p_override_amount is null or p_override_amount::text in ('NaN','Infinity','-Infinity') or p_override_amount<0 or p_override_amount>999999999999.99 or p_override_amount<>round(p_override_amount,2)))
   or (p_term_type<>'override_amount' and p_override_amount is not null) then raise exception 'invalid individual amount' using errcode='22023'; end if;
 end if;
 v_id:=private.idempotency_begin(p_organization_id,'schedule_member_configuration',p_idempotency_key,
  jsonb_build_object('member',p_member_id,'kind',p_kind,'reference',p_reference_id,'from',p_effective_from,'to',p_effective_to,'term',p_term_type,'amount',p_override_amount,'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 if not exists(select 1 from public.members where organization_id=p_organization_id and id=p_member_id) then raise exception 'member outside organization' using errcode='23503'; end if;
 if p_kind='office' then
  if not exists(select 1 from public.office_types where organization_id=p_organization_id and id=p_reference_id and active) then raise exception 'active office outside organization' using errcode='23503'; end if;
  insert into public.member_offices(organization_id,member_id,office_type_id,effective_from,effective_to,notes,created_by)
  values(p_organization_id,p_member_id,p_reference_id,p_effective_from,p_effective_to,btrim(p_reason),auth.uid()) returning id into v_id;
 else
  if not exists(select 1 from public.recurring_rules r join public.financial_categories c on c.organization_id=r.organization_id and c.id=r.category_id
   where r.organization_id=p_organization_id and r.id=p_reference_id and r.active and r.frequency='monthly' and c.active and c.allow_recurrence and c.domain='member_receivable') then raise exception 'active monthly rule outside organization or ineligible' using errcode='23503'; end if;
  insert into public.recurring_member_terms(organization_id,member_id,recurring_rule_id,effective_from,effective_to,term_type,override_amount,reason,created_by)
  values(p_organization_id,p_member_id,p_reference_id,p_effective_from,p_effective_to,p_term_type,p_override_amount,btrim(p_reason),auth.uid()) returning id into v_id;
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'member_configuration.schedule',case when p_kind='office' then 'member_office' else 'recurring_member_term' end,v_id,
  jsonb_build_object('member_id',p_member_id,'reference_id',p_reference_id,'from',p_effective_from,'to',p_effective_to,'term_type',p_term_type,'override_amount',p_override_amount),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id);
 return v_id;
end $$;
revoke all on function public.schedule_member_configuration(uuid,uuid,text,uuid,date,date,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.schedule_member_configuration(uuid,uuid,text,uuid,date,date,text,numeric,text,text) to authenticated;

create or replace function public.transition_member_term(p_organization_id uuid, p_member_id uuid, p_current_term_id uuid, p_next_from date, p_next_type text, p_next_amount numeric, p_reason text, p_idempotency_key text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
 v_current public.recurring_member_terms%rowtype;
 v_result uuid;
 v_last date;
 v_today date;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_member_id is null or p_current_term_id is null or p_next_from is null
   or extract(day from p_next_from)<>1 or p_next_from<=date_trunc('month',v_today)::date
   or (p_next_type is not null and p_next_type not in ('standard','exempt','override_amount'))
   or (p_next_type='override_amount' and (p_next_amount is null or p_next_amount::text in ('NaN','Infinity','-Infinity')
      or p_next_amount<0 or p_next_amount>999999999999.99 or p_next_amount<>round(p_next_amount,2)))
   or (p_next_type is distinct from 'override_amount' and p_next_amount is not null)
   or p_reason is null or length(btrim(p_reason)) not between 3 and 500
   or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid member term transition' using errcode='22023'; end if;
 v_result:=private.idempotency_begin(p_organization_id,'transition_member_term',p_idempotency_key,
   jsonb_build_object('member',p_member_id,'current_term',p_current_term_id,'next_from',p_next_from,
    'next_type',p_next_type,'next_amount',p_next_amount,'reason',btrim(p_reason)));
 if v_result is not null then return v_result; end if;
 perform 1 from public.members
  where organization_id=p_organization_id and id=p_member_id for update;
 if not found then raise exception 'member outside organization' using errcode='23503'; end if;
 select * into v_current from public.recurring_member_terms
  where organization_id=p_organization_id and member_id=p_member_id and id=p_current_term_id for update;
 if not found then raise exception 'member term outside organization' using errcode='23503'; end if;
 if v_current.effective_to is not null then
   raise exception 'member term already transitioned' using errcode='PT409';
 end if;
 if p_next_from<=v_current.effective_from then
   raise exception 'successor must follow existing term' using errcode='22023';
 end if;
 v_last:=(p_next_from-interval '1 month')::date;
 if v_last<v_current.effective_from then
   raise exception 'invalid term closing boundary' using errcode='22023';
 end if;
 update public.recurring_member_terms
    set effective_to=v_last where id=v_current.id and organization_id=p_organization_id;
 if p_next_type is null then
   v_result:=v_current.id;
 else
   insert into public.recurring_member_terms(
      organization_id,member_id,recurring_rule_id,effective_from,effective_to,
      term_type,override_amount,reason,created_by)
   values (p_organization_id,p_member_id,v_current.recurring_rule_id,p_next_from,null,
      p_next_type,p_next_amount,btrim(p_reason),auth.uid())
   returning id into v_result;
 end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,
    before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'member_configuration.transition','recurring_member_term',v_current.id,
  jsonb_build_object('term_id',v_current.id,'member_id',p_member_id,'rule_id',v_current.recurring_rule_id,
   'from',v_current.effective_from,'to',v_current.effective_to,'term_type',v_current.term_type),
  jsonb_build_object('closed_through',v_last,'next_term_id',case when p_next_type is null then null else v_result end,
   'next_from',p_next_from,'next_type',p_next_type,'next_amount',p_next_amount),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_result);
 return v_result;
end $function$;
revoke all on function public.transition_member_term(uuid,uuid,uuid,date,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.transition_member_term(uuid,uuid,uuid,date,text,numeric,text,text) to authenticated;

-- 8. Recorrência institucional mensal e anual e agendamento de preços futuros
create or replace function public.create_tenant_institutional_monthly_rule(
 p_organization_id uuid,p_direction text,p_category_id uuid,p_name text,
 p_counterparty text,p_amount numeric,p_valid_from date,p_due_day integer,
 p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_today date;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_direction is null or p_direction not in('payable','receivable')
  or p_category_id is null or p_name is null or length(btrim(p_name)) not between 3 and 120
  or p_counterparty is null or length(btrim(p_counterparty)) not between 1 and 120
  or p_amount is null or p_amount::text in('NaN','Infinity','-Infinity')
  or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2)
  or p_valid_from is null or not isfinite(p_valid_from) or extract(day from p_valid_from)<>1
  or p_valid_from<date_trunc('month',v_today)::date
  or p_valid_from>=(date_trunc('month',v_today)+interval '13 months')::date
  or p_due_day is null or p_due_day not between 1 and 31
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid institutional monthly rule' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_tenant_institutional_monthly_rule',btrim(p_idempotency_key),
  jsonb_build_object('direction',p_direction,'category',p_category_id,'name',btrim(p_name),'counterparty',btrim(p_counterparty),
   'amount',p_amount,'from',p_valid_from,'due_day',p_due_day,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.organizations where id=p_organization_id for no key update;
 perform id from public.financial_categories where organization_id=p_organization_id and id=p_category_id and active
  and domain=case when p_direction='payable' then 'institutional_expense' else 'institutional_revenue' end for share;
 if not found then raise exception 'institutional category not eligible in tenant' using errcode='23503';end if;
 insert into public.institutional_recurring_rules(organization_id,direction,category_id,name,counterparty_name,frequency,due_day,created_by)
 values(p_organization_id,p_direction,p_category_id,btrim(p_name),btrim(p_counterparty),'monthly',p_due_day,auth.uid()) returning id into v_id;
 insert into public.institutional_recurring_rule_versions(organization_id,recurring_rule_id,valid_from_competence,amount,notes)
 values(p_organization_id,v_id,p_valid_from,p_amount,btrim(p_reason));
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'institutional_rule.create','institutional_recurring_rule',v_id,
  jsonb_build_object('direction',p_direction,'category',p_category_id,'amount',p_amount,'from',p_valid_from),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.create_tenant_institutional_monthly_rule(uuid,text,uuid,text,text,numeric,date,integer,text,text) from public,anon,authenticated;
grant execute on function public.create_tenant_institutional_monthly_rule(uuid,text,uuid,text,text,numeric,date,integer,text,text) to authenticated;

create or replace function public.preview_institutional_monthly_generation(p_organization_id uuid,p_rule_id uuid,p_competence date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_rule public.institutional_recurring_rules%rowtype;v_version public.institutional_recurring_rule_versions%rowtype;
 v_category public.financial_categories%rowtype;v_mapping record;v_policy record;
 v_existing uuid;v_due date;v_snapshot jsonb;v_ready boolean;v_today date;
begin
 perform private.require_permission(p_organization_id,'institutional.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_rule_id is null or p_competence is null or not isfinite(p_competence) or extract(day from p_competence)<>1
  or p_competence<(date_trunc('month',v_today)-interval '12 months')::date
  or p_competence>=(date_trunc('month',v_today)+interval '13 months')::date
 then raise exception 'institutional competence out of range' using errcode='22023';end if;
 select * into v_rule from public.institutional_recurring_rules where organization_id=p_organization_id and id=p_rule_id;
 if not found then raise exception 'institutional rule not found in tenant' using errcode='23503';end if;
 select * into v_version from public.institutional_recurring_rule_versions where organization_id=p_organization_id
  and recurring_rule_id=p_rule_id and valid_from_competence<=p_competence
  and (valid_to_competence is null or valid_to_competence>=p_competence);
 select * into v_category from public.financial_categories where organization_id=p_organization_id and id=v_rule.category_id;
 select * into v_mapping from private.resolve_category_account(p_organization_id,v_rule.category_id,p_competence);
 select * into v_policy from private.current_expense_approval_policy(p_organization_id,p_competence);
 v_due:=make_date(extract(year from p_competence)::integer,extract(month from p_competence)::integer,
  least(v_rule.due_day,extract(day from(p_competence+interval '1 month - 1 day'))::integer));
 if v_rule.direction='payable' then
  select id into v_existing from public.institutional_payables where organization_id=p_organization_id
   and generation_key='institutional-monthly:'||p_rule_id::text||':'||p_competence::text;
 else
  select id into v_existing from public.institutional_receivables where organization_id=p_organization_id
   and generation_key='institutional-monthly:'||p_rule_id::text||':'||p_competence::text;
 end if;
 v_snapshot:=jsonb_build_object('organization_id',p_organization_id,'rule_id',p_rule_id,'competence',p_competence,
  'name',v_rule.name,'direction',v_rule.direction,'active',v_rule.active,'frequency',v_rule.frequency,
  'counterparty',v_rule.counterparty_name,'category_id',v_rule.category_id,'category_active',v_category.active,
  'category_domain',v_category.domain,'version_id',v_version.id,'amount',v_version.amount,'due_date',v_due,
  'accounting_plan_id',v_mapping.accounting_plan_id,'accounting_account_id',v_mapping.accounting_account_id,
  'approval_policy_id',case when v_rule.direction='payable' then v_policy.policy_id end,
  'period_closed',private.is_period_closed(p_organization_id,p_competence),'existing_id',v_existing);
 v_ready:=v_rule.active and v_rule.frequency='monthly' and coalesce(v_category.active,false)
  and v_category.domain=case when v_rule.direction='payable' then 'institutional_expense' else 'institutional_revenue' end
  and v_version.id is not null and v_version.amount::text not in('NaN','Infinity','-Infinity')
  and v_version.amount>0 and v_version.amount<=999999999999.99 and v_mapping.accounting_account_id is not null
  and not private.is_period_closed(p_organization_id,p_competence) and v_existing is null;
 return v_snapshot||jsonb_build_object('ready',coalesce(v_ready,false),
  'fingerprint',encode(extensions.digest(v_snapshot::text,'sha256'),'hex'));
end $$;
revoke all on function public.preview_institutional_monthly_generation(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.preview_institutional_monthly_generation(uuid,uuid,date) to authenticated;

create or replace function public.schedule_institutional_recurring_price(
 p_organization_id uuid,p_rule_id uuid,p_expected_version_id uuid,p_amount numeric,
 p_valid_from date,p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_rule public.institutional_recurring_rules%rowtype;
 v_previous public.institutional_recurring_rule_versions%rowtype;v_today date;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_rule_id is null or p_expected_version_id is null
  or p_amount is null or p_amount::text in('NaN','Infinity','-Infinity')
  or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2)
  or p_valid_from is null or not isfinite(p_valid_from) or extract(day from p_valid_from)<>1
  or p_valid_from<=date_trunc('month',v_today)::date
  or p_valid_from>=(date_trunc('month',v_today)+interval '13 months')::date
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid institutional price schedule' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'schedule_institutional_recurring_price',btrim(p_idempotency_key),
  jsonb_build_object('rule',p_rule_id,'expected',p_expected_version_id,'amount',p_amount,'from',p_valid_from,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.organizations where id=p_organization_id for no key update;
 select * into v_rule from public.institutional_recurring_rules
  where organization_id=p_organization_id and id=p_rule_id for update;
 if not found then raise exception 'institutional rule outside tenant' using errcode='23503';end if;
 if not v_rule.active then raise exception 'institutional rule inactive' using errcode='23514';end if;
 perform id from public.financial_categories where organization_id=p_organization_id and id=v_rule.category_id
  and active and domain=case when v_rule.direction='payable' then 'institutional_expense' else 'institutional_revenue' end for share;
 if not found then raise exception 'institutional category ineligible' using errcode='23514';end if;
 if not exists(select 1 from public.institutional_recurring_rule_versions
  where organization_id=p_organization_id and recurring_rule_id=p_rule_id and id=p_expected_version_id)
 then raise exception 'price version outside rule' using errcode='23503';end if;
 select * into v_previous from public.institutional_recurring_rule_versions
  where organization_id=p_organization_id and recurring_rule_id=p_rule_id
  order by valid_from_competence desc limit 1 for update;
 if not found or v_previous.id<>p_expected_version_id or v_previous.valid_to_competence is not null
 then raise exception 'institutional price version changed' using errcode='PT409';end if;
 if p_valid_from<=v_previous.valid_from_competence
 then raise exception 'price must follow latest competence' using errcode='22023';end if;
 if exists(select 1 from public.institutional_payables where organization_id=p_organization_id
    and recurring_rule_id=p_rule_id and competence>=p_valid_from)
  or exists(select 1 from public.institutional_receivables where organization_id=p_organization_id
    and recurring_rule_id=p_rule_id and competence>=p_valid_from)
 then raise exception 'obligations already issued from proposed price date' using errcode='23514';end if;
 update public.institutional_recurring_rule_versions
  set valid_to_competence=(p_valid_from-interval '1 month')::date
  where organization_id=p_organization_id and id=v_previous.id;
 insert into public.institutional_recurring_rule_versions(organization_id,recurring_rule_id,valid_from_competence,amount,notes)
 values(p_organization_id,p_rule_id,p_valid_from,p_amount,btrim(p_reason)) returning id into v_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'institutional_rule.price_schedule','institutional_recurring_rule',p_rule_id,
  jsonb_build_object('version_id',v_previous.id,'amount',v_previous.amount,'to',v_previous.valid_to_competence),
  jsonb_build_object('version_id',v_id,'amount',p_amount,'from',p_valid_from,'previous_to',(p_valid_from-interval '1 month')::date),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.schedule_institutional_recurring_price(uuid,uuid,uuid,numeric,date,text,text) from public,anon,authenticated;
grant execute on function public.schedule_institutional_recurring_price(uuid,uuid,uuid,numeric,date,text,text) to authenticated;

create or replace function public.create_tenant_institutional_annual_rule(
 p_organization_id uuid,p_direction text,p_category_id uuid,p_name text,
 p_counterparty text,p_amount numeric,p_valid_from date,p_due_day integer,
 p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_today date;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_direction is null or p_direction not in('payable','receivable')
  or p_category_id is null or p_name is null or length(btrim(p_name)) not between 3 and 120
  or p_counterparty is null or length(btrim(p_counterparty)) not between 1 and 120
  or p_amount is null or p_amount::text in('NaN','Infinity','-Infinity')
  or p_amount<=0 or p_amount>999999999999.99 or p_amount<>round(p_amount,2)
  or p_valid_from is null or not isfinite(p_valid_from) or extract(day from p_valid_from)<>1
  or p_valid_from<date_trunc('month',v_today)::date
  or p_valid_from>=(date_trunc('month',v_today)+interval '13 months')::date
  or p_due_day is null or p_due_day not between 1 and 31
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid institutional annual rule' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_tenant_institutional_annual_rule',btrim(p_idempotency_key),
  jsonb_build_object('direction',p_direction,'category',p_category_id,'name',btrim(p_name),'counterparty',btrim(p_counterparty),
   'amount',p_amount,'from',p_valid_from,'due_day',p_due_day,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 perform id from public.organizations where id=p_organization_id for no key update;
 perform id from public.financial_categories where organization_id=p_organization_id and id=p_category_id and active
  and domain=case when p_direction='payable' then 'institutional_expense' else 'institutional_revenue' end for share;
 if not found then raise exception 'institutional category not eligible in tenant' using errcode='23503';end if;
 insert into public.institutional_recurring_rules(organization_id,direction,category_id,name,counterparty_name,frequency,due_day,created_by)
 values(p_organization_id,p_direction,p_category_id,btrim(p_name),btrim(p_counterparty),'annual',p_due_day,auth.uid()) returning id into v_id;
 insert into public.institutional_recurring_rule_versions(organization_id,recurring_rule_id,valid_from_competence,amount,notes)
 values(p_organization_id,v_id,p_valid_from,p_amount,btrim(p_reason));
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'institutional_rule.create','institutional_recurring_rule',v_id,
  jsonb_build_object('direction',p_direction,'category',p_category_id,'amount',p_amount,'from',p_valid_from),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.create_tenant_institutional_annual_rule(uuid,text,uuid,text,text,numeric,date,integer,text,text) from public,anon,authenticated;
grant execute on function public.create_tenant_institutional_annual_rule(uuid,text,uuid,text,text,numeric,date,integer,text,text) to authenticated;

create or replace function public.preview_institutional_annual_generation(p_organization_id uuid,p_rule_id uuid,p_competence date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_rule public.institutional_recurring_rules%rowtype;v_version public.institutional_recurring_rule_versions%rowtype;
 v_category public.financial_categories%rowtype;v_mapping record;v_policy record;
 v_existing uuid;v_due date;v_snapshot jsonb;v_ready boolean;v_anchor integer;v_today date;
begin
 perform private.require_permission(p_organization_id,'institutional.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_rule_id is null or p_competence is null or not isfinite(p_competence) or extract(day from p_competence)<>1
  or p_competence<(date_trunc('month',v_today)-interval '12 months')::date
  or p_competence>=(date_trunc('month',v_today)+interval '13 months')::date
 then raise exception 'institutional competence out of range' using errcode='22023';end if;
 select * into v_rule from public.institutional_recurring_rules where organization_id=p_organization_id and id=p_rule_id;
 if not found then raise exception 'institutional rule not found in tenant' using errcode='23503';end if;
 select extract(month from min(valid_from_competence))::integer into v_anchor from public.institutional_recurring_rule_versions where organization_id=p_organization_id and recurring_rule_id=p_rule_id;
 select * into v_version from public.institutional_recurring_rule_versions where organization_id=p_organization_id
  and recurring_rule_id=p_rule_id and valid_from_competence<=p_competence
  and (valid_to_competence is null or valid_to_competence>=p_competence);
 select * into v_category from public.financial_categories where organization_id=p_organization_id and id=v_rule.category_id;
 select * into v_mapping from private.resolve_category_account(p_organization_id,v_rule.category_id,p_competence);
 select * into v_policy from private.current_expense_approval_policy(p_organization_id,p_competence);
 v_due:=make_date(extract(year from p_competence)::integer,extract(month from p_competence)::integer,
  least(v_rule.due_day,extract(day from(p_competence+interval '1 month - 1 day'))::integer));
 if v_rule.direction='payable' then
  select id into v_existing from public.institutional_payables where organization_id=p_organization_id
   and generation_key='institutional-annual:'||p_rule_id::text||':'||p_competence::text;
 else
  select id into v_existing from public.institutional_receivables where organization_id=p_organization_id
   and generation_key='institutional-annual:'||p_rule_id::text||':'||p_competence::text;
 end if;
 v_snapshot:=jsonb_build_object('organization_id',p_organization_id,'rule_id',p_rule_id,'competence',p_competence,
  'name',v_rule.name,'direction',v_rule.direction,'active',v_rule.active,'frequency',v_rule.frequency,'annual_month',v_anchor,
  'counterparty',v_rule.counterparty_name,'category_id',v_rule.category_id,'category_active',v_category.active,
  'category_domain',v_category.domain,'version_id',v_version.id,'amount',v_version.amount,'due_date',v_due,
  'accounting_plan_id',v_mapping.accounting_plan_id,'accounting_account_id',v_mapping.accounting_account_id,
  'approval_policy_id',case when v_rule.direction='payable' then v_policy.policy_id end,
  'period_closed',private.is_period_closed(p_organization_id,p_competence),'existing_id',v_existing);
 v_ready:=v_rule.active and v_rule.frequency='annual' and extract(month from p_competence)::integer=v_anchor and coalesce(v_category.active,false)
  and v_category.domain=case when v_rule.direction='payable' then 'institutional_expense' else 'institutional_revenue' end
  and v_version.id is not null and v_version.amount::text not in('NaN','Infinity','-Infinity')
  and v_version.amount>0 and v_version.amount<=999999999999.99 and v_mapping.accounting_account_id is not null
  and not private.is_period_closed(p_organization_id,p_competence) and v_existing is null;
 return v_snapshot||jsonb_build_object('ready',coalesce(v_ready,false),
  'fingerprint',encode(extensions.digest(v_snapshot::text,'sha256'),'hex'));
end $$;
revoke all on function public.preview_institutional_annual_generation(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.preview_institutional_annual_generation(uuid,uuid,date) to authenticated;

-- 9. Planos de contas, guardas de publicação e políticas de aprovação
create or replace function public.create_tenant_accounting_draft(p_organization_id uuid, p_name text, p_valid_from date, p_valid_to date, p_source_kind text, p_source_id uuid, p_reason text, p_idempotency_key text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_result uuid; v_today date;
begin
 perform private.require_permission(p_organization_id,'accounting.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_name is null or length(btrim(p_name)) not between 3 and 120
    or p_valid_from is null or p_valid_to is null
    or p_valid_from<=date_trunc('month',v_today)::date
    or extract(day from p_valid_from)<>1
    or p_valid_to < p_valid_from
    or p_valid_to<>(date_trunc('month',p_valid_to)+interval '1 month - 1 day')::date
    or p_source_kind is null or p_source_kind not in ('blank','template','duplicate')
    or (p_source_kind='blank' and p_source_id is not null)
    or (p_source_kind<>'blank' and p_source_id is null)
    or p_reason is null or length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid future accounting draft request' using errcode='22023'; end if;
 v_result:=private.idempotency_begin(p_organization_id,'create_tenant_accounting_draft',p_idempotency_key,
    jsonb_build_object('name',btrim(p_name),'from',p_valid_from,'to',p_valid_to,
      'source_kind',p_source_kind,'source_id',p_source_id,'reason',btrim(p_reason)));
 if v_result is not null then return v_result;end if;
 v_result:=public.create_accounting_plan(p_organization_id,btrim(p_name),
    p_valid_from,p_valid_to,p_source_kind,p_source_id);
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'accounting_plan.draft_request','accounting_plan',v_result,
   jsonb_build_object('source_kind',p_source_kind,'source_id',p_source_id),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_result);
 return v_result;
end $function$;
revoke all on function public.create_tenant_accounting_draft(uuid,text,date,date,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_tenant_accounting_draft(uuid,text,date,date,text,uuid,text,text) to authenticated;

create or replace function public.preview_accounting_plan_publication(p_organization_id uuid, p_plan_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_plan public.accounting_plans%rowtype;
  v_accounts integer;
  v_analytic integer;
  v_category_total integer;
  v_cash_total integer;
  v_missing_categories integer;
  v_missing_cash integer;
  v_invalid_category integer;
  v_invalid_cash integer;
  v_bad_hierarchy integer;
  v_cycles integer;
  v_overlap integer;
  v_issues jsonb := '[]'::jsonb;
  v_today date;
begin
  perform private.require_permission(p_organization_id,'accounting.manage');

  if p_plan_id is null then
    raise exception 'accounting plan is required' using errcode='22023';
  end if;

  v_today := private.tenant_current_date(p_organization_id);

  select * into v_plan
  from public.accounting_plans p
  where p.organization_id=p_organization_id and p.id=p_plan_id;

  if not found then
    raise exception 'accounting plan outside organization' using errcode='23503';
  end if;

  select count(*),count(*) filter (where row_type='analytic' and active)
    into v_accounts,v_analytic
  from public.accounting_accounts
  where organization_id=p_organization_id and accounting_plan_id=p_plan_id;

  select count(*) into v_bad_hierarchy
  from public.accounting_accounts child
  join public.accounting_accounts parent
    on parent.organization_id=child.organization_id
    and parent.accounting_plan_id=child.accounting_plan_id
    and parent.id=child.parent_account_id
  where child.organization_id=p_organization_id
    and child.accounting_plan_id=p_plan_id
    and (parent.row_type='analytic' or parent.nature<>child.nature);

  with recursive ancestry as (
    select a.id root_id,a.parent_account_id,a.id as current_id,
      array[a.id] path,false is_cycle
    from public.accounting_accounts a
    where a.organization_id=p_organization_id and a.accounting_plan_id=p_plan_id
    union all
    select ancestry.root_id,parent.parent_account_id,parent.id,
      ancestry.path||parent.id,parent.id=any(ancestry.path)
    from ancestry
    join public.accounting_accounts parent
      on parent.organization_id=p_organization_id
     and parent.accounting_plan_id=p_plan_id
     and parent.id=ancestry.parent_account_id
    where not ancestry.is_cycle
  )
  select count(distinct root_id) filter (where is_cycle) into v_cycles from ancestry;

  select count(*),
    count(*) filter (where not exists(
      select 1 from public.financial_category_account_mappings m
      where m.organization_id=c.organization_id and m.accounting_plan_id=p_plan_id
        and m.category_id=c.id
    ))
  into v_category_total,v_missing_categories
  from public.financial_categories c
  where c.organization_id=p_organization_id and c.active;

  select count(*),
    count(*) filter (where not exists(
      select 1 from public.financial_account_accounting_mappings m
      where m.organization_id=a.organization_id and m.accounting_plan_id=p_plan_id
        and m.financial_account_id=a.id
    ))
  into v_cash_total,v_missing_cash
  from public.financial_accounts a
  where a.organization_id=p_organization_id and a.active;

  select count(*) into v_invalid_category
  from public.financial_category_account_mappings m
  join public.financial_categories c
    on c.organization_id=m.organization_id and c.id=m.category_id
  join public.accounting_accounts a
    on a.organization_id=m.organization_id and a.accounting_plan_id=m.accounting_plan_id
    and a.id=m.accounting_account_id
  where m.organization_id=p_organization_id and m.accounting_plan_id=p_plan_id
    and (not a.active or a.row_type<>'analytic'
      or (c.domain in ('member_receivable','institutional_revenue') and a.nature<>'revenue')
      or (c.domain='institutional_expense' and a.nature not in ('cost','expense','financial_result'))
      or c.domain not in ('member_receivable','institutional_revenue','institutional_expense'));

  select count(*) into v_invalid_cash
  from public.financial_account_accounting_mappings m
  join public.accounting_accounts a
    on a.organization_id=m.organization_id and a.accounting_plan_id=m.accounting_plan_id
    and a.id=m.accounting_account_id
  where m.organization_id=p_organization_id and m.accounting_plan_id=p_plan_id
    and (not a.active or a.row_type<>'analytic' or a.nature<>'patrimonial');

  select count(*) into v_overlap
  from public.accounting_plans other
  where other.organization_id=p_organization_id and other.id<>p_plan_id
    and other.status='published'
    and other.valid_from<=v_plan.valid_to and other.valid_to>=v_plan.valid_from;

  if v_plan.status<>'draft' then
    v_issues:=v_issues||'["not_draft"]'::jsonb;
  end if;
  if v_plan.valid_from<=date_trunc('month',v_today)::date then
    v_issues:=v_issues||'["nonfuture_start"]'::jsonb;
  end if;
  if v_overlap>0 then v_issues:=v_issues||'["published_overlap"]'::jsonb; end if;
  if v_accounts=0 then v_issues:=v_issues||'["empty_chart"]'::jsonb; end if;
  if v_analytic=0 then v_issues:=v_issues||'["no_active_analytic"]'::jsonb; end if;
  if v_bad_hierarchy>0 then v_issues:=v_issues||'["invalid_hierarchy"]'::jsonb; end if;
  if v_cycles>0 then v_issues:=v_issues||'["hierarchy_cycle"]'::jsonb; end if;
  if v_missing_categories>0 then v_issues:=v_issues||'["categories_unmapped"]'::jsonb; end if;
  if v_missing_cash>0 then v_issues:=v_issues||'["cash_accounts_unmapped"]'::jsonb; end if;
  if v_invalid_category>0 then v_issues:=v_issues||'["invalid_category_mappings"]'::jsonb; end if;
  if v_invalid_cash>0 then v_issues:=v_issues||'["invalid_cash_mappings"]'::jsonb; end if;

  return jsonb_build_object(
    'plan_id',v_plan.id,'status',v_plan.status,
    'ready',jsonb_array_length(v_issues)=0,
    'issues',v_issues,
    'account_count',v_accounts,
    'analytic_account_count',v_analytic,
    'active_category_count',v_category_total,
    'missing_category_count',v_missing_categories,
    'active_financial_account_count',v_cash_total,
    'missing_financial_account_count',v_missing_cash,
    'invalid_category_mapping_count',v_invalid_category,
    'invalid_financial_mapping_count',v_invalid_cash,
    'invalid_hierarchy_count',v_bad_hierarchy,
    'hierarchy_cycle_count',v_cycles,
    'overlapping_published_plan_count',v_overlap,
    'checked_at',clock_timestamp()
  );
end;
$function$;
revoke all on function public.preview_accounting_plan_publication(uuid,uuid) from public,anon,authenticated;
grant execute on function public.preview_accounting_plan_publication(uuid,uuid) to authenticated;

create or replace function private.guard_tenant_accounting_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_need_check boolean := false; v_today date;
begin
 if tg_op='INSERT' then v_org:=new.organization_id;
 else v_org:=old.organization_id; end if;
 if tg_op='UPDATE' and new.organization_id is distinct from old.organization_id then
   raise exception 'accounting tenant cannot change' using errcode='23514';
 end if;
 perform 1 from public.organizations where id=v_org for update;
 if not found then raise exception 'accounting organization not found' using errcode='23503';end if;
 v_today := private.tenant_current_date(v_org);

 if tg_op<>'DELETE' and tg_table_name in
   ('accounting_accounts','financial_category_account_mappings',
    'financial_account_accounting_mappings') then
   if exists(select 1 from public.accounting_plans p
     where p.organization_id=v_org and p.id=new.accounting_plan_id and p.status='published') then
     raise exception 'published accounting structure cannot be modified' using errcode='55000';
   end if;
 end if;

 if tg_op<>'DELETE' and tg_table_name='financial_categories' then
   v_need_check := tg_op='INSERT';
   if tg_op='UPDATE' then
     v_need_check := old.active is distinct from true or old.domain is distinct from new.domain;
   end if;
   if new.active and v_need_check and exists(
    select 1 from public.accounting_plans p
     where p.organization_id=v_org and p.status='published'
       and p.valid_to>=date_trunc('month',v_today)::date
       and not exists(
         select 1 from public.financial_category_account_mappings m
          join public.accounting_accounts a
           on a.organization_id=m.organization_id
          and a.accounting_plan_id=m.accounting_plan_id
          and a.id=m.accounting_account_id
          where m.organization_id=v_org and m.accounting_plan_id=p.id
          and m.category_id=new.id and a.active and a.row_type='analytic'
          and ((new.domain in ('member_receivable','institutional_revenue') and a.nature='revenue')
            or (new.domain='institutional_expense' and a.nature in ('cost','expense','financial_result')))
       )
   ) then
     raise exception 'category cannot be active without coverage in every applicable published plan; create a successor'
       using errcode='23514';
   end if;
 end if;

 if tg_op<>'DELETE' and tg_table_name='financial_accounts' then
   v_need_check := tg_op='INSERT';
   if tg_op='UPDATE' then v_need_check := old.active is distinct from true;end if;
   if new.active and v_need_check and exists(
     select 1 from public.accounting_plans p
     where p.organization_id=v_org and p.status='published'
       and p.valid_to>=date_trunc('month',v_today)::date
       and not exists(
         select 1 from public.financial_account_accounting_mappings m
          join public.accounting_accounts a
           on a.organization_id=m.organization_id
          and a.accounting_plan_id=m.accounting_plan_id
          and a.id=m.accounting_account_id
          where m.organization_id=v_org and m.accounting_plan_id=p.id
           and m.financial_account_id=new.id
           and a.active and a.row_type='analytic' and a.nature='patrimonial'
       )
   ) then
     raise exception 'financial account cannot be active without coverage in every applicable published plan; create a successor'
       using errcode='23514';
   end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $$;
revoke all on function private.guard_tenant_accounting_change() from public,anon,authenticated;

create or replace function public.create_tenant_approval_policy_draft(
 p_organization_id uuid,p_name text,p_mode text,p_threshold_amount numeric,
 p_minimum_approvers integer,p_valid_from date,p_valid_to date,
 p_reason text,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_today date;
begin
 perform private.require_permission(p_organization_id,'approvals.manage');
 v_today := private.tenant_current_date(p_organization_id);
 if p_name is null or length(btrim(p_name)) not between 3 and 120
  or p_mode not in ('off','all','threshold')
  or (p_mode='threshold' and (p_threshold_amount is null or p_threshold_amount::text in ('NaN','Infinity','-Infinity') or
    p_threshold_amount<0 or p_threshold_amount>999999999999.99 or p_threshold_amount<>round(p_threshold_amount,2)))
  or (p_mode<>'threshold' and p_threshold_amount is not null)
  or p_minimum_approvers is null or p_minimum_approvers not between 1 and 10
  or p_valid_from is null or p_valid_to is null or p_valid_to<p_valid_from
  or p_valid_from<=v_today
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200
 then raise exception 'invalid approval policy draft request' using errcode='22023';end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_tenant_approval_policy_draft',btrim(p_idempotency_key),
  jsonb_build_object('name',btrim(p_name),'mode',p_mode,'threshold',p_threshold_amount,
   'approvers',p_minimum_approvers,'from',p_valid_from,'to',p_valid_to,'reason',btrim(p_reason)));
 if v_id is not null then return v_id;end if;
 if exists(select 1 from public.expense_approval_policies
  where organization_id=p_organization_id and status='published'
  and daterange(valid_from,valid_to+1,'[)')&&daterange(p_valid_from,p_valid_to+1,'[)'))
 then raise exception 'new policy overlaps published policy' using errcode='23514';end if;
 insert into public.expense_approval_policies(
  organization_id,name,mode,threshold_amount,minimum_approvers,
  status,valid_from,valid_to,created_by)
 values(p_organization_id,btrim(p_name),p_mode,p_threshold_amount,p_minimum_approvers,
  'draft',p_valid_from,p_valid_to,auth.uid()) returning id into v_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'approval_policy.draft_create','expense_approval_policy',v_id,
  jsonb_build_object('name',btrim(p_name),'mode',p_mode,'threshold',p_threshold_amount,
   'minimum_approvers',p_minimum_approvers,'from',p_valid_from,'to',p_valid_to),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,btrim(p_idempotency_key),v_id);
 return v_id;
end $$;
revoke all on function public.create_tenant_approval_policy_draft(uuid,text,text,numeric,integer,date,date,text,text) from public,anon,authenticated;
grant execute on function public.create_tenant_approval_policy_draft(uuid,text,text,numeric,integer,date,date,text,text) to authenticated;

-- 10. Eventos Ágape e Lotes de Mútua por Loja
create or replace function public.preview_agape_event(
 p_organization_id uuid,p_category_id uuid,p_name text,p_event_date date,
 p_due_date date,p_default_amount numeric,p_member_ids uuid[]
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_members jsonb;v_count integer;v_mapping record;v_snapshot jsonb;v_existing uuid;v_period date;v_today date;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 perform private.require_permission(p_organization_id,'members.read');
 v_today := private.tenant_current_date(p_organization_id);
 if p_category_id is null or p_name is null or length(btrim(p_name)) not between 3 and 120
  or p_event_date is null or not isfinite(p_event_date)
  or p_event_date<(date_trunc('month',v_today)-interval '12 months')::date
  or p_event_date>=(date_trunc('month',v_today)+interval '13 months')::date
  or p_due_date is null or not isfinite(p_due_date) or p_due_date<p_event_date or p_due_date>(p_event_date+interval '12 months')::date
  or p_default_amount is null or p_default_amount::text in('NaN','Infinity','-Infinity')
  or p_default_amount<0 or p_default_amount>999999999999.99 or p_default_amount<>round(p_default_amount,2)
  or p_member_ids is null or cardinality(p_member_ids) not between 1 and 200 or array_position(p_member_ids,null) is not null
  or (select count(distinct x) from unnest(p_member_ids)x)<>cardinality(p_member_ids)
  or p_default_amount*cardinality(p_member_ids)>999999999999.99
 then raise exception 'invalid agape event request' using errcode='22023';end if;
 perform id from public.financial_categories where organization_id=p_organization_id and id=p_category_id and domain='member_receivable' and active;
 if not found then raise exception 'event category not eligible in tenant' using errcode='23503';end if;
 select count(*),jsonb_agg(jsonb_build_object('member_id',id,'name',full_name,'amount',p_default_amount) order by id)
 into v_count,v_members from public.members where organization_id=p_organization_id and id=any(p_member_ids) and status='active';
 if v_count<>cardinality(p_member_ids) then raise exception 'event member absent or inactive in tenant' using errcode='23503';end if;
 v_period:=date_trunc('month',p_event_date)::date;
 if private.is_period_closed(p_organization_id,v_period) then raise exception 'event accounting period closed' using errcode='55000';end if;
 select * into v_mapping from private.resolve_category_account(p_organization_id,p_category_id,p_event_date);
 if not found then raise exception 'event category requires published accounting mapping' using errcode='23514';end if;
 select id into v_existing from public.events where organization_id=p_organization_id and event_type='agape'
  and event_date=p_event_date and lower(btrim(name))=lower(btrim(p_name)) order by id limit 1;
 v_snapshot:=jsonb_build_object('organization_id',p_organization_id,'category_id',p_category_id,'name',btrim(p_name),
  'event_date',p_event_date,'due_date',p_due_date,'competence',v_period,'default_amount',p_default_amount,
  'participants',v_members,'participant_count',v_count,'charge_count',case when p_default_amount>0 then v_count else 0 end,
  'total_amount',p_default_amount*v_count,'plan_id',v_mapping.accounting_plan_id,'account_id',v_mapping.accounting_account_id,
  'existing_id',v_existing,'ready',v_existing is null);
 return v_snapshot||jsonb_build_object('fingerprint',encode(extensions.digest(v_snapshot::text,'sha256'),'hex'));
end $$;
revoke all on function public.preview_agape_event(uuid,uuid,text,date,date,numeric,uuid[]) from public,anon,authenticated;
grant execute on function public.preview_agape_event(uuid,uuid,text,date,date,numeric,uuid[]) to authenticated;

create or replace function private.validate_mutual_batch_input(
 p_category_id uuid,p_number_start integer,p_number_end integer,p_unit_amount numeric,
 p_competence date,p_issue_date date,p_due_date date,p_assignments jsonb
) returns void language plpgsql stable set search_path='' as $$
declare v_brt_today date := (pg_catalog.clock_timestamp() at time zone 'America/Sao_Paulo')::date;
begin
 if p_category_id is null or p_number_start is null or p_number_end is null
  or p_number_start<1 or p_number_end<p_number_start or p_number_end::bigint-p_number_start::bigint+1>200
  or p_unit_amount is null or p_unit_amount::text in('NaN','Infinity','-Infinity')
  or p_unit_amount<=0 or p_unit_amount>999999999999.99 or p_unit_amount<>round(p_unit_amount,2)
  or p_unit_amount*(p_number_end::bigint-p_number_start::bigint+1)>999999999999.99
  or p_competence is null or not isfinite(p_competence) or extract(day from p_competence)<>1
  or p_competence<(date_trunc('month',v_brt_today - interval '1 day')-interval '12 months')::date
  or p_competence>=(date_trunc('month',v_brt_today + interval '1 day')+interval '13 months')::date
  or p_issue_date is null or not isfinite(p_issue_date) or date_trunc('month',p_issue_date)::date<>p_competence
  or p_due_date is null or not isfinite(p_due_date) or p_due_date<p_issue_date or p_due_date>(p_issue_date+interval '12 months')::date
  or p_assignments is null or jsonb_typeof(p_assignments)<>'array'
 then raise exception 'invalid mutual batch parameters' using errcode='22023';end if;
 if jsonb_array_length(p_assignments)<>p_number_end::bigint-p_number_start::bigint+1
  or exists(select 1 from jsonb_array_elements(p_assignments)x where jsonb_typeof(x)<>'object'
   or not coalesce(x->>'mutual_number'~'^[1-9][0-9]{0,9}$',false)
   or not coalesce(x->>'member_id'~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',false))
 then raise exception 'every mutual number requires an explicit member' using errcode='22023';end if;
 if (select count(distinct x->>'mutual_number') from jsonb_array_elements(p_assignments)x)<>jsonb_array_length(p_assignments)
  or exists(select 1 from jsonb_array_elements(p_assignments)x where (x->>'mutual_number')::numeric<p_number_start or (x->>'mutual_number')::numeric>p_number_end)
 then raise exception 'mutual numbers must uniquely cover requested range' using errcode='22023';end if;
end $$;
revoke all on function private.validate_mutual_batch_input(uuid,integer,integer,numeric,date,date,date,jsonb) from public,anon,authenticated;

create or replace function public.preview_mutual_batch(
 p_organization_id uuid,p_category_id uuid,p_number_start integer,p_number_end integer,p_unit_amount numeric,
 p_competence date,p_issue_date date,p_due_date date,p_assignments jsonb
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;v_count integer;v_mapping record;v_existing uuid;v_snapshot jsonb;v_nature text;v_code text;v_today date;
begin
 perform private.require_permission(p_organization_id,'charges.create');
 perform private.require_permission(p_organization_id,'members.read');
 v_today := private.tenant_current_date(p_organization_id);
 perform private.validate_mutual_batch_input(p_category_id,p_number_start,p_number_end,p_unit_amount,p_competence,p_issue_date,p_due_date,p_assignments);
 if p_competence<(date_trunc('month',v_today)-interval '12 months')::date
  or p_competence>=(date_trunc('month',v_today)+interval '13 months')::date
 then raise exception 'invalid mutual batch parameters' using errcode='22023';end if;
 perform id from public.financial_categories where organization_id=p_organization_id and id=p_category_id and active and domain='member_receivable';
 if not found then raise exception 'mutual category not eligible in tenant' using errcode='23503';end if;
 select count(*),jsonb_agg(jsonb_build_object('mutual_number',a.mutual_number,'member_id',m.id,'name',m.full_name,'amount',p_unit_amount) order by a.mutual_number)
 into v_count,v_rows from jsonb_to_recordset(p_assignments)a(mutual_number integer,member_id uuid)
 join public.members m on m.organization_id=p_organization_id and m.id=a.member_id and m.status='active';
 if v_count<>jsonb_array_length(p_assignments) then raise exception 'mutual assignee absent or inactive in tenant' using errcode='23503';end if;
 if private.is_period_closed(p_organization_id,p_competence) then raise exception 'mutual accounting period closed' using errcode='55000';end if;
 select * into v_mapping from private.resolve_category_account(p_organization_id,p_category_id,p_competence);
 if not found then raise exception 'mutual category requires published classification' using errcode='23514';end if;
 select nature,code into strict v_nature,v_code from public.accounting_accounts where organization_id=p_organization_id
  and accounting_plan_id=v_mapping.accounting_plan_id and id=v_mapping.accounting_account_id;
 select id into v_existing from public.mutual_batches where organization_id=p_organization_id and competence=p_competence
  and number_start<=p_number_end and number_end>=p_number_start order by id limit 1;
 v_snapshot:=jsonb_build_object('organization_id',p_organization_id,'category_id',p_category_id,'number_start',p_number_start,'number_end',p_number_end,
  'unit_amount',p_unit_amount,'competence',p_competence,'issue_date',p_issue_date,'due_date',p_due_date,'assignments',v_rows,'charge_count',v_count,
  'total_amount',p_unit_amount*v_count,'plan_id',v_mapping.accounting_plan_id,'account_id',v_mapping.accounting_account_id,
  'account_nature',v_nature,'account_code',v_code,'existing_batch_id',v_existing,'ready',v_existing is null);
 return v_snapshot||jsonb_build_object('fingerprint',encode(extensions.digest(v_snapshot::text,'sha256'),'hex'));
end $$;
revoke all on function public.preview_mutual_batch(uuid,uuid,integer,integer,numeric,date,date,date,jsonb) from public,anon,authenticated;
grant execute on function public.preview_mutual_batch(uuid,uuid,integer,integer,numeric,date,date,date,jsonb) to authenticated;
