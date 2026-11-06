# Discovery: rever o foco do app (a despensa em primeiro lugar)

> **Status:** discovery (levantamento). Nada aqui está decidido nem implementado. Próximas etapas: (1) refinamento e decisões, (2) documento de proposta e tarefas, (3) desenvolvimento.
> Data: 06/11/2026. Origem: teste real do fluxo "importar nota → Início", que mostrou uma quebra de expectativa sobre o ponto focal do produto.

## 1. O problema

O app foi construído em torno da **nota fiscal** e da **previsão de consumo por idas ao mercado**. A pessoa que usa espera outra coisa: uma **despensa**, ou seja, o lugar onde se vê o que existe em casa.

| Expectativa do dono | O que o app faz hoje |
| ------------------- | -------------------- |
| Existe uma tela da despensa com os itens e as quantidades | Não existe. Há o Catálogo (cadastro de produtos) e a Conferência (assistente de perguntas). Nenhuma mostra "o que tenho" |
| Posso cadastrar item a item, com ou sem quantidade atual e padrão | Produto nasce quase sempre da nota. A meta (≈ quantidade padrão) existe; a quantidade atual é um *nível* (cheio, metade, acabando, acabou) com número exato opcional |
| A lista de compras vem do que está zerado ou abaixo do padrão | A lista vem de **consumo estimado × cobertura até a próxima ida** (agenda). O zerado entra, mas "abaixo do padrão" não é a regra |
| A nota fiscal é apoio: atualiza a despensa e guarda preço | A nota é a porta de entrada do app e a primeira aba depois do Início |
| Em volta disso, gastos, consumo e projeções | Existem, mas são vários módulos de peso igual ao da despensa |

### 1.1 Princípio proposto (a validar)

> **O foco do app é gerenciar a despensa.** Toda funcionalidade existe para apoiar isso: saber o que há, saber o que falta, comprar o que falta e manter isso atualizado com o mínimo de esforço. A nota fiscal é um meio de atualizar a despensa e de guardar preços, nunca o centro.

### 1.2 Modelo conceitual proposto (a validar)

- **Item da despensa:** nome, unidade, categoria, local, **quantidade padrão** (opcional) e **quantidade atual** (opcional).
- **Falta** = item com atual = 0, ou com atual abaixo do padrão (quanto falta = padrão − atual). Item sem padrão só entra na lista se estiver zerado ou marcado à mão.
- **Lista de compras** = a soma do que falta, editável.
- **Quantidades mudam por:** ajuste manual, compra (manual ou por nota), consumo (manual; estimativa só como sugestão).
- **Nota fiscal:** cria itens que não existem, soma a quantidade comprada, grava preço e mercado.

## 2. Inventário das funcionalidades atuais

Para cada uma: **por que existe**, **o que faz hoje**, **a tensão com o novo foco** e **a proposta**. Rótulos de proposta: **Manter**, **Reposicionar** (muda de lugar ou de papel), **Simplificar**, **Rebaixar** (sai do caminho principal, vira sugestão opcional) e **Adiar** (sai do MVP).

### 2.1 Início (`/`)

- **Por que existe:** ser a tela "Hoje" com a próxima ação.
- **O que faz:** mostra a próxima ida da agenda (data, em quantos dias, quantos produtos vencem), atalhos (Conferir despensa, Ver lista, Importar nota), lembretes (nota pendente, estimativa de ida pendente, cópia de segurança).
- **Tensão:** gira em torno da agenda de idas. O card "próxima ida" não sabe que a compra já foi feita (só olha a data agendada). Não diz nada sobre a despensa.
- **Proposta (Reposicionar):** abrir com o **estado da despensa** ("12 itens faltando, 3 zerados") e o atalho para a lista. A próxima ida vira informação secundária e passa a considerar a compra já feita. Lembretes ficam.
- **Perguntas:** o Início mostra a despensa resumida ou é substituído pela própria tela Despensa?

### 2.2 Despensa (tela que não existe)

- **Por que deveria existir:** é o ponto focal.
- **Proposta (Criar):** lista de itens por categoria ou local, com quantidade atual e padrão em cada linha; indicadores de zerado e abaixo do padrão; ajuste rápido (+/−) na linha; busca; filtros ("faltando", "zerados", "sem padrão"); adicionar, editar e arquivar item; ordenar. Absorve o que hoje é o **Catálogo** e a **Conferência**.
- **Perguntas:** agrupar por categoria, por local da casa ou deixar escolher? Mostrar preço do último/ melhor mercado na linha?

### 2.3 Catálogo (`/catalogo`)

- **Por que existe:** cadastro dos produtos, nascidos das notas.
- **O que faz:** lista por categoria, formulário (nome, categoria, unidade, meta, local, tipo de ida, vida útil, frequência), arquivar, possíveis duplicados e mesclar.
- **Tensão:** é, na prática, a despensa sem as quantidades e escondida no menu Mais. Campos como tipo de ida, vida útil e frequência existem para a previsão, não para quem só quer cadastrar um item.
- **Proposta (Reposicionar):** vira a tela **Despensa**. Cadastro enxuto (nome, unidade, quantidade padrão e atual, categoria); campos de previsão ficam em "Mais opções". Possíveis duplicados e mesclagem ficam como utilitário da Despensa.
- **Perguntas:** a "meta automática" (média das compras) continua sugerindo a quantidade padrão, ou o padrão é sempre definido pela pessoa?

### 2.4 Conferir despensa (`/conferencia`)

- **Por que existe:** atualizar o estoque antes de uma ida, em cerca de 3 minutos, um produto por vez, com 4 níveis.
- **O que faz:** pergunta os produtos que a lista da ida incluiria, os sem registro, os "provavelmente acabando" e os desatualizados; grava nível e tempo da conferência; alimenta o painel.
- **Tensão:** é a **única** forma de atualizar a quantidade de um item sem comprar. Sendo uma sessão guiada, não serve para ajustar um item avulso. O vínculo com "ida" confunde.
- **Proposta (Rebaixar/Simplificar):** o ajuste de quantidade passa a ser direto na Despensa. A conferência vira um **modo de revisão opcional** ("revisar itens desatualizados"), sem depender de ida.
- **Perguntas:** manter o tempo de conferência como métrica? Manter os níveis como atalhos (cheio/metade/acabando/acabou) sobre a quantidade numérica?

### 2.5 Estoque por nível (regra de domínio, `estoque.ts`)

- **Por que existe:** permitir informar o estoque sem contar unidades.
- **O que faz:** nível → fração da quantidade de referência; estima o estoque de hoje descontando o consumo desde a confirmação; calcula cobertura em dias; sugere "provavelmente acabando".
- **Tensão:** o modelo do dono é **numérico** (atual × padrão). O nível é uma aproximação que dificulta "falta quanto para chegar no padrão".
- **Proposta (decidir):** (A) quantidade numérica como base, níveis como atalhos que preenchem o número; (B) manter níveis e acrescentar o número. Recomendo A. Exige migração dos estoques existentes (nível × meta → número).
- **Perguntas:** como tratar item sem unidade contável (arroz a granel, temperos)? "Tem / não tem" basta?

### 2.6 Lista inteligente (`/lista`)

- **Por que existe:** montar sozinha a lista de compras.
- **O que faz:** gera a lista por ida a partir de consumo e cobertura, "puxa" produtos da feira para a ida anterior, estima o custo, aceita itens avulsos, preserva edições ao regerar, avisa de ida pouco vantajosa, propõe dividir a lista entre mercados.
- **Tensão:** a regra é a mais complexa do app (seção 6.3 do AGENTS.md) e depende de agenda, consumo e vida útil. O dono descreveu algo mais simples: zerado + abaixo do padrão.
- **Proposta (Simplificar):** regra padrão = **padrão − atual** (e zerados). A lista deixa de depender de ida. Previsão por consumo vira **sugestão opcional** ("este item deve acabar em 4 dias"). Dividir lista e aviso de ida pouco vantajosa ficam como recursos avançados.
- **Perguntas:** a lista é única e contínua ("a lista da casa") ou ainda é uma lista por ida/data? Itens avulsos (fora da despensa) continuam?

### 2.7 Agenda das idas (Ajustes e `agenda.ts`)

- **Por que existe:** dar o calendário das compras (feira mensal, mercado semanal, hortifruti semanal) para a previsão.
- **O que faz:** calcula as próximas ocorrências, ajusta dia 31, define a ida de cada produto.
- **Tensão:** é a base da lista atual e do Início. Com a regra "padrão − atual", a agenda deixa de ser necessária para gerar lista.
- **Proposta (Rebaixar):** vira lembrete opcional ("próxima compra"), não requisito. Tipo de ida do produto passa a ser opcional.
- **Perguntas:** mantemos os 3 tipos de ida? Alguém além do dono usaria?

### 2.8 Modo compra (`/compra`)

- **Por que existe:** usar a lista no mercado, offline, com total corrente.
- **O que faz:** checklist (pego, não encontrei, adiado, extra), preço unitário opcional, total corrente, orçamento com aviso, mantém a tela acesa.
- **Tensão:** é coerente com o foco (comprar o que falta). Falta um fechamento que **atualize a despensa sem nota**: marcar "peguei 2" e somar 2 ao estoque.
- **Proposta (Manter e ligar à Despensa):** ao terminar a compra, as quantidades pegas somam na quantidade atual, com ou sem nota.
- **Perguntas:** a soma acontece ao marcar o item ou só ao terminar a compra?

### 2.9 Importar nota (`/importar`)

- **Por que existe:** atualizar a despensa e guardar preços sem digitar.
- **O que faz:** lê a chave por QR (câmera ou imagem), OCR da foto, digitação; abre a consulta da SEFAZ (captcha manual); lê o texto colado; confere a nota; cria produtos, apelidos e a compra; reconcilia com a lista; estima o custo da ida.
- **Tensão:** ocupa a segunda aba e a porta de entrada do app. Hoje cria e atualiza estoque como "cheio", sem somar quantidade.
- **Proposta (Reposicionar):** vira ação dentro da Despensa e da Lista ("Atualizar pela nota"), com atalho no Início. Ao importar: itens novos entram na despensa; itens existentes **somam** a quantidade comprada; conferência mostra "o que vai mudar na despensa" antes de salvar. O fluxo técnico (QR, OCR, SEFAZ) não muda.
- **Perguntas:** soma ou redefine a quantidade? O que fazer com itens da nota que a pessoa não quer na despensa (sacola, serviço)?

### 2.10 Compras (`/compras`) e Resumo (`/resumo`)

- **Por que existe:** histórico das notas e o resultado de cada compra (comprado, faltou, fora da lista, custo real).
- **O que faz:** lista de compras importadas, detalhe, apagar; resumo com a reconciliação e o custo da ida.
- **Tensão:** ocupa uma das 4 abas da barra, mas é histórico, não ação.
- **Proposta (Reposicionar):** sair da barra e ir para o menu (ou para dentro de Gastos). A barra ganha Despensa. Apagar compra precisa dizer o que acontece com o estoque.
- **Perguntas:** apagar uma compra desfaz a soma no estoque?

### 2.11 Preços (`/precos`)

- **Por que existe:** histórico de preço, alerta de preço alto e comparação entre mercados.
- **O que faz:** preço normalizado (kg, litro, 100 g), variação, gráfico, melhor mercado, cesta, sugestão de mercado preferido.
- **Tensão:** é dado de apoio, vindo das notas. Não precisa ser tela principal.
- **Proposta (Reposicionar):** o histórico de um item aparece **no detalhe do item da despensa**. A comparação entre mercados fica numa tela própria no menu.
- **Perguntas:** o preço aparece na linha da Despensa (último preço)?

### 2.12 Mercados (`/mercados`) e custo da ida

- **Por que existe:** saber onde se compra e quanto custa ir (combustível, bike).
- **O que faz:** cadastro de mercado (tipo, meio, distância, tempo), estimativa de distância pelo endereço da nota (geocodificação e rota), custo da ida, economia líquida.
- **Tensão:** é o diferencial de custo real, mas só importa a quem compara mercados. Pesa no fluxo de importação (perguntas sobre distância logo após importar).
- **Proposta (Rebaixar):** a estimativa de ida não bloqueia nem interrompe a importação: vira lembrete discreto. Ver se mantém no MVP.
- **Perguntas:** o custo da ida é relevante para o dono? Se sim, onde entra (Gastos)?

### 2.13 Gastos (`/gastos`) e Painel (`/painel`)

- **Por que existe:** custo real por categoria, inflação pessoal e métricas do objetivo (menos idas, menos emergências, tempo de conferência).
- **O que faz:** gastos por mês e categoria, deslocamento, inflação por cesta fixa, métricas mensais com tendência.
- **Tensão:** o Painel mede o objetivo antigo (reduzir idas), não o de gerenciar a despensa.
- **Proposta:** **Gastos: Manter** (apoia projeção de gastos). **Painel: Reformular** para métricas da despensa (itens zerados no momento da compra, itens fora do padrão, frequência de ruptura) ou **Adiar**.
- **Perguntas:** quais indicadores o dono quer ver? Projeção de gasto do próximo mês entra?

### 2.14 Ajustes (`/ajustes`)

- **Por que existe:** parâmetros, aparência, localização de casa e cópia de segurança.
- **O que faz:** agenda, regras (folga, alerta de preço, janela de preço, economia mínima), custos (carro, bike), aparência (tema), posição de casa, backup e restauração.
- **Tensão:** muitos parâmetros são da previsão e da ida. Aparência e backup são essenciais e independem do foco.
- **Proposta (Simplificar):** manter Aparência e Cópia de segurança em destaque; agrupar o resto em "Avançado".

### 2.15 Cópia de segurança (Ajustes → Cópia de segurança)

- **Por que existe:** os dados só ficam no aparelho.
- **Proposta (Manter).** Com a despensa no centro, o backup ganha importância. Verificar que o formato cobre os novos campos (quantidade atual e padrão) e prever migração do formato v2.

### 2.16 Navegação

- **Hoje:** barra com Início, Importar, Lista, Compras; menu Mais com Conferir despensa, Catálogo, Preços, Painel, Gastos, Mercados, Ajustes.
- **Proposta (a validar):** barra com **Despensa**, **Lista**, **Início** (ou Início dentro de Despensa), **Importar nota** como ação e **Mais**. Compras, Preços, Gastos, Mercados e Ajustes vão para o Mais.

## 3. Quadro-resumo

| Funcionalidade | Hoje | Proposta |
| -------------- | ---- | -------- |
| Despensa (tela) | não existe | **Criar** (ponto focal) |
| Início | próxima ida | Reposicionar |
| Catálogo | menu Mais | Vira a Despensa |
| Conferir despensa | sessão guiada | Rebaixar (revisão opcional) |
| Estoque por nível | níveis | Decidir: número como base |
| Lista inteligente | consumo × cobertura | Simplificar (padrão − atual) |
| Agenda das idas | base da lista | Rebaixar (lembrete) |
| Modo compra | checklist offline | Manter, somar à despensa |
| Importar nota | aba principal | Reposicionar (apoio) |
| Compras e Resumo | aba na barra | Mover para o menu |
| Preços | tela própria | Histórico no item + comparação à parte |
| Mercados e custo da ida | logo após importar | Rebaixar |
| Gastos | tela própria | Manter |
| Painel | mede o objetivo antigo | Reformular ou adiar |
| Ajustes | muitos parâmetros | Simplificar |
| Cópia de segurança | v2 | Manter, cobrir novos campos |

## 4. Impactos técnicos (visão preliminar)

- **Modelo de dados:** `Estoque` ganha quantidade numérica como campo principal; `Produto.meta` passa a ser a quantidade padrão (com ou sem `metaManual`). Migração numerada nova; backup v3 com leitura de v1 e v2.
- **Domínio:** nova regra de lista (`padrão − atual`); `estoque.ts` e `lista.ts` simplificados; previsão de consumo isolada como módulo de sugestão.
- **Importação:** `aplicarCompra` passa de "volta a cheio" para "soma a quantidade comprada"; tela de conferência mostra o efeito.
- **Telas:** nova Despensa; mudanças em Início, Lista, Modo compra, navegação; reduzir Conferência e Painel.
- **Testes:** reescrever testes tabelados de estoque e lista; e2e dos fluxos principais; migração testada com os dados atuais.
- **Documentos a atualizar quando decidido:** `blue-print.md`, `AGENTS.md` (seções 4, 6, 6.3, 6.3.0, 6.4), `usuario.md`, `tarefas.md`.

## 5. Decisões a tomar no refinamento

1. Quantidade numérica como base e níveis como atalhos (ou manter só níveis)?
2. A nota **soma** à quantidade ou a redefine?
3. Consumo: manual (−1 na tela) ou estimado? A previsão continua como sugestão?
4. A lista é única e contínua ou por ida?
5. A agenda de idas fica, vira lembrete ou sai do MVP?
6. O que acontece com custo da ida, comparação de mercados, Painel e inflação: ficam, ficam escondidos ou saem do MVP?
7. Navegação final (abas) e papel do Início.
8. Item sem unidade contável: como representar?
9. Migração: como converter os dados atuais (nível × meta → quantidade) sem perder nada?
10. Escopo do MVP da nova proposta: o que é essencial para a primeira versão?

## 6. Próximos passos

1. Revisar este documento e marcar, por funcionalidade, a proposta aceita, ajustada ou rejeitada.
2. Responder as decisões da seção 5.
3. Escrever a proposta consolidada (substitui o foco do `blue-print.md`) e o plano de tarefas.
4. Só então iniciar o desenvolvimento, com commits por tarefa.
