# ADR 0003 — Correções de aplicação DEV e ACL

Status: aceito em DEV. Data: 2026-10-02.

O projeto autorizado estava sem tabelas e sem migrations. Duas baselines falharam transacionalmente: 009 referia coluna id inexistente em tabelas de cancelamento; 014 tentava alterar posições de colunas de view via CREATE OR REPLACE. Corrigimos as chaves payable_id/receivable_id e preservamos a ordem original da view antes da primeira aplicação bem-sucedida. Não foi reescrito histórico já aplicado.

O Supabase atribuiu versões remotas próprias às aplicações. Alinhamos nomes locais com esse histórico e preservamos o mapa de origem e hashes históricos/deploy separados. Depois, migration própria revogou anon/PUBLIC EXECUTE de funções definer; os grants de authenticated destinados às RPCs permanecem para autorização interna determinística.

A configuração Auth cloud não é inferida do TOML local. Tests SQL com rollback aprovam invariantes financeiras, mas não substituem JWT, MFA, isolamento ou concorrência. Preview e produção permanecem pendentes.
