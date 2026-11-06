# Changelog

## Não lançado (reposicionamento: a despensa em primeiro lugar)

- **Modo compra compacto:** item pego vira uma linha (✓ verde, nome riscado); "Não encontrei" e "Adiar" viram **"Não peguei"** (linha amarela, no fim da lista); card pendente com Peguei, Não peguei e preço na mesma linha; seções concluídas descem; cabeçalho mais baixo; cartão "Tudo resolvido". Corrige o preço digitado se perder ao tocar em Peguei.
- **Card da Despensa:** saem os 4 atalhos de nível; "Ajustar" e "Editar" viram janelas (montadas só ao abrir, o que alivia listas grandes); "Repor sempre" vira um interruptor no card; volta o "Voltar ao cálculo automático" do padrão; frequência, tipo de ida, vida útil e "contável" saem do formulário; a revisão da despensa sempre aceita quantidade exata.

- **Câmera:** o foco contínuo agora é confirmado e mostrado na tela; toque na imagem ou botão Focar refoca; "Tirar foto" usa a câmera do app com botão Fotografar (foto em resolução máxima via ImageCapture) em vez do seletor do navegador.

- **Lista única:** só existe a lista da casa; entram os recorrentes zerados ou com menos de 50% do padrão, ordenados do mais vazio ao menos vazio. Sai a divisão entre mercados e o botão "Ver a lista de outro mercado"; listas abertas do modelo antigo são fechadas.

- **D-01/D-02:** estoque passa a ter quantidade numérica (`Estoque.quantidade`) e produto ganha `recorrente`; migração 003 converte os estoques atuais (nível × padrão) e marca os produtos existentes como recorrentes; backup v3 lê v1 e v2. A compra agora soma ao estoque.
- **D-03/D-04:** regras puras da despensa (situação, o que falta, rótulo de nível) e a nova lista da casa (`padrão − atual`, só recorrentes). Ainda não ligadas às telas.
- **D-05:** regras de recorrência (padrão sugerido, "repor sempre", "deixar de repor").
- **D-06:** a nota soma à despensa (sem somar duas vezes ao reimportar); itens novos entram não recorrentes; a conferência mostra o efeito na despensa e oferece "Repor sempre" e "Não é da despensa".
- **D-07/D-08:** modo compra com "Terminar sem nota" (soma à despensa); apagar compra mostra e desfaz a soma; operações da despensa no repositório.
- **D-09:** tela **Despensa** (substitui o Catálogo, que redireciona): quantidade atual e padrão em cada linha, +/−, atalhos, filtros, busca, agrupar, adicionar item e "Repor sempre"; a barra agora é Início, Despensa, Lista e Importar.
- **D-10/D-11:** histórico de preço dentro do item; a lista de compras vira a lista única da casa (zerado ou abaixo do padrão, só recorrentes), sem escolher ida.
- **D-12:** o Início abre com o estado da despensa; a próxima compra da agenda vira informação secundária e considera a compra já feita.
- **D-13:** a Conferência vira revisão opcional sem ida (itens sem quantidade, acabando ou desatualizados); sai do código a geração da lista por ida e a agenda deixa de gerar lista (segue como lembrete no Início). Painel, custo da ida e comparação de mercados continuam no menu, sem destaque.
- **D-14/D-15:** e2e reescrito para a despensa (119 testes), versão do cache do service worker `despensa-v3`, guia de uso e documentação atualizados.

## 0.4.0 (cópia de segurança e persistência)

- **Cópia de segurança v2:** arquivo com cabeçalho (contagens, período, soma SHA-256) e opção de incluir a posição de casa (ligada por padrão); a v1 continua abrindo.
- **Guardar pelo menu de compartilhar** (Drive, Gmail, WhatsApp), com download de reserva; data da última cópia em Ajustes; lembrete no Início aos 30 dias ou 5 notas.
- **Restaurar ou verificar:** conferência antes de gravar (conteúdo, período, integridade, avisos e comparação com o aparelho); com dados no aparelho sempre pergunta entre mesclar e substituir, com confirmação dupla.
- **Restauração atômica:** tudo numa única transação do IndexedDB, entra tudo ou nada (corrige a gravação em partes que podia deixar o aparelho pela metade).
- **Armazenamento persistente** pedido ao navegador e estado mostrado em Ajustes.

## 0.3.0 (nomes de produto, chave da nota e tema)

- **Produtos iguais com descrição diferente:** nomes normalizados (caixa, acento, ordem das palavras, artigos e tamanho: `500g`, `500 g`, `500GR` viram `500g`); chave igual une sozinha; parecido só sugere na conferência; nova seção "Possíveis duplicados" no Catálogo, com mesclagem confirmada.
- **Chave da nota:** campo mantém o cursor ao editar no meio; sugestão de correção de 1 dígito quando o DV não confere; aviso quando a nota saiu com chave inválida (contingência); leitura aproximada quando o OCR falha; câmera do QR em alta resolução com foco e dica.
- **Tema:** a escolha Claro/Escuro/Sistema persiste mesmo quando um proxy altera o HTML (falha de hidratação).
- **Navegação:** menu Mais como folha inferior com ícones.
- Pós-MVP registrado em `docs/pos-mvp.md` (IA, análises, treino do OCR, compra sem nota).

## 0.2.0 (design, temas e mobile)

- **Identidade visual:** nova paleta azul-marinho com detalhes em dourado e vermelho só para erro, verde só para sucesso (`docs/design.md`).
- **Temas:** Claro, Escuro e Sistema (padrão), em Ajustes → Aparência; sem flash na abertura; preferência só neste aparelho.
- **Layout mobile:** cabeçalho com a marca, barra inferior com ícones, coluna única de até 640 px centralizada em telas largas, títulos em Michroma e texto em Inter.
- **Componentes:** tokens semânticos, `LinkBotao`, ícones de estado nos avisos, acordeões sem borda dupla, gráficos legíveis nos dois temas, modo compra com campos empilhados.
- **Acessibilidade:** teste automático de contraste dos tokens (AA) e e2e nos dois temas e em 360×640.

## 0.1.0 (E0.5 + E1 + E2)

Primeira versão completa, em ordem de construção.

- **Fundação (E0.5):** Next.js 16, TypeScript estrito, Tailwind 3.4, Zod; headers e CSP; PWA com service worker manual e funcionamento offline; Dockerfile, compose e GitHub Actions (CI e deploy por SSH).
- **Importação de nota:** chave por digitar, QR (câmera/imagem) e foto com OCR no aparelho; parser e conferências; apelidos por mercado; duplicidade; Compartilhar (Android); backup e restauração.
- **Lista inteligente (E1):** catálogo automático; agenda das idas; estoque por nível; conferência rápida; lista por cobertura com "puxar" da feira; modo compra offline; reconciliação ao fechar a compra; mercados, casa e estimativa da ida (Nominatim + OSRM); tela Início.
- **Preços e comparação (E2):** preço normalizado e gráficos; alertas de preço; comparação entre mercados e cesta; economia líquida e divisão da lista; gastos, deslocamento e inflação pessoal; painel do objetivo.
- **Qualidade:** testes de domínio em tabela, de repositório (fake-indexeddb) e e2e (Playwright com câmera simulada, offline e CSP); checklist de segurança e medições em `docs/`.
