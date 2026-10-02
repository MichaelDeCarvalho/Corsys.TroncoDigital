# ADR-001 — Adoção seletiva do ECC

- **Status:** accepted
- **Data:** 2026-10-02

## Contexto

O projeto precisa de continuidade entre sessões, disciplina de engenharia e critérios de validação. O guia ECC disponível descreve centenas de recursos, mas o repositório inspecionado contém apenas um README e não possui stack executável versionada.

## Problema

Instalar o ECC integralmente agora criaria arquivos, hooks, ferramentas e expectativas sem base técnica para ativação ou validação. Ao mesmo tempo, adiar toda a governança deixaria o projeto sem fonte de verdade, handoff e registro de segurança.

## Decisão

Adotar somente o núcleo que é útil e verificável no estado atual:
- orientação de agentes;
- contexto vivo;
- arquitetura observada;
- ADRs;
- registro de segurança;
- checklist de release;
- handoff;
- registro explícito de adoção ECC.

Não instalar scripts, hooks, MCPs, CI, testes, memória persistente ou runtime ECC até existir código/stack que justifique e permita validação.

## Alternativas consideradas

1. Instalar ECC completo agora — rejeitado por excesso de superfície e ausência de runtime verificável.
2. Não adotar nada até o código chegar — rejeitado porque perderia governança e continuidade úteis já hoje.
3. Adoção seletiva incremental — escolhida.

## Consequências positivas

- reduz risco de configuração inútil ou conflitante;
- evita afirmar capacidades inexistentes;
- cria fontes canônicas para próximas sessões;
- prepara segunda fase baseada em evidência;
- mantém reversão simples.

## Trade-offs / riscos

- não há automação de checks nesta fase;
- segurança do produto permanece NÃO AVALIADA;
- futuras sessões ainda dependem de o código real ser versionado;
- documentos precisam ser mantidos para não virar fonte obsoleta.

## Impacto em segurança

Positivo na governança, mas sem comprovação de controles do produto. Nenhuma afirmação de segurança é feita.

## Impacto em dados/migrations

Nenhum.

## Plano de rollout

1. adicionar documentação e instruções em branch dedicada;
2. revisar diff;
3. integrar por PR;
4. quando o código real entrar, executar segunda fase ECC e atualizar a classificação.

## Rollback

Reverter o commit/PR da implantação documental. Não há efeito em banco, secrets, produção ou serviços externos.

## PR/commit relacionado

A preencher após criação do PR/commit da branch `chore/ecc-selective-adoption`.
