-- Corsys Tronco Digital
-- Migration 008: post-V31 accounting/domain consolidation
-- Prepared for PostgreSQL / Supabase. Not executed in this environment.

alter table public.organization_settings
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists state_code text,
  add column if not exists country_code text not null default 'BR'
    check (length(country_code) = 2);

create table public.office_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create trigger office_types_set_updated_at
before update on public.office_types
for each row execute function private.set_updated_at();

create table public.member_offices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null,
  office_type_id uuid not null,
  effective_from date not null,
  effective_to date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique (organization_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id) on delete cascade,
  foreign key (organization_id, office_type_id)
    references public.office_types(organization_id, id)
);

alter table public.member_offices
  add constraint member_offices_same_office_no_overlap
  exclude using gist (
    member_id with =,
    office_type_id with =,
    daterange(effective_from, coalesce(effective_to + 1, 'infinity'::date), '[)') with &&
  );

create table public.recurring_member_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recurring_rule_id uuid not null,
  member_id uuid not null,
  effective_from date not null check (extract(day from effective_from) = 1),
  effective_to date check (effective_to is null or extract(day from effective_to) = 1),
  term_type text not null check (term_type in ('standard', 'override_amount', 'exempt')),
  override_amount numeric(14,2),
  reason text not null check (length(btrim(reason)) > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  check (
    (term_type = 'override_amount' and override_amount is not null and override_amount >= 0)
    or
    (term_type in ('standard', 'exempt') and override_amount is null)
  ),
  unique (organization_id, id),
  foreign key (organization_id, recurring_rule_id)
    references public.recurring_rules(organization_id, id),
  foreign key (organization_id, member_id)
    references public.members(organization_id, id)
);

alter table public.recurring_member_terms
  add constraint recurring_member_terms_no_overlap
  exclude using gist (
    recurring_rule_id with =,
    member_id with =,
    daterange(
      effective_from,
      coalesce((effective_to + interval '1 month')::date, 'infinity'::date),
      '[)'
    ) with &&
  );

create table public.user_ui_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  preference_key text not null check (length(btrim(preference_key)) > 0),
  preference_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index user_ui_preferences_global_uidx
on public.user_ui_preferences(user_id, preference_key)
where organization_id is null;

create unique index user_ui_preferences_org_uidx
on public.user_ui_preferences(user_id, organization_id, preference_key)
where organization_id is not null;

create trigger user_ui_preferences_set_updated_at
before update on public.user_ui_preferences
for each row execute function private.set_updated_at();

create table public.accounting_plan_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  description text,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (code, version)
);

create table public.accounting_account_templates (
  id uuid primary key default gen_random_uuid(),
  accounting_plan_template_id uuid not null references public.accounting_plan_templates(id) on delete cascade,
  code text not null check (length(btrim(code)) > 0),
  description text not null check (length(btrim(description)) > 0),
  row_type text not null check (row_type in ('group', 'section', 'analytic')),
  nature text not null check (nature in ('revenue', 'cost', 'expense', 'financial_result', 'patrimonial')),
  operational_classification text
    check (operational_classification in ('fixed', 'variable', 'recurring', 'ad_hoc')),
  parent_code text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (accounting_plan_template_id, code),
  check (
    (row_type <> 'analytic' and operational_classification is null)
    or
    (row_type = 'analytic' and nature = 'revenue'
      and operational_classification in ('recurring', 'ad_hoc'))
    or
    (row_type = 'analytic' and nature in ('cost', 'expense', 'financial_result')
      and operational_classification in ('fixed', 'variable'))
    or
    (row_type = 'analytic' and nature = 'patrimonial'
      and operational_classification is null)
  )
);

insert into public.accounting_plan_templates(
  id, code, name, description, version, active
) values (
  '10000000-0000-4000-8000-000000000001'::uuid,
  'corsys_complete_br',
  'Plano de Contas Padrão Corsys',
  'Estrutura inicial consolidada a partir da referência funcional V31. Deve ser revisada pela Loja e pelo responsável contábil antes da publicação.',
  1,
  true
)
on conflict (id) do nothing;

insert into public.accounting_account_templates(
  accounting_plan_template_id, code, description, row_type, nature,
  operational_classification, parent_code, display_order
) values
  ('10000000-0000-4000-8000-000000000001'::uuid,'1','RECEITAS','group','revenue',null,null,1),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.01','RECEITAS DE ANUIDADES','section','revenue',null,'1',2),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.01.001','Capitação dos Obreiros','analytic','revenue','recurring','1.01',3),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.02','RECEITAS DE EMISSÃO DE PLACETS','section','revenue',null,'1',4),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.02.001','Placets de Iniciação','analytic','revenue','ad_hoc','1.02',5),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.02.011','Kit de Iniciação','analytic','revenue','ad_hoc','1.02',6),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.02.012','Kit de Elevação','analytic','revenue','ad_hoc','1.02',7),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.02.013','Kit de Exaltação','analytic','revenue','ad_hoc','1.02',8),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.02.014','Kit de Regularização','analytic','revenue','ad_hoc','1.02',9),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.02.015','Kit de Filiação','analytic','revenue','ad_hoc','1.02',10),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.03','RECEITAS DE OBRAS LITÚRGICAS E LEIS','section','revenue',null,'1',11),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.03.003','Constituição','analytic','revenue','ad_hoc','1.03',12),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.03.004','Manual de Execução Ritualística','analytic','revenue','ad_hoc','1.03',13),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.03.005','Regulamento Geral','analytic','revenue','ad_hoc','1.03',14),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.03.006','Ritual de Aprendiz - REAA','analytic','revenue','ad_hoc','1.03',15),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.03.007','Ritual de Companheiro - REAA','analytic','revenue','ad_hoc','1.03',16),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.03.008','Ritual de Mestre','analytic','revenue','ad_hoc','1.03',17),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.03.010','Ritual Especial','analytic','revenue','ad_hoc','1.03',18),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.03.021','Paramentos','analytic','revenue','ad_hoc','1.03',19),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.03.099','Outros Rituais e Manuais','analytic','revenue','ad_hoc','1.03',20),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.04','RECEITAS DE DIPLOMAS E FORMULÁRIOS','section','revenue',null,'1',21),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.04.003','Carteira de Identidade','analytic','revenue','ad_hoc','1.04',22),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.04.006','Diploma de Mestre Maçom','analytic','revenue','ad_hoc','1.04',23),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.05','RECEITAS DE REGISTROS DE TÍTULOS E DOCUM','section','revenue',null,'1',24),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.05.001','Certificado de Grau','analytic','revenue','ad_hoc','1.05',25),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.05.002','Certificado de Transferência','analytic','revenue','ad_hoc','1.05',26),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.05.004','Quite-Placet','analytic','revenue','ad_hoc','1.05',27),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.05.099','Outros documentos','analytic','revenue','ad_hoc','1.05',28),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.06','RECEITAS DE UTILIZAÇÃO DOS TEMPLOS','section','revenue',null,'1',29),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.06.001','Taxa de Utilização do Templo A','analytic','revenue','recurring','1.06',30),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.06.002','Taxa de Utilização do Templo B','analytic','revenue','recurring','1.06',31),
  ('10000000-0000-4000-8000-000000000001'::uuid,'1.06.003','Taxa de Utilização do Templo C','analytic','revenue','recurring','1.06',32),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2','CUSTOS','group','cost',null,null,33),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.01','CUSTOS COM IMPRESSOS E MATERIAIS','section','cost',null,'2',34),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.01.001','Confecção de Rituais','analytic','cost','variable','2.01',35),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.01.004','Impressos Padronizados Diversos','analytic','cost','variable','2.01',36),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.01.005','Confecção de Cart de Identidade','analytic','cost','variable','2.01',37),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.01.006','Paramentos','analytic','cost','variable','2.01',38),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.02','CUSTOS PATRIMONIAIS','section','cost',null,'2',39),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.02.001','Custo de Manutenção da Sede','analytic','cost','variable','2.02',40),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.02.002','Custo de Manutenção da Sede Nova','analytic','cost','variable','2.02',41),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.02.021','Custos de seguros','analytic','cost','fixed','2.02',42),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.02.031','Serviços de segurança patrimonial','analytic','cost','fixed','2.02',43),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.02.041','Impostos e Taxas (IPTU e outros)','analytic','cost','fixed','2.02',44),
  ('10000000-0000-4000-8000-000000000001'::uuid,'2.02.099','Outros custos patrimoniais','analytic','cost','variable','2.02',45),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3','DESPESAS OPERACIONAIS','group','expense',null,null,46),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.01','DESPESAS COM PESSOAL ADMINISTRATIVO','section','expense',null,'3',47),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.01.001','Salários e ordenados','analytic','expense','fixed','3.01',48),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.01.005','Programa de Alimentação do trabalhador','analytic','expense','variable','3.01',49),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.01.006','Vale Transporte','analytic','expense','variable','3.01',50),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.01.007','Previdência Social','analytic','expense','fixed','3.01',51),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.01.008','Fundo de Garantia de Tempo se Serviço','analytic','expense','fixed','3.01',52),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.01.099','Outras despesas com pessoal administrativo','analytic','expense','variable','3.01',53),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.02','DOAÇÕES E CONTRIBUIÇÕES','section','expense',null,'3',54),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.02.001','Anuidade C.M.I','analytic','expense','fixed','3.02',55),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.02.002','Mensalidade C.M.S.B Executive','analytic','expense','fixed','3.02',56),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.03','DESPESAS DE PROPAGANDA E DIVULGAÇÃO','section','expense',null,'3',57),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.03.001','Placas Comemorativas','analytic','expense','variable','3.03',58),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.03.099','Outras despesas com propaganda e divulgação','analytic','expense','variable','3.03',59),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.04','DESPESAS DE EXPEDIENTE','section','expense',null,'3',60),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.04.001','Despesas com Internet','analytic','expense','fixed','3.04',61),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.04.002','Materiais de Expediente','analytic','expense','variable','3.04',62),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.04.003','Correios','analytic','expense','variable','3.04',63),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.04.004','Água e esgoto','analytic','expense','fixed','3.04',64),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.04.005','Telefone','analytic','expense','fixed','3.04',65),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.04.006','Energia Elétrica','analytic','expense','fixed','3.04',66),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.04.008','Despesas com Informática','analytic','expense','variable','3.04',67),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.04.009','Materiais de Limpeza e Cozinha','analytic','expense','variable','3.04',68),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.04.099','Outras despesas de expediente','analytic','expense','variable','3.04',69),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.05','DESPESAS COM VEÍCULOS','section','expense',null,'3',70),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.05.001','Combustíveis e Lubrificantes','analytic','expense','variable','3.05',71),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.05.002','IPVA, Seguro e Licenciamentos','analytic','expense','variable','3.05',72),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.05.004','Outras Despesas com Veículos','analytic','expense','variable','3.05',73),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.06','DESPESAS COM GRÃO-MESTRADO','section','expense',null,'3',74),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.06.022','Viagens Nacionais - hotéis e refeições','analytic','expense','variable','3.06',75),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.06.031','Viagens da Jurisdição - deslocamento','analytic','expense','variable','3.06',76),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.06.032','Viagens na Jurisdição - hotéis e refeições','analytic','expense','variable','3.06',77),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.09','DESPESAS ADMINISTRATIVAS DIVERSAS','section','expense',null,'3',78),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.09.001','Contabilidade','analytic','expense','fixed','3.09',79),
  ('10000000-0000-4000-8000-000000000001'::uuid,'3.09.006','Despesas com Digitalização de Documentos','analytic','expense','variable','3.09',80),
  ('10000000-0000-4000-8000-000000000001'::uuid,'4','RESULTADO FINANCEIRO','group','financial_result',null,null,81),
  ('10000000-0000-4000-8000-000000000001'::uuid,'4.02','DESPESAS FINANCEIRAS','section','financial_result',null,'4',82),
  ('10000000-0000-4000-8000-000000000001'::uuid,'4.02.003','Despesas com Manutenção de Contas Bancárias','analytic','financial_result','fixed','4.02',83),
  ('10000000-0000-4000-8000-000000000001'::uuid,'4.02.007','Custos de boletos - Mútuas','analytic','financial_result','variable','4.02',84),
  ('10000000-0000-4000-8000-000000000001'::uuid,'4.02.008','Custos de boletos - Conta Corrente','analytic','financial_result','variable','4.02',85),
  ('10000000-0000-4000-8000-000000000001'::uuid,'5','CONTAS PATRIMONIAIS / FORA DO DRE','group','patrimonial',null,null,86),
  ('10000000-0000-4000-8000-000000000001'::uuid,'5.01','INVESTIMENTOS','section','patrimonial',null,'5',87),
  ('10000000-0000-4000-8000-000000000001'::uuid,'5.01.001','Aquisição de bens móveis - automóveis','analytic','patrimonial',null,'5.01',88),
  ('10000000-0000-4000-8000-000000000001'::uuid,'5.01.007','Imóveis','analytic','patrimonial',null,'5.01',89),
  ('10000000-0000-4000-8000-000000000001'::uuid,'5.02','CONSTRUÇÃO DO NOVO TEMPLO','section','patrimonial',null,'5',90),
  ('10000000-0000-4000-8000-000000000001'::uuid,'5.02.053','Impostos retidos na fonte','analytic','patrimonial',null,'5.02',91)
on conflict (accounting_plan_template_id, code) do nothing;

create table public.accounting_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  valid_from date not null,
  valid_to date not null,
  copied_from_plan_id uuid,
  created_by uuid references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to >= valid_from),
  check (extract(day from valid_from) = 1),
  check (valid_to = (date_trunc('month', valid_to) + interval '1 month - 1 day')::date),
  check (
    (status = 'draft' and published_at is null)
    or
    (status = 'published' and published_at is not null)
  ),
  unique (organization_id, id),
  foreign key (organization_id, copied_from_plan_id)
    references public.accounting_plans(organization_id, id)
);

alter table public.accounting_plans
  add constraint accounting_plans_published_no_overlap
  exclude using gist (
    organization_id with =,
    daterange(valid_from, valid_to + 1, '[)') with &&
  )
  where (status = 'published');

create index accounting_plans_org_validity_idx
on public.accounting_plans(organization_id, valid_from, valid_to);

create trigger accounting_plans_set_updated_at
before update on public.accounting_plans
for each row execute function private.set_updated_at();

create table public.accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  accounting_plan_id uuid not null,
  parent_account_id uuid,
  code text not null check (length(btrim(code)) > 0),
  description text not null check (length(btrim(description)) > 0),
  row_type text not null check (row_type in ('group', 'section', 'analytic')),
  nature text not null check (nature in ('revenue', 'cost', 'expense', 'financial_result', 'patrimonial')),
  operational_classification text
    check (operational_classification in ('fixed', 'variable', 'recurring', 'ad_hoc')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (accounting_plan_id, code),
  unique (organization_id, accounting_plan_id, id),
  check (
    (row_type <> 'analytic' and operational_classification is null)
    or
    (row_type = 'analytic' and nature = 'revenue'
      and operational_classification in ('recurring', 'ad_hoc'))
    or
    (row_type = 'analytic' and nature in ('cost', 'expense', 'financial_result')
      and operational_classification in ('fixed', 'variable'))
    or
    (row_type = 'analytic' and nature = 'patrimonial'
      and operational_classification is null)
  ),
  foreign key (organization_id, accounting_plan_id)
    references public.accounting_plans(organization_id, id) on delete cascade,
  foreign key (organization_id, accounting_plan_id, parent_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id)
);

create index accounting_accounts_plan_code_idx
on public.accounting_accounts(organization_id, accounting_plan_id, code);

create trigger accounting_accounts_set_updated_at
before update on public.accounting_accounts
for each row execute function private.set_updated_at();

create table public.financial_category_account_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  accounting_plan_id uuid not null,
  category_id uuid not null,
  accounting_account_id uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, accounting_plan_id, category_id),
  unique (organization_id, id),
  foreign key (organization_id, accounting_plan_id)
    references public.accounting_plans(organization_id, id) on delete cascade,
  foreign key (organization_id, category_id)
    references public.financial_categories(organization_id, id),
  foreign key (organization_id, accounting_plan_id, accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id)
);

create table public.financial_account_accounting_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  accounting_plan_id uuid not null,
  financial_account_id uuid not null,
  accounting_account_id uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, accounting_plan_id, financial_account_id),
  unique (organization_id, id),
  foreign key (organization_id, accounting_plan_id)
    references public.accounting_plans(organization_id, id) on delete cascade,
  foreign key (organization_id, financial_account_id)
    references public.financial_accounts(organization_id, id),
  foreign key (organization_id, accounting_plan_id, accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id)
);

create or replace function private.prevent_published_accounting_structure_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_status text;
begin
  if tg_op = 'INSERT' then
    v_plan_id := new.accounting_plan_id;
  else
    v_plan_id := old.accounting_plan_id;
  end if;

  select p.status into v_status
  from public.accounting_plans p
  where p.id = v_plan_id;

  if v_status = 'published' then
    raise exception 'published accounting plan structure is immutable; create a successor plan'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger accounting_accounts_published_guard
before insert or update or delete on public.accounting_accounts
for each row execute function private.prevent_published_accounting_structure_mutation();

create trigger category_account_mappings_published_guard
before insert or update or delete on public.financial_category_account_mappings
for each row execute function private.prevent_published_accounting_structure_mutation();

create trigger financial_account_mappings_published_guard
before insert or update or delete on public.financial_account_accounting_mappings
for each row execute function private.prevent_published_accounting_structure_mutation();

create or replace function private.prevent_published_accounting_plan_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'published accounting plan is immutable; create a successor plan'
      using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger accounting_plans_published_guard
before update or delete on public.accounting_plans
for each row execute function private.prevent_published_accounting_plan_mutation();

create or replace function private.validate_category_account_mapping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text;
  v_nature text;
  v_row_type text;
  v_active boolean;
begin
  select c.domain into v_domain
  from public.financial_categories c
  where c.organization_id = new.organization_id
    and c.id = new.category_id;

  select a.nature, a.row_type, a.active
  into v_nature, v_row_type, v_active
  from public.accounting_accounts a
  where a.organization_id = new.organization_id
    and a.accounting_plan_id = new.accounting_plan_id
    and a.id = new.accounting_account_id;

  if v_row_type is distinct from 'analytic' or not coalesce(v_active, false) then
    raise exception 'financial category must map to an active analytic accounting account'
      using errcode = '23514';
  end if;

  if v_domain in ('member_receivable', 'institutional_revenue')
     and v_nature is distinct from 'revenue' then
    raise exception 'revenue category must map to revenue account'
      using errcode = '23514';
  end if;

  if v_domain = 'institutional_expense'
     and v_nature not in ('cost', 'expense', 'financial_result') then
    raise exception 'expense category must map to cost/expense/financial-result account'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger financial_category_account_mappings_validate
before insert or update on public.financial_category_account_mappings
for each row execute function private.validate_category_account_mapping();

create or replace function private.validate_financial_account_mapping()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nature text;
  v_row_type text;
  v_active boolean;
begin
  select a.nature, a.row_type, a.active
  into v_nature, v_row_type, v_active
  from public.accounting_accounts a
  where a.organization_id = new.organization_id
    and a.accounting_plan_id = new.accounting_plan_id
    and a.id = new.accounting_account_id;

  if v_nature is distinct from 'patrimonial'
     or v_row_type is distinct from 'analytic'
     or not coalesce(v_active, false) then
    raise exception 'financial account must map to an active analytic patrimonial account'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger financial_account_accounting_mappings_validate
before insert or update on public.financial_account_accounting_mappings
for each row execute function private.validate_financial_account_mapping();

create or replace function private.accounting_plan_for_date(
  p_organization_id uuid,
  p_reference_date date
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.accounting_plans p
  where p.organization_id = p_organization_id
    and p.status = 'published'
    and p.valid_from <= p_reference_date
    and p.valid_to >= p_reference_date
  order by p.valid_from desc
  limit 1;
$$;

create or replace function private.resolve_category_account(
  p_organization_id uuid,
  p_category_id uuid,
  p_reference_date date
)
returns table (
  accounting_plan_id uuid,
  accounting_account_id uuid,
  operational_classification text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, m.accounting_account_id, a.operational_classification
  from public.accounting_plans p
  join public.financial_category_account_mappings m
    on m.organization_id = p.organization_id
   and m.accounting_plan_id = p.id
   and m.category_id = p_category_id
  join public.accounting_accounts a
    on a.organization_id = m.organization_id
   and a.accounting_plan_id = m.accounting_plan_id
   and a.id = m.accounting_account_id
  where p.organization_id = p_organization_id
    and p.status = 'published'
    and p.valid_from <= p_reference_date
    and p.valid_to >= p_reference_date
    and a.active
    and a.row_type = 'analytic'
  order by p.valid_from desc
  limit 1;
$$;

revoke all on function private.accounting_plan_for_date(uuid, date) from public;
revoke all on function private.resolve_category_account(uuid, uuid, date) from public;

alter table public.charges
  add column if not exists accounting_plan_id uuid,
  add column if not exists accounting_account_id uuid;

alter table public.charges
  add constraint charges_accounting_plan_fk
    foreign key (organization_id, accounting_plan_id)
    references public.accounting_plans(organization_id, id),
  add constraint charges_accounting_account_fk
    foreign key (organization_id, accounting_plan_id, accounting_account_id)
    references public.accounting_accounts(organization_id, accounting_plan_id, id);

create or replace function private.populate_charge_accounting_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
  v_account uuid;
begin
  if new.source_kind in ('migration_opening', 'migration_reconciled')
     and new.accounting_plan_id is null
     and new.accounting_account_id is null then
    return new;
  end if;

  if new.accounting_plan_id is null or new.accounting_account_id is null then
    select r.accounting_plan_id, r.accounting_account_id
      into v_plan, v_account
    from private.resolve_category_account(
      new.organization_id, new.category_id, new.competence
    ) r;

    if v_plan is null or v_account is null then
      raise exception 'no published accounting mapping for charge category/competence'
        using errcode = '23514';
    end if;

    new.accounting_plan_id := v_plan;
    new.accounting_account_id := v_account;
  end if;

  return new;
end;
$$;

create trigger charges_accounting_snapshot
before insert on public.charges
for each row execute function private.populate_charge_accounting_snapshot();

alter table public.payment_reversals
  add column if not exists reversal_date date not null default current_date;
