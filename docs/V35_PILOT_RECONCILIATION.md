# V35 — conciliação do HTML e layout comum

## Fonte aceita

Recebido em 2026-10-03: `corsys-tesouraria-preview-v35-planos-ofertas.html`, 559.409 bytes, SHA-256 `8b22ee9738f9a5173b1941960ebe16be3c813d5f38a8a16557cf087418250a5b`. Esta é a referência visual mais recente, complementar à documentação V35 e às ADRs. [HTML preservado](pilot/v35-planos-ofertas.reference.html), [inventário completo](V35_PILOT_V35_INVENTORY.md). Somente duas tags externas injetadas pelo antivírus foram removidas; código de produto e linhas preservados. V34 continua protegido como histórico, sem substituir silenciosamente seu baseline.

21 telas: seis Master e quinze cliente. O inventário V35 contém 132 ocorrências de campos nas telas, três compartilhadas e 301 em 132 fragmentos dinâmicos/históricos; repetições não representam campos únicos em execução. Extração estática DOM/AST, sem execução do HTML. Comparação dos inventários ignorando números de linha: vinte telas mantêm seus controles declarados; apenas `view-master-planos` muda. Isso não prova equivalência de todo JavaScript ou dos resultados de cliques.

## Contrato de layout

O proprietário confirmou: todas as lojas usam o mesmo layout. Construir componentes e rotas de cliente compartilhados; identidade, dados, permissões e estado comercial variam por organização. Não criar implementações separadas por nome de loja, nem exigir gravação duplicada de cada campo para a segunda loja. O Master tem seu próprio control plane. Aplicar autorização no servidor/RLS; menu oculto ou seletor do protótipo não é controle de acesso.

A gravação V9 mostra Ricardo/Tesoureiro na segunda loja e o aviso de atraso: acesso durante tolerância, bloqueio posterior das gravações financeiras com consulta e exportação mantidas. Data e valores do piloto são demonstrativos. O vídeo não comprova o bloqueio no backend. Dados iguais do protótipo não devem ser copiados como armazenamento compartilhado entre clientes.

## Recursos adicionais preservados

| Área | Mínimo V35 | Aceite na implementação |
|---|---|---|
| Histórico de planos | Datas de vigência inicial/final, status, limpar filtros e contador | Filtros coerentes, estados vazio/erro; o piloto filtra a data inicial da versão, não sobreposição de intervalos |
| Identidade | Nome/código editáveis no rascunho e sucessor; snapshot das versões | Publicação preserva contratos e snapshots anteriores; normalização e unicidade no servidor |
| Plano ativo/inativo | Desativar/reativar com motivo | Auditoria; impedir novas contratações quando inativo sem alterar contratos existentes |
| Exclusão de plano | Digitar EXCLUIR; bloquear com publicação/vínculos | Verificar referências reais e transação; contadores fictícios não bastam |
| Promoções/ofertas | Desconto, duração única/ciclos/período, elegibilidade, limites e versões | Snapshot no resgate; ciclos/limites e datas válidos; condições anteriores preservadas |
| Ciclo de promoção | Desativar/reativar com motivo; exclusão confirmada e restrita | Preservar histórico/resgates; validação real de dependências e auditoria |
| Integração com onboarding | Apenas planos ativos; escolher versão publicada e respeitar vigência | Não ativar versão futura antes da vigência; autorização e validação servidor |

Não transportar limitações da simulação: seleção de versão vigente precisa respeitar término da vigência; validar intervalo invertido; contagem local de vínculos e remoção em arrays não equivalem a integridade transacional. A imutabilidade e auditoria definidas nas ADRs prevalecem sobre mutações demonstrativas.

## Evidência e próximo desenvolvimento

Nove vídeos analisados por amostragem e cenas selecionadas, aproximadamente 10min13s. V8 acrescenta pesquisa de integrantes, extratos diferentes e detalhes por faixa de atraso. V9 acrescenta amostra da segunda loja, fechamento mensal e aviso comercial. [Revisão visual](V35_PILOT_VIDEO_REVIEW.md).

Esta conciliação conclui o recebimento e o inventário da fonte V35. Não conclui a paridade do app React/Supabase. Continuam pendentes os comandos reais/persistência, Master, demais módulos da matriz, mobile/temas/acessibilidade e testes de autorização, suspensão e isolamento entre lojas. Os recursos não filmados continuam no escopo obrigatório; novas gravações duplicadas não são condição para continuar o desenvolvimento autorizado em DEV.
