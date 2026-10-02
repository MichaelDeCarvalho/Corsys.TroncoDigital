-- Pós-V31: verificações determinísticas.
-- Executar somente depois das migrations 001–013 em DEV.

do $$
begin
  if exists (
    select 1
    from public.accounting_plans a
    join public.accounting_plans b
      on a.organization_id=b.organization_id
     and a.id<>b.id
     and a.status='published'
     and b.status='published'
     and daterange(a.valid_from,a.valid_to+1,'[)')
         && daterange(b.valid_from,b.valid_to+1,'[)')
  ) then
    raise exception 'FAIL: overlapping published accounting plans';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.accounting_accounts a
    where a.row_type='analytic'
      and (
        (a.nature='revenue' and a.operational_classification not in ('recurring','ad_hoc'))
        or
        (a.nature in ('cost','expense','financial_result')
          and a.operational_classification not in ('fixed','variable'))
        or
        (a.nature='patrimonial' and a.operational_classification is not null)
      )
  ) then
    raise exception 'FAIL: invalid accounting operational classification';
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from public.v_institutional_payable_effective where not integrity_ok) then
    raise exception 'FAIL: institutional payable integrity';
  end if;
  if exists (select 1 from public.v_institutional_receivable_effective where not integrity_ok) then
    raise exception 'FAIL: institutional receivable integrity';
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from public.v_bank_reconciliation_lines where not integrity_ok) then
    raise exception 'FAIL: bank reconciliation integrity';
  end if;
end;
$$;

select 'POST_V31_INVARIANTS_PASS' as result;
