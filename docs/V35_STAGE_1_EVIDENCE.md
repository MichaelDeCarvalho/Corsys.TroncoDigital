# Etapa 1 — evidência de validação DEV
Data: 2026-10-06 UTC. Projeto: szqkdekwhzxsoxorgvaz.
Estado: EM EXECUÇÃO. Não liberar produção nem comandos financeiros ao cliente.

## Resultados executados
| Verificação | Resultado | Limite |
|---|---|---|
| Invariantes financeiras | FINANCIAL_INVARIANTS_PASS | Inserts/triggers no banco, não HTTP |
| Integridade pós-V31 | POST_V31_INVARIANTS_PASS | Leitura de consistência, não concorrência |
| Comandos financeiros nas duas lojas | DEV_FINANCIAL_RPC_PASS | Claims simuladas; repetição sequencial |
| Tesoureiro, Consulta e Integrante | DEV_ROLES_SUPPORT_PASS | Permissões/RLS no banco; sem login desses perfis |
| Suporte temporário | DEV_ROLES_SUPPORT_PASS | AAL simulado; sessão ativa, expirada, encerrada e staff inativo |
| Guard/assertions do roteiro HTTP | 8 testes locais PASS | Smoke autenticado aprovado posteriormente pelo proprietário; ver atualização |

Comandos testados: create_manual_charge, register_payment e allocate_payment_to_charge.
Na mesma chave/payload retornam o mesmo UUID, sem duplicar as três entradas de auditoria.
Payload diferente na mesma chave rejeitado com 22023; sobrealocação com 23514;
organização alheia com 42501 e integrante de outra organização com 23503.
Leitura financeira própria positiva confirma aberto=0, crédito=50 e posição=-50.
Na segunda passagem há fatos financeiros da primeira loja, e suas views permanecem ocultas.
Suspended, canceled e past_due vencido bloqueiam register_payment, preservando leitura.
Retomada por HTTP e toda a matriz de RPCs continuam pendentes.

Tesoureiro mantém permissões financeiras e não administra usuários. Consulta não escreve.
Integrante com vínculo enxerga somente seu registro; revogar vínculo remove acesso.
Suporte sem papel tenant exige AAL2 simulado e sessão read_only da organização correta.
Expiração, encerramento e staff inativo removem acesso; suporte não registra pagamento.

Tudo executado em transações com ROLLBACK. Conferência posterior: zero integrantes,
planos, staff ou sessões temporárias dos novos roteiros. Não alteradas senhas, schema,
grants, frontend, produção ou integrações pagas.

## Bloqueios para aprovação
1. JWT/login real das duas contas: executar dev-gate com credenciais preenchidas
   em ambiente seguro; não enviar senhas nem tokens pelo chat.
2. MFA real de staff Master/Support/Billing e troca/expiração de sessão.
3. Repetir perfis, revogação e suspensão pela API com JWT real.
4. Duas requisições simultâneas, tanto para mesma chave quanto disputa de saldo.
   Repetição sequencial NÃO é prova de concorrência.
5. Completar negativos de IDs em todas as RPCs, views e operações da matriz V35.

O painel Supabase nesta sessão de navegador está na página de login. A existência
de conexão SQL não proporciona uma sessão Auth dos usuários. Não pedir senha em
chat, trocar senhas ou fabricar tokens para contornar o bloqueio.

## Reexecução
Scripts SQL neste diretório de scripts, restritos às fixtures DEV conhecidas:
- verify_dev_financial_commands.sql
- verify_dev_roles_and_support.sql
As precondições interrompem a execução se configuração das fixtures mudar.
A revisão humana do projeto DEV continua necessária antes de executar.

Smoke HTTP existente: seguir dev-gate/README.md, seção de usuários já criados.
Esse smoke não encerra todos os bloqueios acima, mesmo se aprovado.



## Smoke HTTP autenticado aprovado — 2026-10-07, 18:20 Brasil

Evidência: saída integral fornecida pelo proprietário, execução local Windows/Node
v24.20.0 na cópia da branch DEV. O agente não executou este comando com as credenciais;
a classificação é execução pelo proprietário com resultado PASS apresentado.
Nenhuma senha, token ou arquivo .env foi recebido.

Comando: npm run test:tenant-isolation.
Resultado:
PASS: real Auth identities, tenant reads/RPCs, tenant-to-Master denial and invalid JWT. Financial positive fixtures, MFA, suspension and concurrency remain separate gates.

Baseline HTTP aprovado: login/getUser dos dois UUIDs esperados, consultas próprias
positivas de organização/integrantes, consultas cruzadas explícitas ocultas,
views financeiras cruzadas, catálogo/configuração/staff Master ocultos,
RPC Master negada, chamado próprio criado/lido e chamado cruzado negado,
acesso anônimo restrito e JWT inválido rejeitado com HTTP 401.

Limites: views financeiras sem fatos próprios não comprovam isolamento financeiro
positivo por HTTP; os fatos SQL anteriores foram revertidos. Não aprova MFA real,
perfis/expiração/revogação/suspensão por HTTP, matriz completa de RPCs ou concorrência
simultânea. Etapa 1 continua EM EXECUÇÃO. A recuperação real por e-mail não foi
homologada: o proprietário encontrou a senha existente. Manter credenciais somente
no .env.dev privado local, sem commit/upload. Chamados legítimos do smoke permanecem
no DEV com prefixo RLS DEV TEST, conforme roteiro.
