# ADR-0016 — Plano de Contas por vigência

## Status
Aceito.

## Contexto
A DRE histórica não pode mudar quando o administrador altera códigos, descrições ou mapeamentos contábeis no futuro.

## Decisão
Cada organização pode possuir múltiplos Planos de Contas, mas somente planos `published` participam dos fatos contábeis. Cada plano publicado possui `valid_from` e `valid_to`, sem sobreposição temporal. A vigência começa no primeiro dia e termina no último dia de um mês.

Estruturas de um plano publicado — contas e mapeamentos — ficam imutáveis. Mudanças futuras exigem um plano sucessor.

## Consequências
- Plano 2026 pode vigorar até 31/12/2026 e Plano 2027 a partir de 01/01/2027.
- Fatos financeiros armazenam o plano/conta resolvidos na competência.
- DRE histórica não é silenciosamente reclassificada.
- Drafts podem ser editados antes da publicação.
