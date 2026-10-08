-- Catalog creation and future prices only; no posted financial facts are changed.
create function public.create_tenant_financial_category(p_organization_id uuid,p_name text,p_description text,p_domain text,p_active boolean,p_allow_recurrence boolean,p_allow_installments boolean,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_name is null or length(btrim(p_name)) not between 1 and 120 or length(coalesce(p_description,''))>1000
  or p_domain is null or p_domain not in ('member_receivable','institutional_revenue','institutional_expense')
  or p_active is null or p_allow_recurrence is null or p_allow_installments is null
  or (p_allow_recurrence and p_domain<>'member_receivable')
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'invalid category input' using errcode='22023'; end if;
 v_id:=private.idempotency_begin(p_organization_id,'create_tenant_financial_category',p_idempotency_key,jsonb_build_object('name',btrim(p_name),'description',p_description,'domain',p_domain,'active',p_active,'recurrence',p_allow_recurrence,'installments',p_allow_installments,'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':category:'||p_domain||':'||lower(btrim(p_name)),0));
 if exists(select 1 from public.financial_categories where organization_id=p_organization_id and domain=p_domain and lower(btrim(name))=lower(btrim(p_name))) then raise exception 'category name already exists' using errcode='23505'; end if;
 insert into public.financial_categories(organization_id,name,description,domain,active,allow_recurrence,allow_installments)
 values(p_organization_id,btrim(p_name),nullif(btrim(p_description),''),p_domain,p_active,p_allow_recurrence,p_allow_installments) returning id into v_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,after_data,reason)
 values(p_organization_id,auth.uid(),'financial_category.create','financial_category',v_id,jsonb_build_object('domain',p_domain,'active',p_active,'allow_recurrence',p_allow_recurrence,'allow_installments',p_allow_installments),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id); return v_id;
end $$;
revoke all on function public.create_tenant_financial_category(uuid,text,text,text,boolean,boolean,boolean,text,text) from public,anon,authenticated;
grant execute on function public.create_tenant_financial_category(uuid,text,text,text,boolean,boolean,boolean,text,text) to authenticated;

create function public.create_tenant_monthly_rule(p_organization_id uuid,p_category_id uuid,p_name text,p_unit_amount numeric,p_valid_from date,p_due_day integer,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_version uuid;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_category_id is null or p_name is null or length(btrim(p_name)) not between 1 and 120
  or p_unit_amount is null or p_unit_amount::text in ('NaN','Infinity','-Infinity') or p_unit_amount<=0 or p_unit_amount>999999999999.99 or p_unit_amount<>round(p_unit_amount,2)
  or p_valid_from is null or p_valid_from<=date_trunc('month',current_date)::date or extract(day from p_valid_from)<>1
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

create function public.schedule_tenant_monthly_price(p_organization_id uuid,p_rule_id uuid,p_expected_version_id uuid,p_unit_amount numeric,p_valid_from date,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_rule public.recurring_rules%rowtype; v_previous public.recurring_rule_versions%rowtype;
begin
 perform private.require_permission(p_organization_id,'settings.manage');
 if p_rule_id is null or p_expected_version_id is null or p_unit_amount is null or p_unit_amount::text in ('NaN','Infinity','-Infinity') or p_unit_amount<=0 or p_unit_amount>999999999999.99 or p_unit_amount<>round(p_unit_amount,2)
  or p_valid_from is null or p_valid_from<=date_trunc('month',current_date)::date or extract(day from p_valid_from)<>1
  or p_reason is null or length(btrim(p_reason)) not between 3 and 500
  or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 200 then raise exception 'invalid monthly price input' using errcode='22023'; end if;
 v_id:=private.idempotency_begin(p_organization_id,'schedule_tenant_monthly_price',p_idempotency_key,jsonb_build_object('rule',p_rule_id,'expected',p_expected_version_id,'amount',p_unit_amount,'from',p_valid_from,'reason',btrim(p_reason)));
 if v_id is not null then return v_id; end if;
 select * into v_rule from public.recurring_rules where organization_id=p_organization_id and id=p_rule_id for update;
 if not found then raise exception 'rule outside organization' using errcode='23503'; end if;
 if not v_rule.active or v_rule.frequency<>'monthly' or not exists(select 1 from public.financial_categories where id=v_rule.category_id and organization_id=p_organization_id and active and allow_recurrence and domain='member_receivable') then raise exception 'rule or category ineligible' using errcode='22023'; end if;
 if not exists(select 1 from public.recurring_rule_versions where id=p_expected_version_id and recurring_rule_id=p_rule_id) then raise exception 'price version outside rule' using errcode='23503'; end if;
 select * into v_previous from public.recurring_rule_versions where recurring_rule_id=p_rule_id order by valid_from_competence desc limit 1 for update;
 if not found or v_previous.id<>p_expected_version_id or v_previous.valid_to_competence is not null then raise exception 'monthly price version conflict' using errcode='40001'; end if;
 if p_valid_from<=v_previous.valid_from_competence then raise exception 'price must follow latest competence' using errcode='22023'; end if;
 update public.recurring_rule_versions set valid_to_competence=(p_valid_from-interval '1 month')::date where id=v_previous.id;
 insert into public.recurring_rule_versions(recurring_rule_id,valid_from_competence,unit_amount) values(p_rule_id,p_valid_from,p_unit_amount) returning id into v_id;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
 values(p_organization_id,auth.uid(),'recurring_rule.price_schedule','recurring_rule',p_rule_id,jsonb_build_object('version_id',v_previous.id,'unit_amount',v_previous.unit_amount,'to',v_previous.valid_to_competence),jsonb_build_object('version_id',v_id,'from',p_valid_from,'unit_amount',p_unit_amount,'previous_to',(p_valid_from-interval '1 month')::date),btrim(p_reason));
 perform private.idempotency_complete(p_organization_id,p_idempotency_key,v_id); return v_id;
end $$;
revoke all on function public.schedule_tenant_monthly_price(uuid,uuid,uuid,numeric,date,text,text) from public,anon,authenticated;
grant execute on function public.schedule_tenant_monthly_price(uuid,uuid,uuid,numeric,date,text,text) to authenticated;
