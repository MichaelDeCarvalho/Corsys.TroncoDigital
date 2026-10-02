# ECC ADOPTION — Corsys.TroncoDigital

## Registro da implantação

- Data: 2026-10-02
- Projeto: `MichaelDeCarvalho/Corsys.TroncoDigital`
- Revisão inspecionada: `92960ef866bdb9009c73634fa23f943a9f358150`
- Estado observado: repositório contém apenas `README.md`
- Fonte metodológica: `GUIA_RECURSOS_ECC.md` v1.0, baseado no snapshot ECC 2.2.2
- PR da implantação: `#1`\n- commit inicial da implantação: `9b8a5b40639f7625ce4ff505dfc8e97847fcecf0`\n- Runtime ECC copiado: não
- Código ECC copiado: não
- Estratégia: adaptação nativa da metodologia, sem afirmar instalação integral

## Objetivo

Deixar o repositório pronto para continuidade de engenharia com contexto versionado, segurança explícita, decisões rastreáveis e critérios de validação; adiar qualquer automação que dependa de uma stack ainda ausente.

## Critérios usados

Um recurso só entra quando:
- resolve necessidade observável;
- é compatível com stack/host reais;
- não duplica solução existente;
- possui ativação/gatilho definidos;
- pode ser validado e revertido;
- não depende de capacidade inexistente.

## Seleção por família

| # | Família | Estado | Evidência / decisão |
|---|---|---|---|
| 01 | Mapeamento e retomada | implementar | `PROJECT_CONTEXT.md`, `CURRENT_ARCHITECTURE.md`, `SESSION_HANDOFF.md` |
| 02 | Documentação viva e decisões | implementar | docs canônicos + ADR |
| 03 | Intenção e planejamento | implementar | regra proporcional em `AGENTS.md`; sem cerimônia para mudanças triviais |
| 04 | Pesquisa e reutilização | implementar | regra de pesquisar código e docs oficiais antes de criar/integrar |
| 05 | Padrões e arquitetura | implementar | preservar convenções e mudança mínima; stack ainda não observada |
| 06 | Contratos de fronteira | bloqueado | não há API/UI/webhook versionados |
| 07 | Qualidade estática e build | bloqueado | não há package manager, linter, compilador ou build observado |
| 08 | Testes unitários e regressão | bloqueado | não há código/runner |
| 09 | Fluxos de interface e navegador | bloqueado | não há UI executável |
| 10 | Acessibilidade, UX e design | bloqueado | não há interface versionada |
| 11 | Performance e publicação web | bloqueado | não há build/deploy observado |
| 12 | Git, CI e entrega | parcial | branch/PR adotados; CI bloqueada até comandos reais |
| 13 | Segurança e cadeia de dependências | parcial | protocolo e registro adotados; auditoria do produto bloqueada |
| 14 | Banco e migrações | bloqueado | banco/schema ausentes |
| 15 | Cache, filas e tarefas | não aplicável | nenhuma necessidade observada |
| 16 | Ambiente reproduzível | bloqueado | runtime e dependências não observados |
| 17 | Agentes de IA e avaliação | não aplicável | nenhum recurso LLM do produto observado |
| 18 | Loops e automação de agentes | não aplicável | nenhum loop/runtime observado |
| 19 | Contexto, memória e aprendizagem | parcial | docs/handoff adotados; memory vault/observer adiado |
| 20 | Custos e observabilidade | bloqueado | nenhum runtime/chamada paga observado |
| 21 | MCP e integrações | adiado | somente se surgir lacuna real de acesso |
| 22 | Orquestração e trabalho paralelo | adiado | repositório ainda não justifica coordenação multiagente |
| 23 | Gestão de skills/configuração ECC | adiado | não há instalação ECC real a manter |
| 24 | Hooks e controles do ambiente | adiado | host/eventos não identificados |
| 25 | Stacks e linguagens adicionais | bloqueado | stack não observada |
| 26 | Mobile e desktop | não aplicável | nenhum app nativo observado |
| 27 | Conteúdo, pesquisa e marketing | não aplicável | fora do escopo de engenharia atual |
| 28 | Mídia, apresentações e documentos | não aplicável | nenhuma necessidade de produto observada |
| 29 | Operações empresariais e industriais | adiado | regras do domínio ainda não versionadas |
| 30 | Infraestrutura e domínios especializados | não aplicável | nenhuma infraestrutura especializada observada |

## Recursos adotados agora

### 1. Contexto e retomada
Arquivos:
- `PROJECT_CONTEXT.md`
- `CURRENT_ARCHITECTURE.md`
- `SESSION_HANDOFF.md`

Ativação: leitura pelo agente/operador.
Validação: arquivos presentes e coerentes com o estado observado.
Reversão: remover os arquivos e referências em um commit coerente.

### 2. Governança de decisões
Arquivos:
- `docs/adr/README.md`
- `docs/adr/0001-selective-ecc-adoption.md`

Ativação: manual quando mudança arquitetural relevante ocorrer.
Validação: ADR contém contexto, decisão, trade-offs e rollback.
Reversão: preservar histórico; superseder ADR em vez de apagar decisão já usada.

### 3. Segurança
Arquivo:
- `SECURITY_REGISTER.md`

Ativação: atualização quando houver finding, exceção ou revisão.
Validação: nenhum secret real; controles sem evidência permanecem NÃO AVALIADOS.
Reversão: não apagar histórico de findings sem justificativa; migrar se outro mecanismo substituir.

### 4. Gate de release
Arquivo:
- `RELEASE_CHECKLIST.md`

Ativação: antes de release relevante.
Validação: somente marcar itens efetivamente executados.
Reversão: substituir por mecanismo equivalente documentado.

### 5. Orientação do agente
Arquivo:
- `AGENTS.md`

Ativação: pelo host/agente quando suportar leitura de instruções do repositório.
Validação: conteúdo aponta para fontes canônicas e não promete automação inexistente.
Reversão: remover/ajustar se o host não suportar o formato.

## O que NÃO foi instalado

- scripts do ECC;
- hooks do editor/CLI;
- Git hooks;
- MCPs;
- memory vault/observers;
- eval harness;
- CI;
- testes;
- scanners;
- auto-update;
- serviços em background.

A ausência é deliberada: o repositório não contém a stack necessária para justificar ou validar esses componentes.

## Checks executados nesta implantação

| Controle | Resultado |
|---|---|
| repositório acessível | VERIFICADO |
| branch principal | VERIFICADO: `main` |
| conteúdo da raiz | VERIFICADO: somente `README.md` antes da mudança |
| existência de código do produto | VERIFICADO: ausente na revisão inspecionada |
| lint | NÃO AVALIADO |
| typecheck | NÃO AVALIADO |
| testes | NÃO AVALIADO |
| build | NÃO AVALIADO |
| CI remota | NÃO AVALIADO |
| segurança do produto | NÃO AVALIADO |
| deploy | NÃO AVALIADO |

## Gatilho para segunda fase

Executar nova rodada de adoção assim que o código real do sistema estiver versionado. A segunda fase deve:
1. mapear stack e comandos reais;
2. identificar auth, banco, integrações e deploy;
3. implementar checks reproduzíveis;
4. adicionar testes de fluxos críticos;
5. avaliar CI;
6. revisar isolamento/autorização;
7. atualizar este registro com evidências reais.

## Manutenção

Revisar este documento quando:
- entrar backend/auth/banco;
- surgir IA/agente;
- houver novo fluxo crítico;
- mudar deploy/CI;
- forem introduzidas integrações externas;
- um módulo antes bloqueado passar a ter runtime.

## Reversão

Esta fase é essencialmente documental. Reversão consiste em remover as referências ECC e os documentos adicionados por um commit posterior. Nenhum banco, secret, serviço externo ou produção foi alterado.
