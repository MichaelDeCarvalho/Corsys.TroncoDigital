# Bootstrap seguro do primeiro Administrador

O primeiro Administrador é um caso especial: ainda não existe um Administrador para conceder a si mesmo a função.

Fluxo recomendado:

1. criar o primeiro usuário pelo mecanismo administrativo seguro do Supabase Auth;
2. criar a organização por SQL Editor/CLI em ambiente controlado;
3. o trigger `organizations_seed_default_roles` cria:
   - ADMIN;
   - TREASURER;
   - VIEWER;
   - MEMBER;
4. associar manualmente, uma única vez, o `auth.users.id` ao role `ADMIN`;
5. a partir daí, gestão de usuários deverá ser feita por fluxo administrativo autenticado.

Exemplo conceitual para execução controlada no banco:

```sql
insert into public.user_roles (organization_id, user_id, role_id)
select
  '<ORGANIZATION_UUID>'::uuid,
  '<AUTH_USER_UUID>'::uuid,
  r.id
from public.roles r
where r.organization_id = '<ORGANIZATION_UUID>'::uuid
  and r.code = 'ADMIN';
```

Não colocar `service_role`, secret key ou credencial administrativa no navegador.
Não automatizar esse bootstrap através de endpoint público.
