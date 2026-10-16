# AGENTS.md — Corsys.TroncoDigital

## Fonte de verdade

Use, nesta ordem:
1. instruções do projeto;
2. `PROJECT_CONTEXT.md`;
3. `CURRENT_ARCHITECTURE.md`;
4. código e configuração atuais;
5. ADRs em `docs/adr/`;
6. `SESSION_HANDOFF.md`;
7. `docs/engineering/ecc-adoption.md`;
8. documentação oficial atual quando APIs/SDKs/plataformas puderem ter mudado.

## Regra de trabalho

- Inspecione antes de alterar.
- Preserve padrões válidos e trabalho em andamento.
- Faça a menor mudança segura que resolva o problema.
- Não invente stack, comandos, endpoints, banco, secrets, CI ou deploy.
- Pesquise o código existente antes de criar solução nova.
- Para APIs, SDKs e plataformas mutáveis, confirme documentação oficial atual.
- Não trate documentação Markdown como runtime executável.

## Segurança

Aplicar por padrão:
- fail-closed em controles críticos;
- least privilege;
- secrets somente server-side;
- autorização determinística;
- isolamento de tenant;
- RLS quando aplicável;
- validação de entrada na fronteira confiável;
- logs sem secrets;
- auditoria separada de remediação.

Nenhuma operação privada pode depender apenas de UI, rota escondida, CORS ou decisão probabilística de modelo.

## ECC

O projeto usa adoção seletiva do ECC, não instalação integral.
Consulte `docs/engineering/ecc-adoption.md` antes de introduzir skills, hooks, scripts, MCPs ou CI.

Estados permitidos para módulos:
- já atendido;
- implementar;
- adiado;
- não aplicável;
- bloqueado.

Estados de evidência:
- VERIFICADO;
- INFERIDO;
- NÃO AVALIADO.

Nunca converta ausência de teste em aprovação.

## Checks

Enquanto o repositório não tiver código/toolchain, não invente comandos de lint, typecheck, build ou testes.

Quando a stack existir:
1. reutilize os comandos reais do projeto;
2. consolide checks reproduzíveis sem ocultar exit codes;
3. adicione testes proporcionais aos fluxos críticos;
4. configure CI somente se houver ambiente apropriado;
5. registre evidência em handoff/release.

## Mudanças relevantes

Ao afetar arquitetura, banco, auth, autorização, segurança, deploy, integração ou dados:
- avaliar ADR;
- atualizar `CURRENT_ARCHITECTURE.md`;
- atualizar `PROJECT_CONTEXT.md`;
- registrar riscos em `SECURITY_REGISTER.md`;
- atualizar `SESSION_HANDOFF.md`.

## Git

- Trabalhar em branch para mudanças relevantes.
- Preferir PR revisável.
- Não assumir push direto em branch protegida.
- Não executar deploy, migração destrutiva ou ação externa sensível sem autorização apropriada.

