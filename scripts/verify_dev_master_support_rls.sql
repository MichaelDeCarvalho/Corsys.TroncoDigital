begin;
do $$
declare master uuid:='71e27b4c-f0ba-46f7-832f-4faf29e8603d';
 tenant uuid:='a752dda8-4ef0-4c58-9d3b-b8fee14ec624';
 org uuid:='f2d9a9c9-e2c4-4ff3-9589-93f91fdde05b';
 v_master integer;v_tenant integer;v_internal integer;
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',master,'role','authenticated','aal','aal2')::text,true);
 execute 'set local role authenticated';
 select count(*) into v_master from public.v_saas_support_ticket_metrics;
 if v_master<3 then raise exception 'Master overview tickets unexpectedly hidden %',v_master;end if;
 select count(*) into v_internal from public.v_saas_support_ticket_metrics
 where ticket_scope='internal';
 if v_internal<1 then raise exception 'Master internal tickets hidden';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',master,'role','authenticated','aal','aal1')::text,true);
 if exists(select 1 from public.v_saas_support_ticket_metrics)
 then raise exception 'Master AAL1 can read protected tickets';end if;
 if exists(select 1 from public.saas_support_ticket_messages)
 then raise exception 'Master AAL1 can read private messages';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',tenant,'role','authenticated','aal','aal2')::text,true);
 select count(*) into v_tenant from public.v_saas_support_ticket_metrics;
 if v_tenant<1 then raise exception 'Expected visible tenant support ticket';end if;
 if exists(select 1 from public.v_saas_support_ticket_metrics
 where ticket_scope<>'tenant' or organization_id<>org)
 then raise exception 'Tenant read internal or another organization support ticket';end if;
 if exists(select 1 from public.saas_support_ticket_messages m
 left join public.saas_support_tickets t on t.id=m.ticket_id
 where m.visibility<>'customer' or t.organization_id<>org)
 then raise exception 'Tenant read private Master conversation';end if;
 execute 'reset role';
end $$;
rollback;
select 'DEV_MASTER_SUPPORT_RLS_ROLLBACK_PASS' as result;