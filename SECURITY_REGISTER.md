# SECURITY REGISTER

> Nunca registrar secrets reais.

## Findings

| ID | Data | Categoria | Severidade | Status | Componente | Evidência | Mitigação |
|---|---|---|---|---|---|---|---|
| SEC-001 | 2026-10-02 | Cobertura | média | aberto | repositório | Código da aplicação ausente; controles não podem ser auditados | Versionar código real e executar revisão de auth, autorização, dados, entradas, secrets e deploy |
| SEC-002 | 2026-10-02 | CI/CD | informativa | aberto | GitHub | Nenhum workflow observado na revisão inspecionada | Definir checks somente após identificar stack e comandos reais |

## Controles críticos

| Controle | Default esperado | Evidência | Última revisão |
|---|---|---|---|
| Autenticação | fail-closed | NÃO AVALIADO | 2026-10-02 |
| Autorização | deny / least privilege | NÃO AVALIADO | 2026-10-02 |
| Isolamento de tenant | obrigatório quando multi-tenant | NÃO AVALIADO | 2026-10-02 |
| RLS | isolamento quando aplicável | NÃO AVALIADO | 2026-10-02 |
| Secrets | server-side | NÃO AVALIADO | 2026-10-02 |
| Webhooks | autenticados/verificados | NÃO AVALIADO | 2026-10-02 |
| CI/CD | least privilege | NÃO AVALIADO | 2026-10-02 |

## Exceções aceitas

Nenhuma exceção aceita registrada.

## Auditorias

| Data | Escopo | Tipo | Resultado | Limitações |
|---|---|---|---|---|
| 2026-10-02 | repositório GitHub | diagnóstico inicial ECC | NÃO AVALIADO para segurança do produto | somente README disponível; sem código/configuração do produto |

## Regra

Ausência de finding não significa ausência de vulnerabilidade. Scanners, buscas textuais e checklists são sinais; autorização, isolamento, persistência e comportamento devem ser testados no sistema real.
