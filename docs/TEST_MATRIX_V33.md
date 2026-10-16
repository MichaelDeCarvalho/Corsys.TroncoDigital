# Matriz de validação V33

## UI Master
1. Todos os 5 cards de onboarding abrem detalhes.
2. Alterar plano no Cliente 360 abre agendamento.
3. Gerenciar ciclo permite suspensão/reativação/cancelamento.
4. Exportação, cancelamento e retenção no encerramento abrem fluxo.
5. Quatro cards de automação abrem configuração.
6. Política de atraso altera multa/juros/tolerância/suspensão na demo.
7. Enviar cobrança gera feedback/evento demonstrativo.
8. Reversão reduz valor pago e recalcula saldo.
9. Fatura com pagamento ativo não pode ser anulada.
10. Acordo cria vínculo separado.
11. Novo Plano SaaS cria rascunho.
12. Alterar preço do plano publicado cria v2 sem renomear v1.
13. Promoção permite percentual/valor fixo/trial, duração, elegibilidade e limite.
14. Kanban de suporte avança/volta/reabre.
15. Resposta do suporte move chamado conforme status escolhido.
16. Configurações da Plataforma exibem todos os grupos editáveis.

## Isolamento
- usuário Tenant A não vê nome, dados, faturas, tickets ou rotas de Tenant B;
- tenant não vê navegação/route/layout Master;
- alterar `organization_id` manualmente não concede acesso;
- Master sem sessão de suporte não lê financeiro da Loja;
- SUPPORT com sessão read-only não escreve;
- notas internas de suporte não aparecem ao tenant.

## Banco
- migrations 001–014 aplicam do zero;
- backfill v1 ocorre antes dos guards de imutabilidade;
- versão publicada não sofre UPDATE/DELETE;
- entitlement de versão publicada não sofre INSERT/UPDATE/DELETE;
- tenant_write_allowed deriva de subscription.status + access_override;
- AAL1 não recebe privilégios platform_staff; AAL2 é exigido;
- último MASTER ativo não pode ser desativado;
- promoção/redemption não cruza tenant;
- superalocação continua bloqueada com invoice adjustments;
- support tickets/messages respeitam RLS por organization_id.
