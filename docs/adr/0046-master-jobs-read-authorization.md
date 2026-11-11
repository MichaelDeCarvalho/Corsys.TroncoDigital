# ADR 0046 — Autorização da leitura diagnóstica de Jobs

A política de SELECT exige MASTER ativo e claim AAL2 explícito. A migration troca o SELECT amplo por autorização de colunas usadas pelo histórico. A consulta continua paginada por data e ID. O Master autorizado mantém a visão de plataforma e pode filtrar por Loja. Os filtros são de diagnóstico, enquanto RLS estabelece a autorização.

As RPCs internas de provisionamento, claim, finalização e reconciliação continuam usando os papéis e funções atuais. A migration preserva grants de service_role e não muda estados ou comandos de job. O teste descartável simula claims e um worker privilegiado, com rollback do DDL e das fixtures.

O contrato permite códigos sanitizados em last_error_code. Escritores internos devem manter o campo restrito a códigos e guardar detalhes técnicos fora do catálogo de diagnóstico. A vigência do JWT é validada pelo gateway. Claims simuladas não exercitam expiração de um token assinado.
