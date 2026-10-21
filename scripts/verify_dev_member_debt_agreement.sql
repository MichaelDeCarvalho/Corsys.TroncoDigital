-- Fictitious DEV A/B only. New debts, agreements and metadata changes all roll back.
begin;
do $$
declare t record;cat uuid;m uuid;c1 uuid;c2 uuid;v jsonb;agreement uuid;k text;
 checks integer:=0;cash_before numeric;viewer uuid;method uuid;account uuid;payment uuid;allocation uuid;cash_paid numeric;dre_before numeric;
begin
 for t in select * from(values
 ('94b84958-4dd9-435d-9a4e-244220835d70'::uuid,'a752dda8-4ef0-4c58-9d3b-b8fee14ec624'::uuid,'7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid),
 ('7a6aa771-524d-4d5a-9d38-7006175e1cb4'::uuid,'559ba052-c408-4418-b806-0c0c4b8e3603'::uuid,'94b84958-4dd9-435d-9a4e-244220835d70'::uuid)
 )f(org,actor,other) loop
  if not exists(select 1 from public.organizations where id=t.org and name like 'DEV QA FINANCE % 20261015')then raise exception 'unexpected fixture';end if;
  select coalesce(sum(balance),0) into cash_before from public.v_financial_account_balances where organization_id=t.org;
  select id into strict cat from public.financial_categories where organization_id=t.org and domain='member_receivable' and active;
  select id into m from public.members where organization_id=t.org and status='active' order by id limit 1;
  update public.financial_categories set allow_installments=true where organization_id=t.org and id=cat;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',t.actor,'role','authenticated','aal','aal1')::text,true);
  execute 'set local role authenticated';
  c1:=public.create_manual_charge(t.org,m,cat,'DEV QA agreement original 1','2026-10-01','2026-10-01','2026-10-10','2026-10-01',10,null,gen_random_uuid()::text);
  c2:=public.create_manual_charge(t.org,m,cat,'DEV QA agreement original 2','2026-10-01','2026-10-01','2026-10-10','2026-10-01',5,null,gen_random_uuid()::text);
  select coalesce(sum(signed_amount),0) into dre_before from public.read_tenant_dre(t.org,'2026-10-01','2026-10-01');
  v:=public.preview_member_debt_agreement(t.org,m,array[c1,c2],10,3,'2026-10-19','2027-01-31');
  if (v->>'original_amount')::numeric<>15 or (v->'installments'->0->>'amount')::numeric<>3.34
   or v->'installments'->1->>'due_date'<>'2027-02-28' or v->'installments'->2->>'due_date'<>'2027-03-31'
   or (select sum((x->>'amount')::numeric) from jsonb_array_elements(v->'installments')x)<>10
  then raise exception 'installment total/date rounding';end if;
  begin perform public.preview_member_debt_agreement(t.org,m,array[c1,c1],10,3,'2026-10-19','2027-01-31');raise exception 'duplicate accepted';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.preview_member_debt_agreement(t.org,m,array[c1,c2],16,3,'2026-10-19','2027-01-31');raise exception 'increase accepted';exception when check_violation then checks:=checks+1;end;
  begin perform public.preview_member_debt_agreement(t.other,m,array[c1,c2],10,3,'2026-10-19','2027-01-31');raise exception 'foreign scope';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.preview_member_debt_agreement(t.org,m,array[gen_random_uuid()],10,3,'2026-10-19','2027-01-31');raise exception 'foreign ID';exception when foreign_key_violation then checks:=checks+1;end;
  begin perform public.preview_member_debt_agreement(t.org,m,array[c1,c2],0.01,2,'2026-10-19','2027-01-31');raise exception 'zero installment';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.create_member_debt_agreement(t.org,m,array[c1,c2],10,3,'2026-10-19','2027-01-31',repeat('0',64),'DEV QA stale',gen_random_uuid()::text);raise exception 'stale accepted';exception when sqlstate 'PT409' then checks:=checks+1;end;
  begin
   perform public.close_financial_period_idempotent(t.org,'2026-10-01','DEV QA rollback agreement period',gen_random_uuid()::text);
   begin perform public.preview_member_debt_agreement(t.org,m,array[c1,c2],10,3,'2026-10-19','2027-01-31');raise exception 'closed preview';exception when sqlstate '55000' then checks:=checks+1;end;
   begin perform public.create_member_debt_agreement(t.org,m,array[c1,c2],10,3,'2026-10-19','2027-01-31',v->>'fingerprint','DEV QA closed',gen_random_uuid()::text);raise exception 'closed command';exception when sqlstate '55000' then checks:=checks+1;end;
   raise exception using errcode='P1234';
  exception when sqlstate 'P1234' then null;end;
  k:=gen_random_uuid()::text;
  agreement:=public.create_member_debt_agreement(t.org,m,array[c1,c2],10,3,'2026-10-19','2027-01-31',v->>'fingerprint','DEV QA agreement',k);
  if agreement<>public.create_member_debt_agreement(t.org,m,array[c1,c2],10,3,'2026-10-19','2027-01-31',v->>'fingerprint','DEV QA agreement',k)then raise exception 'replay mismatch';end if;
  begin perform public.create_member_debt_agreement(t.org,m,array[c1,c2],11,3,'2026-10-19','2027-01-31',v->>'fingerprint','DEV QA agreement',k);raise exception 'changed payload';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.create_member_debt_agreement(t.org,m,array[c1,c2],10,3,'2026-10-19','2027-01-31',v->>'fingerprint','DEV QA agreement',gen_random_uuid()::text);raise exception 'duplicate agreement';exception when foreign_key_violation then checks:=checks+1;end;
  if (select count(*) from public.member_debt_agreement_items where agreement_id=agreement)<>2
   or (select count(*) from public.member_debt_agreement_installments where agreement_id=agreement)<>3
   or (select sum(amount) from public.member_debt_agreement_installments where agreement_id=agreement)<>10
   or exists(select 1 from public.v_charge_balances where charge_id=any(array[c1,c2]) and (open_amount<>0 or is_cancelled or not integrity_ok))
   or (select count(*) from public.audit_logs where entity_id=agreement and action='member_agreement.create')<>1
   or (select count(*) from public.member_debt_agreement_events where agreement_id=agreement)<>2
  then raise exception 'agreement lineage or balance invariant';end if;
  if (select coalesce(sum(signed_amount),0) from public.read_tenant_dre(t.org,'2026-10-01','2026-10-01'))<>dre_before-5 then raise exception 'DRE must reflect discount only, not double revenue';end if;
  execute 'reset role';
  if (select coalesce(sum(balance),0) from public.v_financial_account_balances where organization_id=t.org)<>cash_before then raise exception 'agreement moved cash';end if;
  -- Category permission is a hard business rule, including after a valid preview.
  update public.financial_categories set allow_installments=false where organization_id=t.org and id=cat;
  execute 'set local role authenticated';
  c1:=public.create_manual_charge(t.org,m,cat,'DEV QA no installments','2026-10-01','2026-10-01','2026-10-10','2026-10-01',10,null,gen_random_uuid()::text);
  begin perform public.preview_member_debt_agreement(t.org,m,array[c1],10,2,'2026-10-19','2027-01-31');raise exception 'flag bypass';exception when check_violation then checks:=checks+1;end;
  v:=public.preview_member_debt_agreement(t.org,m,array[c1],9,1,'2026-10-19','2026-10-20');
  perform public.create_member_debt_agreement(t.org,m,array[c1],9,1,'2026-10-19','2026-10-20',v->>'fingerprint','DEV QA single payment',gen_random_uuid()::text);
  -- Preserve a real allocation on a partially paid original; these are rolled back fixtures.
  c1:=public.create_manual_charge(t.org,m,cat,'DEV QA partially paid original','2026-10-01','2026-10-19','2026-10-20','2026-10-01',10,null,gen_random_uuid()::text);
  begin perform public.preview_member_debt_agreement(t.org,m,array[c1],6,1,'2026-10-18','2026-10-20');raise exception 'debt predates issue';exception when foreign_key_violation then checks:=checks+1;end;
  v:=public.preview_member_debt_agreement(t.org,m,array[c1],6,1,'2026-10-19','2026-10-20');
  select id into method from public.payment_methods where organization_id=t.org and active order by id limit 1;
  select id into account from public.financial_accounts where organization_id=t.org and active order by id limit 1;
  payment:=public.register_payment(t.org,m,'2026-10-19','2026-10-01',3,method,account,'DEV QA partial',null,gen_random_uuid()::text);
  allocation:=public.allocate_payment_to_charge(t.org,payment,c1,3,'2026-10-01',gen_random_uuid()::text);
  begin perform public.create_member_debt_agreement(t.org,m,array[c1],6,1,'2026-10-19','2026-10-20',v->>'fingerprint','DEV QA stale paid',gen_random_uuid()::text);raise exception 'stale paid preview';exception when sqlstate 'PT409' then checks:=checks+1;end;
  select sum(balance) into cash_paid from public.v_financial_account_balances where organization_id=t.org;
  v:=public.preview_member_debt_agreement(t.org,m,array[c1],6,1,'2026-10-19','2026-10-20');
  agreement:=public.create_member_debt_agreement(t.org,m,array[c1],6,1,'2026-10-19','2026-10-20',v->>'fingerprint','DEV QA preserve allocation',gen_random_uuid()::text);
  if not exists(select 1 from public.v_charge_balances where charge_id=c1 and original_amount=10 and effective_amount=3 and allocated_amount=3 and open_amount=0 and integrity_ok and not is_cancelled)
   or exists(select 1 from public.allocation_reversals where allocation_id=allocation)
   or (select sum(balance) from public.v_financial_account_balances where organization_id=t.org)<>cash_paid
   or (select sum(effective_amount) from public.v_charge_balances where charge_id=c1 or charge_id in(select charge_id from public.member_debt_agreement_installments where agreement_id=agreement))<>9
  then raise exception 'partial payment or accrual not preserved';end if;
  perform public.reverse_member_payment_idempotent(t.org,payment,'2026-10-01','DEV QA reversal after agreement',gen_random_uuid()::text);
  if not exists(select 1 from public.v_charge_balances where charge_id=c1 and open_amount=3 and allocated_amount=0 and integrity_ok)
   or (select sum(balance) from public.v_financial_account_balances where organization_id=t.org)<>cash_before
  then raise exception 'lost payment must reopen only former allocation';end if;
  execute 'reset role';
  select id into strict viewer from public.roles where organization_id=t.org and code='VIEWER';
  begin
   update public.user_roles set role_id=viewer where organization_id=t.org and user_id=t.actor;
   execute 'set local role authenticated';
   begin perform public.preview_member_debt_agreement(t.org,m,array[c1],9,1,'2026-10-19','2026-10-20');raise exception 'viewer preview';exception when insufficient_privilege then checks:=checks+1;end;
   begin perform public.create_member_debt_agreement(t.org,m,array[c1],9,1,'2026-10-19','2026-10-20',v->>'fingerprint','DEV QA viewer',gen_random_uuid()::text);raise exception 'viewer command';exception when insufficient_privilege then checks:=checks+1;end;
   execute 'reset role';raise exception using errcode='P1234';
  exception when sqlstate 'P1234' then null;end;
 end loop;
 if checks<>30 then raise exception 'missing negative tests: %',checks;end if;
 if has_function_privilege('anon','public.create_member_debt_agreement(uuid,uuid,uuid[],numeric,integer,date,date,text,text,text)','execute')then raise exception 'anon agreement';end if;
end $$;
rollback;
select 'DEV_MEMBER_DEBT_AGREEMENT_ROLLBACK_PASS' result;
