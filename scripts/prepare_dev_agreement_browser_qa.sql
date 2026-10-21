-- DEV fictitious QA A/B only. Dry-run ROLLBACK by default.
-- Temporarily enable installments on the two QA categories, then seed one R$3 UI debt.
-- Restore allow_installments=false and cancel only these new debts/installments after QA.
begin;
do $$
declare t record;v_id uuid;v_tag text;
begin
 if current_date<>'2026-10-21'::date then raise exception 'fixture date review required';end if;
 for t in select * from(values
 ('A','94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'d5842ad6-913d-4a3e-8250-876fb2e2a215'::uuid,'df01dcfa-707c-4861-a9fb-719e7ec21f65'::uuid),
 ('B','7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'23bdcd76-b7a2-47b5-9f65-267d4c1053be'::uuid,'0bef3ce2-f77a-4e29-85f6-37e737630d1d'::uuid)
 )f(label,org,actor,member,category) loop
  v_tag:='DEV QA AGREEMENT UI '||t.label||' 20261021';
  if not exists(select 1 from public.organizations where id=t.org and name='DEV QA FINANCE '||t.label||' 20261015')
   or not exists(select 1 from public.financial_categories where organization_id=t.org and id=t.category and active and domain='member_receivable' and not allow_installments)
   or exists(select 1 from public.charges where organization_id=t.org and description=v_tag)
  then raise exception 'unexpected or already prepared fixture';end if;
  update public.financial_categories set allow_installments=true where organization_id=t.org and id=t.category;
  insert into public.audit_logs(organization_id,action,entity_type,entity_id,before_data,after_data,reason)
  values(t.org,'dev_qa.agreement_prepare','financial_category',t.category,'{"allow_installments":false}','{"allow_installments":true}','Temporary fictitious DEV QA installment test; restore false after QA');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  v_id:=public.create_manual_charge(t.org,t.member,t.category,v_tag,'2026-10-01',current_date,'2026-10-22','2026-10-01',3,v_tag,v_tag);
  execute 'reset role';
 end loop;
end $$;
rollback;
select 'DEV_AGREEMENT_BROWSER_PREPARED_DRYRUN_PASS' result;
