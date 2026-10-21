-- DEV fictitious UI agreement cleanup only. Change qa_label to B only after its UI test.
-- ROLLBACK by default; no DELETE and no payment/financial account mutation.
begin;
set local corsys.qa_label='A';
do $$
declare t record;original uuid;agreement uuid;x record;targets uuid[];v_tag text;
begin
 if current_date<>'2026-10-21'::date then raise exception 'fixture date review required';end if;
 for t in select * from(values
 ('A','94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'df01dcfa-707c-4861-a9fb-719e7ec21f65'::uuid),
 ('B','7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'0bef3ce2-f77a-4e29-85f6-37e737630d1d'::uuid)
 )f(label,org,actor,category) where label=current_setting('corsys.qa_label') loop
  v_tag:='DEV QA AGREEMENT UI '||t.label||' 20261021';
  if not exists(select 1 from public.organizations where id=t.org and name='DEV QA FINANCE '||t.label||' 20261015')then raise exception 'unexpected fixture';end if;
  select id into strict original from public.charges where organization_id=t.org and description=v_tag and original_amount=3;
  select agreement_id into strict agreement from public.member_debt_agreement_items where organization_id=t.org and original_charge_id=original;
  if (select count(*) from public.member_debt_agreement_installments where organization_id=t.org and agreement_id=agreement)<>3
   or (select sum(amount) from public.member_debt_agreement_installments where organization_id=t.org and agreement_id=agreement)<>2.5
   or (select count(*) from public.audit_logs where organization_id=t.org and entity_id=agreement and action='member_agreement.create')<>1
  then raise exception 'UI agreement scope or audit mismatch';end if;
  targets:=array[original]||(select array_agg(charge_id order by installment_number) from public.member_debt_agreement_installments where organization_id=t.org and agreement_id=agreement);
  if exists(select 1 from public.v_charge_balances where organization_id=t.org and charge_id=any(targets) and (allocated_amount<>0 or not integrity_ok))then raise exception 'cleanup must not alter payment allocations';end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  for x in select charge_id from public.v_charge_balances where organization_id=t.org and charge_id=any(targets) and not is_cancelled loop
   perform public.cancel_member_charge_idempotent(t.org,x.charge_id,'2026-10-01','DEV QA visual agreement cleanup 20261021',gen_random_uuid()::text);
  end loop;
  execute 'reset role';
  if (select count(*) from public.v_charge_balances where organization_id=t.org and charge_id=any(targets) and is_cancelled and open_amount=0 and integrity_ok)<>4
   or (select sum(balance) from public.v_financial_account_balances where organization_id=t.org)<>10
  then raise exception 'UI cleanup or cash invariant';end if;
  if exists(select 1 from public.financial_categories where organization_id=t.org and id=t.category and allow_installments)then
   update public.financial_categories set allow_installments=false where organization_id=t.org and id=t.category;
   insert into public.audit_logs(organization_id,action,entity_type,entity_id,before_data,after_data,reason)
   values(t.org,'dev_qa.agreement_cleanup','financial_category',t.category,'{"allow_installments":true}','{"allow_installments":false}','Restore original fictitious DEV QA installment setting');
  end if;
 end loop;
end $$;
rollback;
select 'DEV_AGREEMENT_UI_CLEANUP_DRYRUN_PASS' result;
