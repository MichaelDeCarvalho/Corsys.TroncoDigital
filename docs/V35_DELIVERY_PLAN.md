# V35 — sequência autorizada até operação

Autorização: proprietário em 2026-10-05 Brasil. Executar oito etapas incrementalmente, preservando HTML V35, documentação, ADRs e inventário. Etapa iniciada não equivale a concluída. DEV/preview já autorizados; custos apresentados antes; produção depende de aprovação final.

| Etapa | Objetivo | Estado | Evidência de conclusão necessária |
|---|---|---|---|
| 1 | Autorização real, isolamento e comandos seguros | Em execução | JWT positivo/negativo, MFA real, perfis, suporte temporário, suspensão, invariantes e concorrência |
| 2 | Integrantes, parâmetros e estrutura financeira | Pendente | Cadastro e configuração persistidos, validação e regras vigentes |
| 3 | Cobranças, pagamentos, contas e aprovações | Pendente | Comandos transacionais, saldos e trilhas consistentes |
| 4 | Caixa, conciliação, orçamento, DRE e relatórios | Pendente | Cálculos conferidos, importação/exportação e fechamento real |
| 5 | Master, onboarding, planos, billing e suporte | Pendente | Ciclos completos e limite Master/tenant comprovado |
| 6 | Integrações, mobile e regressão | Pendente | Fluxos e arquivos reais; temas/dispositivos; integrações conforme escopo |
| 7 | Produção, recuperação e implantação assistida | Pendente | Ambiente separado, recuperação testada, custos e documentos definidos |
| 8 | Aprovação e entrada em operação | Pendente; aprovação posterior | Sistema homologado apresentado e piloto assistido |

## Etapa 1 — execução desta sessão

- Projeto DEV ativo e HEAD 5b5a6e2 conferidos; sem alteração de produção ou usuários Auth.
- Catálogo de segurança aprovado: RLS, views security_invoker, negação de funções definer a anon e grants dos helpers.
- verify_dev_role_isolation.sql reexecutado: leituras próprias positivas e cruzadas ocultas; chamado próprio criado/lido, RPC cruzada negada, Master oculto. Claims simuladas, escrita revertida.
- Novo verify_dev_subscription_and_staff.sql aprovado: active/trialing e tolerância permitem permission helper; atraso vencido/suspended/canceled e override bloqueiam; leitura permanece; staff AAL1 negado, AAL2 simulado e role correta aceitos, Support/Billing negados como Master; último Master protegido. Helpers/triggers, não cadeia de RPC financeira nem MFA real.
- Setup inicial do teste falhou na constraint da versão publicada sem published_at; fixture corrigida, sem mudança de schema, execução posterior aprovada.
- Após rollback: zero planos temporários, vínculos staff temporários e assinaturas temporárias remanescentes.
- Roteiro HTTP reforçado: identidade getUser, IDs distintos/alvo DEV fixo, consultas explícitas cruzadas, views, comando Master negado e JWT inválido. Exemplo de fixtures existentes elimina necessidade de chave administrativa/criação de usuários.
- Oito testes locais passaram. Testam o roteiro e seus falsos positivos; não são execução HTTP autenticada.

## Pendências da etapa 1

1. Executar npm run test:tenant-isolation em ambiente seguro com senhas existentes; não enviar segredos pelo chat. Sem credenciais disponíveis, não declarar PASS HTTP.
2. Criar fatos financeiros fictícios por comandos autorizados e validar leituras positivas/negativas; views vazias não são prova positiva.
3. Exercitar perfis Tesoureiro/Consulta/Integrante, vínculo próprio e revogação real.
4. Exercitar Master/Support/Billing com MFA real, sessões de suporte, expiração/revogação e isolamento.
5. Exercitar suspensão/retomada por RPC/HTTP com JWT real.
6. Testar comandos financeiros, duplicidade, sobrealocação, concorrência, fechamento e imutabilidade nas duas lojas.

Não liberar comandos financeiros ao cliente com gates críticos abertos. Desenvolvimento/testes DEV podem continuar sem promover cenários não avaliados a aprovação.

Decisões comerciais: config/commercial-decisions.json e docs/adr/0005-commercial-launch-decisions.md. Interface e ADRs financeiras continuam em vigor, inclusive layout único das lojas.


## Continuidade da etapa 1 — 2026-10-06 UTC

Ver docs/V35_STAGE_1_EVIDENCE.md. Invariantes financeiras e pós-V31 passaram. Novos roteiros verify_dev_financial_commands.sql e verify_dev_roles_and_support.sql passaram no DEV: RPCs nas duas lojas, idempotência sequencial/auditoria, leituras próprias/cruzadas, sobrealocação e IDs alheios, suspensão, perfis e suporte temporário/revogação/expiração. Claims simuladas; tudo revertido, zero fixtures temporárias conferidas. Oito testes locais PASS. Etapa 1 permanece em execução: JWT real, MFA real, matriz HTTP e concorrência simultânea ainda não comprovados. Nenhuma alteração de schema, grants, senhas, frontend, produção ou cobrança.
