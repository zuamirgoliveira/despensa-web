# Proposta: a despensa em primeiro lugar

> **Status:** proposta para revisão. Nada aqui foi implementado. Deriva de `docs/discovery-despensa.md` e das decisões de 06/11/2026. Quando aprovada, substitui o foco do `blue-print.md`; o `AGENTS.md` só muda junto com o código de cada tarefa.

## 1. Decisões já tomadas

| # | Decisão | Fonte |
| - | ------- | ----- |
| 1 | **Quantidade numérica é a base** do estoque. Os níveis (cheio, metade, acabando, acabou) viram atalhos que preenchem o número (fração × padrão). | resposta do dono |
| 2 | **Lista única e contínua** ("a lista da casa"): entra o que está **zerado** ou **abaixo do padrão** (`padrão − atual`). Não depende de ida nem de agenda. | resposta do dono |
| 3 | **A nota soma** a quantidade comprada. A quantidade atual **pode passar do padrão** (promoção, compra a mais); isso nunca é cortado nem tratado como erro. | resposta do dono |
| 4 | Um item que chega pela nota **não é necessariamente de uso contínuo**. Existe o conceito de **item recorrente** e uma forma de baixo atrito de promover um item a recorrente (seção 3). | resposta do dono |
| 5 | Primeiro proposta e tarefas; código só depois da revisão. | resposta do dono |

## 2. Modelo conceitual

- **Item da despensa** (evolução de `Produto` + `Estoque`): nome, unidade, categoria, local, **quantidade atual** (número, pode ser maior que o padrão), **quantidade padrão** (opcional) e **recorrente** (sim/não).
- **Falta** de um item recorrente: `max(0, padrão − atual)`. Atual = 0 conta como zerado mesmo sem padrão.
- **Lista da casa** = soma do que falta + itens marcados à mão + avulsos. Editável.
- **A quantidade muda por:** ajuste manual (+/− ou digitar), atalho de nível, compra (modo compra, ao terminar) e nota fiscal (soma). Consumo é manual; a estimativa por histórico vira só sugestão.
- **Nota fiscal:** cria o item se não existe (não recorrente), soma a quantidade comprada, grava preço e mercado.

## 3. Requisito novo: promover item a recorrente com pouco atrito

**Problema.** A despensa nasce em boa parte das notas. Muitos itens da nota são compras eventuais (um tempero para uma receita, uma sacola). Se todos entrassem na regra `padrão − atual`, a lista ficaria cheia de itens que ninguém quer repor. Cadastrar tudo antes, por outro lado, é o atrito que queremos evitar.

**Proposta.**

1. **Item nascido da nota entra não recorrente**, com a quantidade atual já somada e sem padrão. Aparece na Despensa, mas **nunca entra sozinho na lista**, nem quando zera (aparece apenas num aviso discreto: "3 itens acabaram e não são recorrentes").
2. **Ação de um toque, "Repor sempre"**, em três lugares: na linha do item (Despensa), no cartão "Itens novos desta nota" ao fim da importação e no aviso de item não recorrente que zerou.
3. O toque abre uma **folha curta** (não uma tela de cadastro) com a quantidade padrão **já sugerida**: última quantidade comprada ou média das compras (reaproveita `metaAutomatica`). Para confirmar, basta um toque; para ajustar, um campo numérico e um seletor de unidade já preenchido. Categoria e local ficam em "Mais opções".
4. **Na importação**, os itens novos vêm numa lista com um interruptor "Repor sempre" por linha, **desligado por padrão**, para promover vários de uma vez sem sair do fluxo. Não é obrigatório decidir: pode-se ignorar e decidir depois.
5. **Sugestão (nunca automática):** item não recorrente comprado 3 ou mais vezes recebe o selo "Parece de uso contínuo. Repor sempre?" (substitui a atual `sugestaoDeTipoDeIda` por semanas seguidas, que passa a medir recorrência). O oposto também existe: recorrente que nunca mais foi comprado pode sugerir "Deixar de repor".
6. **Reversível:** "Deixar de repor" mantém o item e o histórico; só sai da regra da lista.

**Pontos a confirmar no refinamento:**

- O padrão ao promover é sempre sugerido (média) ou o usuário deve digitar? *Recomendo sugerir e deixar editar.*
- Item recorrente sem padrão (só quer saber se zerou) entra na lista só quando zera? *Recomendo sim.*
- Item cadastrado **à mão** na Despensa nasce recorrente ou não? *Recomendo recorrente, pois quem cadastra à mão quer controlar.*

## 4. O que muda por funcionalidade (resumo das propostas do discovery)

| Funcionalidade | Mudança |
| -------------- | ------- |
| Despensa | **Nova**, ponto focal. Lista por categoria/local, quantidade atual e padrão na linha, +/−, filtros (faltando, zerados, não recorrentes), busca, adicionar/editar/arquivar. Absorve o Catálogo. |
| Início | Abre com o estado da despensa (itens faltando, zerados) e atalho para a lista. Próxima ida vira informação secundária. |
| Lista | Regra `padrão − atual` sobre itens recorrentes. Previsão por consumo vira sugestão opcional. Dividir lista e aviso de ida pouco vantajosa viram avançados. |
| Modo compra | Mantém. Ao terminar, as quantidades pegas **somam** na despensa, com ou sem nota. |
| Importar nota | Vira ação ("Atualizar pela nota"). Conferência mostra "o que vai mudar na despensa". Fluxo técnico (QR, OCR, SEFAZ) intacto. |
| Conferir despensa | Rebaixada a revisão opcional de itens desatualizados. Ajuste direto na Despensa. |
| Agenda, custo da ida, Painel | Rebaixados (lembrete, lembrete discreto, métricas da despensa). Decisão final na etapa 6. |
| Compras, Preços, Gastos, Mercados, Ajustes | Vão para o menu Mais; histórico de preço aparece no detalhe do item. |
| Navegação | Barra: Despensa, Lista, Início, Importar nota (ação), Mais. |

## 5. Decisões ainda abertas (a fechar na revisão)

1. **Apagar compra desfaz a soma no estoque?** *Recomendo sim, com aviso do que será subtraído, nunca abaixo de zero.*
2. **Soma no modo compra:** ao marcar o item ou só ao terminar? E se houver nota depois, evitar somar duas vezes (a nota substitui a soma do modo compra para os mesmos itens). *Recomendo somar ao terminar, e a nota reconcilia.*
3. **Itens que não são comida/despensa na nota** (sacola, serviço): ignorar por linha na conferência, com memória da escolha por apelido.
4. **Item sem unidade contável** (granel, temperos): modo "tem / não tem" (0 ou 1) sem padrão numérico. *Recomendo.*
5. **Agrupar a Despensa** por categoria, local ou escolha do usuário. *Recomendo categoria como padrão, local como opção.*
6. **Custo da ida, comparação de mercados, inflação e Painel:** ficam no MVP, escondidos ou saem?
7. **Migração dos dados atuais:** nível × meta → número (cheio = meta, metade = 0,5 × meta, acabando = 0,2 × meta, acabou = 0; sem meta, última quantidade comprada). Produtos existentes com `tipoIda` e compras entram como **recorrentes** (já eram tratados como tais); os demais, não.

## 6. Plano de tarefas

Prefixo **D-** (despensa). Cada uma: um branch `feat/D-nn-…`, commits `tipo(escopo): descrição`, definição de pronto da seção 0.2 do `tarefas.md` (typecheck, lint, test, build) e atualização do `AGENTS.md` no mesmo commit do que mudar.

### Fase 1: fundação de dados e regras (sem mudar telas)

- **D-01: Modelo.** `Estoque` ganha `quantidade` numérica como campo principal; `Produto` ganha `recorrente` (boolean); `Produto.meta` passa a significar quantidade padrão (continua com `metaManual`). Schemas Zod, tipos, migração `NNN` numerada que converte níveis em números e define `recorrente` (decisão 5.7). Teste de migração com os dados atuais (seed).
- **D-02: Backup v3.** Cobrir os novos campos; ler v1 e v2 (converter ao restaurar); fixtures de v1, v2 e v3; `docs/backup.md` atualizado. Restauração atômica preservada.
- **D-03: Domínio da despensa** (`domain/despensa.ts`). `falta(item)`, `situacao(item)` (zerado, abaixo do padrão, ok, acima do padrão), `atalhoDeNivel` (nível → número) e `nivelDeQuantidade` (número → rótulo). Testes tabelados, incluindo atual > padrão, sem padrão e sem unidade contável.
- **D-04: Nova regra da lista** (`domain/lista.ts`). Lista contínua por `padrão − atual` sobre recorrentes, mais zerados recorrentes sem padrão, marcados à mão e avulsos; estimativa de custo mantida. Previsão por consumo isolada em `domain/sugestoes.ts`. Reescrever os testes tabelados; `mesclarRegeracao` preservado.
- **D-05: Recorrência** (`domain/recorrencia.ts`). Padrão sugerido ao promover, sugestão "parece de uso contínuo" (3+ compras) e "deixar de repor". Testes de bordas.

### Fase 2: fluxos de atualização

- **D-06: Nota soma.** `aplicarCompra` passa a somar; itens novos entram não recorrentes; conferência da importação mostra "o que vai mudar na despensa" e a ação "Repor sempre" por linha (seção 3). Reimportar a mesma nota não soma duas vezes. Ignorar itens que não são da despensa.
- **D-07: Modo compra soma.** Ao terminar, quantidades pegas somam; reconciliação com a nota evita soma dobrada (decisão 5.2). Apagar compra com aviso do efeito (decisão 5.1).
- **D-08: Repositórios e eventos** para as operações acima (ajustar quantidade, promover/rebaixar recorrência), sempre dentro de `src/data`.

### Fase 3: telas

- **D-09: Tela Despensa** (`/despensa`, estática, offline): linhas com quantidade atual/padrão, +/−, atalhos de nível, filtros, busca, adicionar/editar/arquivar, "Repor sempre" e "Deixar de repor". Catálogo é absorvido (rota antiga redireciona); duplicados e mesclagem como utilitário.
- **D-10: Detalhe do item** com histórico de preço (reaproveita `GraficoPreco`) e compras.
- **D-11: Lista da casa** (`/lista`) sobre a regra nova, com motivo por item ("zerado", "faltam 2") e sugestões opcionais.
- **D-12: Início** reposicionado e navegação nova (`lib/rotas.ts`, `BarraAbas`, Mais). Atualizar o pré-cache e a versão do cache do service worker.
- **D-13: Conferência** rebaixada a revisão opcional; **Agenda**, **custo da ida** e **Painel** rebaixados conforme decisão 5.6.

### Fase 4: fechamento

- **D-14: e2e** dos fluxos: importar nota → itens novos → "Repor sempre" → lista; zerar → lista; modo compra → soma; backup v2 restaurado e migrado; offline em todas as rotas novas; acessibilidade nos dois temas.
- **D-15: Documentação.** `AGENTS.md` (seções 4, 5.2, 6, 6.3 a 6.4, 8), `blue-print.md`, `usuario.md`, `tarefas.md`, `CHANGELOG.md`.
- **D-16 (Zuma): uso real.** Migrar os dados do aparelho (com backup antes) e validar a despensa por duas semanas.

### Ordem e dependências

`D-01 → D-02, D-03 → D-04, D-05 → D-06, D-07, D-08 → D-09 → D-10, D-11, D-12 → D-13 → D-14 → D-15`. Cada fase termina com a `main` estável, já que todo push publica; a Fase 1 não altera o comportamento visível além da migração, então pode ir à produção isolada.

## 7. Riscos

- **Migração irreversível no aparelho:** o IndexedDB não volta atrás. Mitigação: exigir cópia de segurança antes (aviso na primeira abertura após a migração) e testar a migração com o seed e a fixture v1.
- **Soma dobrada** (modo compra + nota, reimportação): coberta por D-06 e D-07 com testes específicos.
- **Lista vazia por engano** se poucos itens forem recorrentes: o Início mostra "N itens não recorrentes zeraram" e a promoção em lote na importação reduz o risco.
