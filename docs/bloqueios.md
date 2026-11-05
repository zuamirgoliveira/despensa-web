# Bloqueios e pendências que dependem de ação humana

| Tarefa afetada | O que falta | Quem | Situação |
| -------------- | ----------- | ---- | -------- |
| C-06 (parser) | Z-03: textos de pelo menos 3 notas de mercados diferentes em `tests/fixtures/notas/` (sem CPF) e 2 ou 3 fotos em `tests/fixtures/fotos/`. O parser foi validado só com a nota Cia Santos. | Zuma | aberto. O teste do parser já roda sobre toda nota `.txt` adicionada à pasta. |
| Z-02 / C-10 / C-13 | `tests/fixtures/foto-nota-real.jpeg` existe localmente, mas está no `.gitignore` (mostra final de cartão, EC, CV e ARQC). Não será commitada sem pedido explícito. O CI não terá a foto: os testes que dependem dela ficam condicionados à existência do arquivo. | Zuma | aguardando decisão (cobrir dados e autorizar o commit) |
| C-17 / C-28 | Z-07: `docs/parametros-iniciais.md` (endereços das notas e dos mercados). Sem ele, o spike usa só os endereços das fixtures. | Zuma | aberto |
| C-15 / Z-08 | Z-04 a Z-06: domínio, VPS e secrets do GitHub. | Zuma | aberto |
| C-15 | `actionlint` não foi executado (não estava instalado e baixá-lo foi bloqueado no ambiente). Os dois workflows foram validados só como YAML. Rode `actionlint` localmente ou observe o primeiro run no GitHub. | Zuma | aberto, baixa prioridade |
| C-28 e seguintes | Z-10: decisão do serviço de mapas. A C-28 foi implementada com a recomendação do spike (Nominatim + OSRM FOSSGIS, sem chave) atrás da interface `Mapas`. Se você escolher outro serviço, só `src/lib/mapas.ts` e o `connect-src` mudam. | Zuma | recomendação aplicada, aguardando confirmação |
