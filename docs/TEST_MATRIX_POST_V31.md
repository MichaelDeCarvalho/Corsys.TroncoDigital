# Matriz de Testes pós-V31

## Migration/schema
- aplicar 001–013 do zero;
- reset e reaplicação integral;
- nenhuma migration parcial;
- template contábil com 91 linhas.

## Plano de Contas
- publicar Plano 2026: sucesso;
- publicar plano sobreposto: falha;
- inserir conta em plano publicado: falha;
- alterar/excluir conta publicada: falha;
- fato em competência sem plano/mapeamento: falha;
- receita mapeada como `fixed`: falha;
- despesa mapeada como `recurring`: falha.

## AP/AR
- criar obrigação/recebível;
- pagar/receber parcialmente;
- tentar superalocar: falha;
- corrigir abaixo do já liquidado: falha;
- cancelar saldo aberto: sucesso;
- cancelar valor divergente do saldo: falha;
- período fechado: falha para retroatividade;
- aprovação obrigatória pendente: liquidação falha.

## Segurança
- anônimo: zero acesso privado;
- Tenant A → Tenant B SELECT: zero linhas;
- Tenant A usa organization_id de B em comando: falha;
- MEMBER lê somente o próprio financeiro;
- suporte sem sessão: zero dados do tenant;
- suporte read-only: escrita falha;
- tenant suspenso: escrita falha;
- manipular UI/theme/nav não altera permissões.

## SaaS
- pagamento SaaS não afeta Caixa/DRE do tenant;
- mudança de preço não altera fatura histórica;
- webhook duplicado não cria pagamento duplicado;
- alocação excedente falha;
- invoice void com alocação ativa falha.

## Operação
- importação inválida não confirma;
- arquivo duplicado é detectado;
- conciliação acima da linha bancária falha;
- orçamento publicado não é editado;
- solicitações LGPD preservam trilha.
