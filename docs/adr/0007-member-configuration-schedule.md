# ADR 0007 — Configuração de integrante por vigência

Status: aceito para DEV, 2026-10-08. Complementa docs/adr/v35/0007-versioned-recurring-rules.md.

O texto degree_or_office da ficha não representa atribuição de cargo com vigência. office_types/member_offices representam catálogo e histórico; recurring_member_terms representa condição por regra e competências. Não criar valor financeiro solto em members.

Criar catálogo exige settings.manage; atribuir cargo exige members.write; programar condição financeira exige settings.manage. Usar catálogo de permissões existente, sem promover tesoureiro a administrador. require_permission também bloqueia assinatura suspensa.

Dois comandos auditados e idempotentes usam somente IDs da organização. Cargos começam hoje ou depois. Termos financeiros começam no primeiro dia de competência futura, com término inclusivo opcional. Exclusions existentes rejeitam sobreposição por integrante/cargo ou integrante/regra; cargos diferentes simultâneos são permitidos. Condições standard e exempt não recebem valor; override_amount recebe decimal não negativo de até duas casas.

Esta entrega apenas acrescenta vigências: não corrige histórico, não gera cobranças e não substitui vigência aberta. Encerramento/sucessão de termos, preço geral versionado, regras elegíveis, prévia/geração e testes HTTP reais continuam obrigatórios antes de homologação. Catálogos vazios são exibidos honestamente; não semear regras de produção ou alterar elegibilidade para habilitar a tela.

Falha de transporte tem resultado ambíguo: manter campos bloqueados e retry com mesmo payload/chave. Audit registra ator/recurso/referências/vigência/condição e motivo, sem copiar ficha/contatos. UI compartilha layout entre lojas e preserva o escopo explícito nas quatro consultas.

Verificação: verify_dev_member_configuration.sql com rollback, claims simuladas ADMIN/TREASURER/VIEWER/suspensão e IDs estrangeiros; 39 testes frontend/types/build. Não substitui HTTP/JWT real, concorrência simultânea, homologação visual do HTML V35 ou operação de recorrência.

Recuperação: forward-fix aditivo; diante de falha operacional, revogar EXECUTE das duas RPCs novas e manter SELECT/histórico. Não apagar ledger ou abrir escrita direta. Migration aplicada somente no DEV20261008201550.
