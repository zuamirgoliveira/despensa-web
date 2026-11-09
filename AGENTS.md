# AGENTS.md: despensa-web

Referência técnica para qualquer agente ou desenvolvedor que altere este repositório. Descreve stack, arquitetura, convenções, regras de negócio implementadas, segurança e operação. Não contém lista de tarefas nem descrição de produto. Mantenha este arquivo atualizado quando mudar qualquer item aqui.

---

## 1. Resumo técnico

PWA de gestão de despensa doméstica. Funciona offline, instala no Android, roda 100% no aparelho (sem autenticação, sem banco no servidor). O servidor entrega os arquivos estáticos e o shell Next.js e tem **uma única rota**, o proxy da consulta do QR Code (seção 5.5), que não guarda nada.

- **Foco do produto:** gerenciar a despensa da família. Toda funcionalidade apoia isso: saber o que há (quantidade atual × padrão), saber o que falta (lista da casa), comprar e manter atualizado com pouco esforço. A nota fiscal é um meio de atualizar a despensa e guardar preços, nunca o centro (`docs/proposta-despensa.md`).
- **Perfil de projeto:** A, com dados locais (IndexedDB).
- **Idioma da interface:** português do Brasil. **Moeda:** BRL. **Fuso:** `America/Recife`.
- **Usuários:** uso pessoal. Existe um único `casaId` padrão, mas todo registro já o carrega para permitir evolução para multiusuário.

---

## 2. Stack e versões

| Item                   | Versão               | Observação                                                                         |
| ---------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| Node.js                | 22 LTS               | `.nvmrc` = `22`; `engines.node >=22 <23`; imagem `node:22-alpine`                  |
| Next.js                | 16 (App Router)      | `output: 'standalone'`, `poweredByHeader: false`                                   |
| React                  | 19                   |                                                                                    |
| TypeScript             | 5                    | `strict: true`; proibido `any` implícito ou explícito sem comentário justificando  |
| Tailwind CSS           | **3.4.x**            | **v4 é proibida**                                                                  |
| clsx                   | 2                    |                                                                                    |
| tailwind-merge         | 3                    |                                                                                    |
| Zod                    | ^4                   | validação de dados persistidos, backup e entradas externas                         |
| Vitest                 | ^4 (fixado em 4.0.18) | testes unitários e de repositório; 4.1.x quebra o `npm install` (bug de peers do npm 10.9) |
| @playwright/test       | versão atual estável | apenas desenvolvimento; testes e2e                                                 |
| fake-indexeddb         | versão atual estável | apenas desenvolvimento; testes de repositório                                      |
| jsqr                   | versão atual estável | leitura de QR por software (fallback do detector nativo)                           |
| tesseract.js           | 5                    | OCR no aparelho                                                                    |
| @tesseract.js-data/eng | versão atual estável | apenas desenvolvimento; fonte do `eng.traineddata.gz` copiado para `public/vendor` |

Fixe versões exatas no `package-lock.json`. Instalação sempre com `npm ci`. Não adicionar dependência sem registrá-la na tabela da seção 12.

**Não usar:** Supabase, Server Actions, rotas de API próprias (`app/api`) além do proxy `/api/nfce` da seção 5.5, autenticação, `middleware.ts`, Framer Motion, Sonner, bibliotecas de estado global, bibliotecas de gráfico (gráficos em SVG próprio), bibliotecas de datas (usar utilitários próprios em `src/lib/datas.ts`).

---

## 3. Comandos

| Comando              | Função                                                      |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | servidor de desenvolvimento                                 |
| `npm run build`      | copia `vendor` do OCR, gera o build standalone e o pré-cache |
| `npm run vendor`     | só copia o `vendor` do OCR (roda sozinho antes do `dev`)    |
| `npm start`          | serve o build (usar para validar CSP e service worker)      |
| `npm run lint`       | ESLint                                                      |
| `npm run typecheck`  | `tsc --noEmit`                                              |
| `npm test`           | Vitest (`vitest run`)                                       |
| `npm run test:watch` | Vitest em modo observação                                   |
| `npm run e2e`        | Playwright contra `next start`                              |
| `npm run seed:dev`   | gera `dev-data/despensa-seed.json` (3 meses, 2 mercados); importe em Ajustes → Importar backup (somente dev) |

Todo código novo exige `typecheck`, `lint`, `test` e `build` verdes.

---

## 4. Estrutura do repositório e papel de cada arquivo

```
despensa-web/
├─ AGENTS.md                       este arquivo: referência técnica
├─ README.md                       como instalar, rodar e testar
├─ CHANGELOG.md                    histórico de versões
├─ package.json / package-lock.json
├─ .nvmrc                          versão do Node
├─ tsconfig.json                   strict, alias @/* → src/*
├─ next.config.ts                  standalone + headers (importa src/lib/security-headers.ts)
├─ tailwind.config.ts              tokens de cor e tipografia
├─ postcss.config.mjs
├─ eslint.config.mjs
├─ vitest.config.ts
├─ playwright.config.ts
├─ .env.example                    variáveis aceitas (sem valores reais)
├─ .gitignore / .dockerignore
├─ Dockerfile                      build multi-stage, usuário não root
├─ docker-compose.yml              execução na VPS (Traefik, rede web)
├─ .github/workflows/
│  ├─ ci.yml                       PR: lint, typecheck, test, build, e2e
│  └─ deploy.yml                   push na main: qualidade + build + envio por SSH
├─ docs/
│  ├─ blue-print.md                especificação de produto (fonte dos requisitos)
│  ├─ tarefas.md                   plano de execução
│  ├─ deploy.md                    runbook da VPS, rollback, monitoramento
│  ├─ arquitetura.md               camadas e fluxo de dados
│  ├─ seguranca.md                 resultado do checklist de segurança
│  ├─ qualidade.md                 métricas de Lighthouse e bundle
│  ├─ design.md                    identidade visual, paleta dos dois temas, tipografia, layout mobile
│  ├─ pos-mvp.md                   ideias avaliadas e adiadas (IA, análises, treino do OCR, compra sem nota)
│  ├─ spike-mapas.md               comparação e decisão do serviço de mapas
│  ├─ parametros-iniciais.md       valores de seed informados pelo dono
│  └─ bloqueios.md                 pendências que dependem de ação humana
├─ referencia/prototipo/           protótipo JS puro (somente leitura, fonte de portagem)
├─ public/
│  ├─ manifest.webmanifest         manifest estático com share_target
│  ├─ sw.js                        service worker manual
│  ├─ theme-init.js                aplica data-tema antes da primeira pintura (sem flash)
│  ├─ icons/                       ícones 192, 512, maskable
│  └─ vendor/tesseract/            GERADO no build (não versionado)
├─ scripts/
│  ├─ copy-vendor.mjs              copia worker, core e idioma do Tesseract para public/vendor
│  ├─ gen-precache.mjs             gera a lista de pré-cache do service worker
│  ├─ seed-dev.mjs                 gera dev-data/despensa-seed.json (backup de dev; importar em Ajustes)
│  └─ spike-mapas/                 scripts do estudo de mapas
├─ src/
│  ├─ app/                         rotas e layouts (App Router)
│  ├─ components/
│  │  ├─ ui/                       primitivos: Button/LinkBotao, Card, Input, Textarea, Select, Badge, Alert, Icone, Toast, Progress, Details, EmptyState, Dialog…
│  │  ├─ importar/                 passos da tela Importar (chave, SEFAZ, colar, conferência)
│  │  ├─ compras/                  lista de compras, detalhe e apagar
│  │  ├─ ajustes/                  Ajustes: agenda, regras, custos, Aparência e Cópia de segurança (guardar, restaurar/verificar)
│  │  ├─ precos/                   lista de preços e histórico
│  │  ├─ despensa/                 tela Despensa (ponto focal): linhas com quantidade atual/padrão, +/−, filtros, adicionar, repor sempre
│  │  ├─ catalogo/                 formulário do produto e possíveis duplicados (usados pela Despensa)
│  │  ├─ conferencia/              tela Conferir despensa (um produto por vez)
│  │  ├─ lista/                    tela Lista inteligente (itens, estimativa, avulsos)
│  │  ├─ compra/                   tela Modo compra (checklist offline, total corrente)
│  │  ├─ resumo/                   tela Resumo da compra (comprado, faltou, fora da lista)
│  │  ├─ mercados/                 tela Mercados (tipo, transporte, distância, custo da ida)
│  │  ├─ inicio/                   tela Início ("Hoje"): próxima ida, lembretes
│  │  ├─ gastos/                   tela Gastos: custo real, categorias, deslocamento, inflação
│  │  ├─ painel/                   tela Painel do objetivo
│  │  └─ …                         componentes de tela por módulo
│  ├─ domain/                      regras de negócio puras (sem React, sem IndexedDB)
│  │  ├─ nfce/chave.ts             chave de acesso, DV, QR, reparo de OCR
│  │  ├─ nfce/parser.ts            texto da SEFAZ → nota estruturada
│  │  ├─ nfce/sefaz.ts             URL de consulta por UF; `consultaDoQR` valida e reconstrói a URL do QR (host e caminho fixos)
│  │  ├─ nfce/xml.ts               XML da NFC-e (consulta do QR) → mesma estrutura do parser, sem CPF
│  │  ├─ catalogo.ts               produto novo a partir de item de nota, chave de nome
│  │  ├─ normalizacao.ts           nome normalizado, chave de produto, parecidos e sugestões de mesclagem
│  │  ├─ mercados.ts               tipo sugerido pelo nome do emitente
│  │  ├─ despensa.ts               quantidade atual como base: nível → número, conversão do estoque legado
│  │  ├─ recorrencia.ts            promover a recorrente (padrão sugerido), sugestões "repor sempre" e "deixar de repor"
│  │  ├─ estoque.ts                níveis, consumo, cobertura
│  │  ├─ inicio.ts                 próxima ida, produtos que vencem e lembretes da tela Início
│  │  ├─ conferencia.ts            quais itens revisar (sem quantidade, acabando, desatualizados), agrupados por local
│  │  ├─ agenda.ts                 ocorrências das idas
│  │  ├─ lista.ts                  passo da unidade, arredondamento, regeração preservando edições, estimativa de custo
│  │  ├─ compra.ts                 total corrente, progresso, ordem e orçamento do modo compra
│  │  ├─ reconciliacao.ts          nota × lista
│  │  ├─ categorias.ts             categoria por palavra-chave
│  │  ├─ ida.ts                    custo da ida
│  │  ├─ precos.ts                 preço normalizado, histórico, variação
│  │  ├─ comparacao.ts             melhor mercado, cesta
│  │  ├─ economia.ts               economia líquida, aviso de ida pouco vantajosa
│  │  ├─ gastos.ts                 gastos e inflação pessoal
│  │  ├─ painel.ts                 métricas mensais do painel e tendências
│  │  ├─ backup.ts                 lembrete de cópia de segurança (30 dias ou 5 notas)
│  │  └─ types.ts                  tipos inferidos dos schemas
│  ├─ schemas/                     schemas Zod de todas as entidades
│  ├─ data/
│  │  ├─ repositorios.ts           interfaces dos repositórios
│  │  ├─ indexeddb/                implementação e migrações numeradas
│  │  ├─ backup.ts                 exportar (v2 com cabeçalho e integridade), inspecionar, comparar com o aparelho e restaurar
│  │  ├─ backupArquivo.ts          guardar a cópia: compartilhar (Web Share) ou baixar, e registrar Perfil.ultimoBackupEm
│  │  ├─ conferencia.ts            fila da conferência, registrar nível e sessão
│  │  ├─ estimativaIda.ts          estimar distância/tempo da ida, confirmar e gravar custo nas compras
│  │  ├─ lista.ts                  garantir/regerar lista preservando edições, editar itens
│  │  ├─ compra.ts                 modo compra: pego, não encontrei, preço, extra, orçamento
│  │  ├─ reconciliacao.ts          fechar a compra: estoque cheio, reconciliar, fechar lista, resumo
│  │  ├─ importarNota.ts           orquestra a importação (mercado, produtos, apelidos, compra, meta)
│  │  ├─ despensa.ts               quantidade atual: definir, somar/subtrair, apagar compra desfazendo, repor sempre
│  │  ├─ catalogo.ts               edição com meta manual, liberar meta, mesclar produtos
│  │  ├─ eventos.ts                emissor de mudanças (aoMudar, emitirMudanca)
│  │  └─ useRepositorio.ts         hook que reexecuta a consulta quando a coleção muda
│  ├─ lib/
│  │  ├─ nfceRemota.ts             cliente do proxy /api/nfce (resposta validada com Zod)
│  │  ├─ qr.ts                     leitura de QR (nativo + jsqr) e scanner de câmera
│  │  ├─ ocr.ts                    leitura da chave por Tesseract
│  │  ├─ imagem.ts                 arquivo → canvas com EXIF
│  │  ├─ mapas.ts                  cliente do serviço de mapas (Nominatim + OSRM FOSSGIS), timeouts e Zod
│  │  ├─ estimativaIda.ts          geocodificar com variantes e rota da casa (bike com fator 1,12)
│  │  ├─ endereco.ts               normalização do endereço da nota (variantes de geocodificação)
│  │  ├─ coordenadas.ts            arredondar (3 casas) e ler coordenadas coladas
│  │  ├─ localizacao.ts            captura da posição UMA vez (getCurrentPosition)
│  │  ├─ format.ts                 brl, dataBR, horaBR, kg
│  │  ├─ datas.ts                  datas sem hora, hojeRecife (injetável)
│  │  ├─ rotas.ts                  lista de rotas do app (pré-cache)
│  │  ├─ tema.ts                   preferência Claro/Escuro/Sistema (localStorage + data-tema)
│  │  ├─ armazenamento.ts          pedir armazenamento persistente e ler o estado (navigator.storage)
│  │  ├─ arquivos.ts               criar, compartilhar (menu do Android) e baixar arquivos
│  │  └─ security-headers.ts       fonte única dos headers e da CSP
│  └─ config/seed.ts               valores iniciais aplicados na primeira abertura
├─ tests/                          Vitest (espelha src/) + fixtures/
│  └─ fixtures/                    notas (.txt), fotos e dados de exemplo
└─ e2e/                            Playwright
```

Regra de posicionamento: se um arquivo importa React ou IndexedDB, ele **não** pode estar em `src/domain`. `src/domain` importa apenas de `src/schemas`, `src/lib/datas.ts` e de si mesmo.

---

## 5. Arquitetura

### 5.1 Camadas e direção de dependência

```
app/ (telas) → components/ → data/ (repositórios) → schemas/
        ↓            ↓
     domain/  ←——————┘     lib/ (câmera, OCR, mapas, formatação)
```

- **Telas** são Client Components (`'use client'`): leem IndexedDB e usam APIs do navegador. Layouts podem ser Server Components.
- **Domínio** recebe dados já carregados e devolve resultados. Não faz I/O, não lê relógio global (receber `hoje` por parâmetro).
- **Repositórios** são o único ponto de acesso a persistência. Telas importam `criarRepositorios()`, nunca `indexedDB` direto.
- **Eventos de mudança:** cada escrita no repositório emite evento; `useRepositorio(consulta, colecoes, deps?)` reexecuta a consulta quando uma das coleções muda ou um valor de `deps` (ex.: um id guardado em estado) muda. Não há store global.

### 5.2 Persistência (IndexedDB)

- Banco `despensa`, versionado (`criarRepositorios()` em `src/data/indexeddb/index.ts`; `criarRepositorios({ indexedDB, nomeBanco })` abre instância própria, usada nos testes com `fake-indexeddb`), com **migrações numeradas** em `src/data/indexeddb/migrations/NNN-descricao.ts`. Nunca editar migração já publicada; criar nova.
- Todo registro: `id` (UUID v4 via `crypto.randomUUID()`) e `casaId`. Exceção de chave natural: `Compra.chave` (44 dígitos) e `ApelidoMercado` (`cnpj` + `codigo`).
- Entidades: `Casa`, `Perfil`, `AgendaIda`, `Mercado`, `Produto`, `ApelidoMercado`, `Estoque`, `Compra` (com `ItemCompra[]`), `Lista`, `ItemLista`, `RegistroConferencia` (migração 002: tempo e quantidade de produtos de cada conferência; o campo `conferencias` do backup é opcional para aceitar backups antigos)., `NotaPendente` (migração 004: QR lido sem conseguir buscar a nota; ver 5.5).
- Schemas em `src/schemas/` (`comum`, `constantes`, `entidades`); tipos em `src/domain/types.ts`. Valores de enum não têm acento (`laticinios`). `Compra` e `ApelidoMercado` não têm `id` (chave natural). Campos extras além do blueprint: `Estoque.quantidade` (**quantidade numérica atual, base do estoque**; pode passar de `Produto.meta`, o padrão; `nivel` é só o rótulo do último atalho; migração 003), `Produto.recorrente` (uso contínuo: só recorrentes entram sozinhos na lista; produto nascido da nota é não recorrente; registros antigos valem recorrentes; ver `docs/proposta-despensa.md`), `Produto.metaManual`, `Produto.contavel`, `ItemLista.removido`, `ItemLista.quantidadeEditada`, `Perfil.economiaMinimaDivisaoCentavos`, `Perfil.janelaPrecoDias`, `Perfil.ultimoBackupEm`. `Perfil.bikeCentavosPorKm` aceita fração de centavo.
- Todo dado lido de IndexedDB ou de arquivo de backup passa por Zod antes de ser usado.
- **Backup (especificação completa em [docs/backup.md](docs/backup.md)):** JSON `versao: 3` (v1 e v2 continuam legíveis: `quantidade` do estoque é calculada ao ler, nível × padrão) com `exportadoEm`, `meta` (contagens, período, `incluiPosicaoDeCasa` e soma SHA-256 de `JSON.stringify(colecoes)`) e `colecoes`; a v1 (sem `meta`) continua legível (fixture `tests/fixtures/backups/v1-seed.json`); versão superior à suportada é recusada. `inspecionarBackup` confere formato, versão, soma e contagens **sem gravar**; `compararComAparelho` diz o que existe aqui e na cópia. **Restauração atômica:** `Repositorios.restaurar(dados, modo)` valida tudo (Zod, chaves duplicadas, estoque único por produto) e grava **todas as coleções numa única transação** (erro no meio aborta e o aparelho fica como estava; `tests/data/restauracao.test.ts` inclui falha simulada e foi validado por mutação sem `tx.abort()`). Modos: `mesclar` (mesmo identificador fica como na cópia; o que só existe aqui é mantido; o estoque da cópia substitui o local do mesmo produto; a casa padrão vazia some; a posição de casa do aparelho é mantida se a cópia não a traz) e `substituir` (apaga tudo e deixa igual à cópia). `restaurarBackup` recusa soma que não confere e grava `Perfil.ultimoBackupEm = exportadoEm` (nunca volta para trás). Guardar: `guardarCopia` compartilha com `navigator.share({ files })` (cancelar não conta; sem suporte baixa o arquivo) e registra a data. Armazenamento persistente (`lib/armazenamento.ts`) é pedido ao abrir (`ProtegerArmazenamento`). **Decisões:** posição de casa incluída por padrão (opção de omitir), senha no arquivo adiada, ao restaurar com dados no aparelho **sempre perguntar** (mesclar ou substituir; substituir exige segunda confirmação com "Entendi").
- **Seed (`src/config/seed.ts`):** ao criar a casa na primeira abertura, `iniciar()` grava o perfil com os padrões e a agenda inicial (feira dia 5, mercado semanal sábado, hortifruti semanal quarta). Só nesse momento: reabrir não recria o que o usuário apagou. Transcrever `docs/parametros-iniciais.md` (Z-07) para o seed quando existir.
- O armazenamento é por origem e por aparelho. Não há sincronização.

### 5.3 Convenções de dados

- **Dinheiro:** inteiro em **centavos** em todos os modelos e funções de domínio. Formatação só na camada de interface (`brl()`).
- **Quantidade:** número decimal (kg, litros) ou inteiro (unidades).
- **Datas de agenda:** string `YYYY-MM-DD`, sem hora e sem fuso. Cálculo de dias entre datas por diferença de dias civis (não por milissegundos).
- **Data/hora de nota:** `YYYY-MM-DDTHH:mm:ss` local, sem sufixo de fuso.
- **Relógio:** `hojeRecife()` em `src/lib/datas.ts`; nas funções de domínio, `hoje` é parâmetro.
- **Idioma do código:** entidades e regras de negócio em português (`produto`, `mercado`, `compra`); utilitários e infraestrutura em inglês.

---

### 5.5 Proxy da consulta do QR Code (única rota de servidor)

**Decisão (08/11/2026, registrada a pedido do dono):** abrir exceção às regras 2 e 3 para automatizar a importação. A consulta pública da NFC-e pelo QR (`https://nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe?p=chave|2|1|1|hash`) devolve o **XML da nota** sem captcha, porque a URL do cupom já traz a assinatura do emitente (nada é contornado), mas a SEFAZ não envia CORS e o navegador não consegue lê-la. `POST /api/nfce` (`src/app/api/nfce/route.ts`) faz só essa ponte:

- Entrada `{ url }`. `consultaDoQR` exige `https`, host `nfce.sefaz.pe.gov.br`, porta vazia ou 444, caminho `/nfce-web/consultarNFCe` e `p` no formato `chave(44)|d|d|d+|hash(40 hex)`; **a URL é reconstruída** só com essas partes (nunca se acessa um endereço escolhido por quem chama). Chave: DV ok, modelo 65, UF PE.
- `fetch` com `redirect: "error"`, 10 s de limite, resposta de até 1 MB. Mesma origem obrigatória (cabeçalho `Origin` = host) e 20 consultas por minuto por IP (memória, sem persistência).
- `parseNotaXml` (`domain/nfce/xml.ts`) converte para o mesmo formato do parser de texto e roda as mesmas conferências (`conferirNota`). **O CPF do consumidor (tag `<dest>`) é lido só para sinalizar `cpfNaNota` e nunca é devolvido.** Resposta `no-store`; nada é gravado nem registrado em log.
- O cliente (`lib/nfceRemota.ts`) valida a resposta com Zod. Falha de qualquer tipo mostra o motivo e **mantém o passo a passo manual** (colar o texto). Disparos: QR lido pela câmera do app, QR da imagem enviada ou URL recebida por Compartilhar (`/importar?text=…`).
- Privacidade: a URL do QR (chave + assinatura da nota) passa pelo servidor do app para chegar à SEFAZ; endereço de casa, lista e demais dados continuam só no aparelho. Testes: `tests/api/nfce.test.ts`, `tests/domain/xml.test.ts`, `e2e/qr-automatico.spec.ts` (sempre com a SEFAZ simulada). Se a SEFAZ mudar o formato do XML, o caminho manual segue funcionando.
- **Fluxo do QR (UX):** com a busca bem-sucedida, os passos "Consultar na SEFAZ" e "Colar o texto" **somem** e a tela rola até a conferência. **Fila offline:** se a busca falha por motivo passageiro (`BuscaNotaError.passageiro`: sem rede, SEFAZ fora do ar/lenta, limite), o QR vai para `notasPendentes` (migração 004; id = chave; `data/notasPendentes.ts`), a tela Início avisa "N notas lidas pelo QR esperando busca" e Importar lista "Notas esperando busca" com **Buscar**; importar a nota tira da fila. A fila faz parte do backup (`notasPendentes`, opcional em cópias antigas). **QR na compra:** `Compra.qrUrl` guarda a URL (sem CPF; sempre revalidada por `consultaDoQR` antes de abrir) e "Abrir SEFAZ" da tela Compras abre a nota direto, sem captcha; sem QR guardado, copia a chave e abre a consulta manual.

### 5.4 Aparência: tema, tokens e layout

Decisões e valores completos em [docs/design.md](docs/design.md). Resumo técnico:

- **Tokens semânticos.** As cores são variáveis CSS de canais RGB em `src/app/globals.css` (`--fundo`, `--superficie`, `--borda`, `--borda-forte`, `--texto`, `--suave`, `--primario`, `--primario-fg`, `--destaque`, `--sucesso`, `--aviso`, `--erro`, `--erro-fg`, `--cabecalho`, `--cabecalho-fg`, `--externo`), expostas em `tailwind.config.ts` (`bg-superficie`, `text-suave`, `bg-primario/10`…). **Componentes usam só esses nomes**: nunca hex, nunca `dark:` e nunca as cores antigas (`verde`, `text-texto/70`). SVG usa `stroke-primario`/`fill-suave` (classes), não hex.
- **Temas.** Claro, Escuro e Sistema (padrão), escolhidos em Ajustes → Aparência. Sistema é CSS puro (`@media (prefers-color-scheme: dark)` com `:root:not([data-tema="claro"])`); a escolha explícita é o atributo `data-tema="claro|escuro"` em `<html>`, guardada em `localStorage` (`despensa-tema`, fora do backup) e aplicada antes da pintura por `public/theme-init.js` (arquivo estático e síncrono em `<head>`; **sem** `dangerouslySetInnerHTML`). `lib/tema.ts` lê/grava/aplica. `TemaPersistente` (em `layout.tsx`) reaplica o atributo após a hidratação e se ele sumir: o React 19 **apaga todos os atributos de `<html>`** quando a hidratação falha e refaz a página no cliente, o que acontece se um proxy/CDN alterar o HTML (ex.: tags injetadas pelo Cloudflare). `e2e/tema.spec.ts` simula essa injeção. Os dois blocos escuros do CSS devem ser idênticos (`tests/lib/contraste.test.ts` confere e calcula os contrastes).
- **Paleta (identidade de Pernambuco, minimalista).** Base azul-marinho (`#0B1A3D`, `#060F26`, `#030A1A`), primário azul sóbrio no claro e azul celeste no escuro, **dourado só como detalhe** (ponto da marca, barra da aba ativa), **vermelho só para erro/perigo**, verde só para **sucesso**. Dourado e vermelho nunca no mesmo componente. Cor nunca é o único sinal: `Alert` leva ícone (`Icone`), tendências levam ▲▼.
- **Tipografia.** Michroma (`font-titulo`, peso 400) só em `h1`, `h2`, legendas de seção e na marca; Inter em todo o resto (botões, números, tabelas, nomes de dados). `h1`/`h2` já recebem Michroma pelo CSS base; para um `h2` com nome vindo de dados use `font-sans`. Números monetários: classe `numero` (tabular) e `whitespace-nowrap`.
- **Layout.** Mobile primeiro, retrato (390×844; mínimo 360×640). Coluna única centralizada de no máximo `max-w-coluna` (40rem); em telas maiores só crescem as margens (fundo `externo`, borda fina nas laterais), sem layout de duas colunas. `Cabecalho` (navy, rola com a página) + `main` com `pb-28` + `BarraAbas` fixa, limitada à mesma coluna e com `safe-area-inset-bottom`. Use `min-h-dvh`, nunca `100vh`.
- **Botões.** `Button` para ações; `LinkBotao`/`classesBotao` para links com aparência de botão (não copie classes). Variantes `primario`, `secundario`, `perigo`; tamanho `grande` (56 px) no modo compra. Alvo ≥ 44 px, foco com contorno `primario`.
- **Acordeão em Card:** `Details` com `semBorda` para não duplicar a borda.
- **Movimento:** transições curtas; `prefers-reduced-motion` desliga animações (regra global em `globals.css`).

## 6. Regras de negócio implementadas

Todas as fórmulas vivem em `src/domain/` e têm teste tabelado.

### 6.1 Estoque (`estoque.ts`)

- **A quantidade numérica (`Estoque.quantidade`) é a base** (ver 6.3.-1); os níveis abaixo são atalhos e a base da estimativa de consumo (previsão, que é só sugestão: revisão da despensa e atalho "Mesmo que o estimado"). Níveis → fração: `cheio` 1, `metade` 0,5, `acabando` 0,2, `acabou` 0.
- `estoqueEstimado = fração × quantidadeReferência` (meta, ou última quantidade comprada).
- `consumoDiario`: com 2 ou mais compras do produto, média das últimas até 4 razões `quantidade_i ÷ dias entre compras` (ignorar intervalos de 0 dia). Com menos, pela frequência declarada: semanal `meta/7`, quinzenal `meta/15`, mensal `meta/30`, sob demanda `indefinido`.
- `cobertura (dias) = estoque ÷ consumo`; `Infinity` se consumo for 0 ou indefinido.
- `estoqueNaData = max(0, estoqueAgora − consumo × dias)`.
- Produto comprado **soma** a quantidade comprada (ver 6.4).
- "Provavelmente acabando" (`sugerirProvavelmenteAcabando(produto, estoque, compras, hoje)`): cobertura estimada de hoje < 2 dias e nível ainda não é `acabando`/`acabou` → pede confirmação. O estoque de hoje = estoque do nível confirmado − consumo × dias desde `confirmadoEm` (`estoqueAgora`).
- `quantidadeReferencia(produto, compras)`: a meta; sem meta, a última quantidade comprada. `comprasDoProduto` soma os itens do mesmo produto na mesma nota. `aplicarCompra(estoques, compra, confirmadoEm, gerarId)` devolve só os registros de estoque que mudam ou nascem (`cheio`, `quantidadeExata` zerada).
- Datas: `diasEntre`, `adicionarDias`, `soData`, `hojeRecife` em `src/lib/datas.ts` (dias civis, validam datas inexistentes).

- **Revisão da despensa** (`conferencia.ts`, tela `/conferencia`, no menu Mais; opcional, **sem ida**): pergunta um item por vez os ativos **sem quantidade registrada**, **provavelmente acabando** (cobertura estimada de hoje < 2 dias, nível ainda não `acabando`/`acabou`) ou **desatualizados** (sem confirmação há mais de 14 dias, `DIAS_PARA_REVISAR`); agrupa por `localCasa` ("Sem local" por último). `nivelEstimado` (≥ 75% cheio, ≥ 35% metade, > 5% acabando, senão acabou) alimenta o atalho "Mesmo que o estimado". Cada resposta grava o `Estoque` na hora (número = nível × padrão, ou a quantidade exata); ao concluir grava um `RegistroConferencia` (sem `tipoIda`) com a duração. O ajuste do dia a dia é direto na Despensa.

### 6.2 Agenda (`agenda.ts`)

- Três tipos: `feira_mensal` (dia do mês), `mercado_semanal` e `hortifruti_semanal` (dia da semana, 0 = domingo).
- Dia do mês inexistente (31 em abril, 30 em fevereiro) ajusta para o **último dia do mês**.
- `tiposCompativeis(produto)`: feira mensal e mercearia podem ser puxados para `mercado_semanal`; hortifruti fica em `hortifruti_semanal`; os tipos semanais só voltam a si mesmos.
- API: `proximaOcorrencia(agenda, aPartirDe, incluirHoje = true)`, `ocorrenciasEntre`, `proximaIdaDoTipo(agendas, tipo, hoje)` e `idaSeguinte(agendas, tipo, data)` (estritamente posterior), ambas devolvendo `Ida { tipo, data, agendaId }`.

### 6.3 Geração da lista por ida (HISTÓRICO: removida na D-13; a regra vigente é a 6.3.-1)

Seja `T` a ida alvo (tipo e data), `T2` a ocorrência seguinte do mesmo tipo, `folga` = `Perfil.folgaDias` (padrão 2).

- `estoqueEmT = estoqueNaData(estoqueAgora, consumo, dias(hoje → T))`.
- Entra na lista se `tipoIda == T.tipo` e (`nivel == 'acabou'` **ou** `estoqueEmT ÷ consumo < dias(T → T2) + folga`).
- `quantidade = consumo × (dias(T → T2) + folga) − estoqueEmT`, arredondada para cima à unidade de compra (kg: 0,1; un/pacote: 1; l: 0,5), mínimo de uma unidade mínima, limitada superiormente por `consumo × vidaUtilDias`. Sem consumo conhecido, usa-se a `meta`.
- **Puxar para ida anterior:** produto de `feira_mensal` cujo estoque acaba antes da próxima feira entra na primeira ida compatível com data ≤ data de fim do estoque; se não houver, entra na próxima compatível marcado `urgente`. Quantidade calculada contra a feira seguinte.
- `acabou` sempre entra; se a ida do tipo vier depois de hoje + 1 dia, vai para a primeira ida compatível.
- `sob_demanda` só entra se `acabou` ou `acabando`.
- Perecível (`vidaUtilDias ≤ 14`) nunca vai para feira mensal (gera aviso se configurado assim).
- Produto arquivado (`ativo = false`) nunca entra.
- Estimativa de custo = soma de `quantidade × último preço unitário`; itens sem preço ficam fora da soma e são listados à parte.
- Saída: `{ produtoId, quantidade, motivo: 'acabou'|'cobertura'|'puxado', urgente, precoEstimadoCentavos? }[]` + resumo.
- Tela `/lista?ida=<tipo>` (`ListaInteligente`): sem `ida`, usa a ida mais próxima da agenda. `garantirLista` reaproveita a lista aberta (rascunho ou em compra) da mesma ida; lista `fechada` nunca é reaproveitada. Remover item do catálogo marca `removido` (não volta ao regerar); remover avulso apaga. "Iniciar compra" leva a `/compra?lista=<id>` (**query, não segmento dinâmico**, por causa do offline).
- Regerar a lista preserva edições manuais (removidos continuam removidos; quantidades editadas permanecem): `mesclarRegeracao(sugeridos, existentes)` devolve `{ adicionar, atualizar, remover }`; itens avulsos, extras, editados e já pegos nunca são tocados; automáticos intocados que deixaram de ser sugeridos saem.

Decisões de implementação (`gerarLista(entrada)` devolve `{ ida, itens, resumo } | undefined` quando o tipo não tem agenda):

- **Quando um produto de feira é "puxado":** o estoque acaba antes da próxima feira **e** a próxima ida compatível acontece antes da feira. Ele entra na lista dessa ida compatível quando o estoque não chega até a ida semanal seguinte + folga (ou seja, na última ida semanal em que ainda dá tempo), com `motivo: 'puxado'`; `urgente` se a ida cai depois do fim estimado do estoque. Enquanto estiver nessa situação, ele **não** aparece na lista da feira.
- **`acabou`:** vai para a ida própria se ela for em até 1 dia; senão para a mais cedo entre a própria e as compatíveis (empate: a própria). `urgente` quando a ida é daqui a mais de 1 dia.
- **Quantidade:** horizonte = próxima ida do tipo **próprio** do produto depois da ida alvo (feira seguinte, no caso do puxado). Arredonda para cima ao passo da unidade; o teto `consumo × vidaUtilDias` é arredondado para **baixo** ao passo (nunca ultrapassa o limite); o mínimo (uma unidade mínima) vence o teto. Sem consumo, usa a meta.
- Produto sem registro de estoque: assume `cheio` desde a última compra (ou desde hoje, se nunca comprou).
- Comparações de cobertura usam tolerância de 1e-9 (evita `8,999999999999998 < 9`).

### 6.3.-1 Despensa e lista da casa (`despensa.ts`; em implantação, ver `docs/proposta-despensa.md`)

- `situacaoDoItem(produto, estoque)`: `sem_registro` (ninguém informou a quantidade), `zerado` (≤ 0), `abaixo` (**menos de 50% do padrão**, `FRACAO_PARA_REPOR`: é o que vai para a lista), `parcial` (de 50% até o padrão: ainda não repõe), `ok`, `acima` (> padrão é permitido: compra a mais, promoção). Padrão = `Produto.meta` > 0; sem padrão, qualquer quantidade > 0 é `ok`. `quantidadeQueFalta` = `max(0, padrão − atual)`. `nivelDeQuantidade` (≥ 75% cheio, ≥ 35% metade, > 5% acabando, senão acabou) é só rótulo.
- `gerarListaDaCasa({ produtos, estoques, compras })`: lista única, sem ida nem agenda. Entram produtos **ativos, recorrentes e com registro** que estão zerados (quantidade = padrão, senão última comprada, senão 1 passo) ou **com menos de 50% do padrão** (quantidade = faltante até o padrão, arredondada para cima ao passo da unidade). **Ordem:** zerados primeiro, depois do mais vazio ao menos vazio (fração do padrão), empate por nome. **Não recorrente nunca entra**; se zerou vira aviso (`naoRecorrentesZerados`). Motivos `acabou` e `abaixo`. Estimativa de custo = quantidade × último preço.
- **Recorrência** (`recorrencia.ts`, só sugere; nada é aplicado sozinho): `padraoSugerido` (meta digitada à mão, senão média por nota, senão meta atual; arredondado ao passo, mínimo um passo), `sugerirReporSempre` (não recorrente, ativo, 3 ou mais notas distintas), `sugerirDeixarDeRepor` (recorrente, já comprado, mais de 90 dias sem compra), `promoverARecorrente` (padrão diferente do sugerido trava `metaManual`) e `rebaixarDeRecorrente` (mantém padrão e histórico).
- **Operações** (`data/despensa.ts`): `definirQuantidade` (grava número e rótulo), `ajustarEstoque` (soma/subtrai, nunca abaixo de zero), `apagarCompraDesfazendoEstoque` (a tela mostra antes `efeitoDeApagarCompra`), `reporSempre`, `deixarDeRepor`. Modo compra: "Terminar sem nota" (`terminarSemNota`) soma o que foi pego e fecha a lista; "Terminar compra" segue para importar a nota (que soma). Usar os dois na mesma compra soma duas vezes (o diálogo avisa).
- **Tela `/despensa`** (`components/despensa/`, visão em `lib/despensaVisao.ts`): resumo (itens, zerados, menos da metade), filtros (Todos, Faltando, Zerados, Eventuais, Sem padrão), busca, agrupar por categoria ou local. **Card do item:** nome, `atual de padrão unidade`, selos de situação (texto, não só cor) e de recorrência, **−/+** no passo da unidade (gravam na hora), botões **Ajustar** e **Editar** e o interruptor **Repor sempre** (marcar abre a folha com o padrão sugerido; desmarcar tira da regra da lista). **Ajustar** (modal): quantidade exata, com o efeito na lista ("vai para a lista" / "não entra"). **Editar** (modal, montado só ao abrir): nome, categoria, unidade, quantidade padrão (com "Voltar ao cálculo automático" quando fixada à mão), local, mercado preferido, Repor sempre, **Preço e compras**, arquivar e mesclar. Sem atalhos Cheio/Metade/Acabando/Acabou (removidos: eram ações sem estado visível e geravam quantidades fracionadas). Frequência, tipo de ida, vida útil e "contável" **não são mais editáveis** (não afetam a lista; seguem guardados no item e nos backups). `Dialog` aceita `semRodape` (conteúdo com ações próprias). Possíveis duplicados e "Adicionar item" (`criarItemManual`, nasce **recorrente**) ficam na mesma tela.
- **Tela `/lista`**: **existe uma única lista** (a lista da casa), derivada da despensa; o que não foi comprado (não achou, estava caro, não tinha) simplesmente segue faltando e aparece de novo. `garantirListaDaCasa` usa a lista em compra (a mais recente) ou, sem ela, o rascunho mais antigo; **as demais listas abertas são do modelo antigo (por ida ou dividida entre mercados) e são fechadas**. `tipoIda` gravado na `Lista` é só compatibilidade. A lista é recalculada ao abrir a tela e preserva edições (`mesclarRegeracao`); **não há botão de regerar**. **"Compartilhar lista"** (`lib/textoDaLista.ts` + `compartilharTexto` em `lib/arquivos.ts`) abre o menu de compartilhar do sistema (Web Share) com o texto do que ainda falta, por seção (`• qtd unidade Nome (~valor)`, valor = quantidade × último preço pago, só quando há preço; a linha "Estimativa" do fim soma só os itens com preço e diz "N de M itens com preço" quando não são todos); sem suporte, copia para a área de transferência; desabilitado sem itens. Sem seletor de ida e **sem divisão da lista entre mercados** (removida em 06/11/2026: não faz sentido ter N listas). Continuam o aviso de ida pouco vantajosa e o agrupamento por mercado preferido.

### 6.3.0 Início (`inicio.ts`, tela `/`)

Abre com o **estado da despensa**: quantos itens faltam (recorrentes zerados ou abaixo do padrão, os que a lista da casa teria), quantos itens há, quantos zeraram e quantos itens **eventuais** acabaram (não vão para a lista), com atalhos **Ver lista** e **Abrir despensa**. A **próxima compra da agenda** é informação secundária (`proximaIdaGeral`, empate de data: feira primeiro) e **considera a compra já feita**: ida cuja data já tem nota importada passa para a seguinte do mesmo tipo. Lembretes: **nota pendente** (lista `em_compra` criada há mais de 1 dia, data de `criadaEm` no fuso de Recife), **estimativa de ida pendente** (mercado com compra sem `custoIdaCentavos`) e, com compras, **cópia de segurança** (`domain/backup.ts`: nunca houve cópia, 30 dias ou 5 notas desde a última). Despensa vazia e sem notas: boas-vindas com "Adicionar o primeiro item" e "Importar a primeira nota". Navegação: a barra tem Início, Despensa, Lista e Importar; o restante (Compras, Conferir despensa, Preços, Painel, Gastos, Mercados, Ajustes) fica no menu **Mais** (`lib/rotas.ts`; teclado: Esc ou toque fora fecha). `/catalogo` redireciona (permanente, em `next.config.ts`) para `/despensa`.

### 6.3.1 Modo compra (`compra.ts`, tela `/compra?lista=<id>`)

- Abrir a tela coloca a lista em `em_compra`. Cada toque persiste na hora (offline) e **lê o item gravado antes de alterar** (a tela pode ter cópia antiga; sem isso o preço salvo ao sair do campo se perdia ao tocar em "Peguei"). Status do item: `pendente` → `pego` (grava `quantidadePega`; tocar no ✓ desfaz), `nao_encontrado` (**"Não peguei"**: o item segue faltando e volta pela regra da lista; `adiado` é legado e vale o mesmo), `extra` (comprado fora da lista, já entra como pego).
- **Cards:** pendente = nome + quantidade (−/+) e **uma linha com dois botões de tamanho normal: Não peguei e Peguei** (sem campo de preço; o preço, opcional, se informa ao tocar no item já pego). Pego = **uma linha** de 44 px (tocar nela desfaz, como no "Não peguei"; o link "Editar" abre quantidade e preço; extra: tocar abre a edição; mostra `qtd · preço`). Não peguei = linha mínima **amarela** (token `aviso`, ícone ✕ e texto "Não peguei"; amarelo e não vermelho porque o vermelho é só de erro), desfaz ao tocar.
- **Ordem** (`ordenarParaCompra`, `ordenarSecoes`): dentro da seção, pendentes → pegos → não peguei. Seções com item pendente primeiro; depois as concluídas só com pegos; por último as concluídas com "não peguei". Cada seção mostra `pegos/total`. Quando nada está pendente (`compraResolvida`) aparece um cartão "Tudo resolvido" com "Terminar compra" no topo.
- `ItemLista.precoCentavos` é o **preço unitário** informado (opcional, nunca bloqueia). Total corrente = Σ `quantidadePega (ou sugerida) × preço` dos itens `pego`/`extra` com preço. Orçamento opcional por lista (`Lista.orcamentoCentavos`): aviso a partir de 90%, alerta ao passar de 100%. Cabeçalho fixo compacto: total, progresso e barra.
- A tela mantém a tela acesa pela Screen Wake Lock API quando existe (`lib/wakeLock.ts`, silencioso sem suporte). Dois caminhos ao terminar: "Terminar compra" → `/importar?lista=<id>` (a nota soma e reconcilia) ou "Terminar sem nota" (soma o que foi pego).

### 6.4 Reconciliação (`reconciliacao.ts`)

Casa itens da nota com `ItemLista` por `produtoId` (resolvido pelo apelido na importação); avulsos e extras casam pelo nome contido na descrição da nota; itens removidos da lista são ignorados. Três grupos: **comprado**, **ficou de fora** (permanece pendente para a próxima ida) e **fora da lista**. Item fora da lista em ida de reposição (mercado semanal ou hortifruti semanal) conta como **compra de emergência**; na feira mensal não.

`finalizarCompra(repos, compra, listaId?)` (em `data/reconciliacao.ts`) roda depois de `salvarNotaImportada`:

- **Sempre** (com ou sem lista): a quantidade comprada **soma** ao estoque (`aplicarCompra`; `nivel` vira o rótulo pelo padrão). Reimportar a mesma nota soma só a diferença (`anterior`); nota mais antiga que a última confirmação do estoque não altera nada. Itens novos nascem **não recorrentes**; a conferência da importação mostra "o que vai mudar na despensa" e oferece, por item, "Repor sempre" (`reporSempre`) e "Não é da despensa" (`ignorar`: fica só na nota).
- **Com lista** (**só a do `?lista=`**, que vem do botão "Terminar compra" do Modo compra; sem o parâmetro nenhuma lista vem marcada, e a conferência mostra "Esta nota será ligada à lista de …" ou "não está ligada a nenhuma lista"; o usuário pode trocar ou desassociar. Comprar fora da lista não fecha nem reconcilia lista alguma; o item some da lista da casa quando a despensa volta ao padrão): itens comprados ganham `status: pego`, `quantidadePega` e `precoCentavos` da nota; a compra recebe `listaId`; a lista vira `fechada` com `gastoCentavos`. Lista já fechada por outra compra não é reprocessada.
- Itens que ficaram de fora **voltam na próxima lista do mesmo tipo** (`garantirLista` traz as pendências da última lista fechada, mesmo que a cobertura não as incluísse).
- Itens fora da lista **não** são criados como itens: o resumo é recalculado (`resumoDaLista`) a partir da lista e da compra ligada. Todos os itens da nota já viram produto do catálogo na importação (C-21), então não há "oferecer criar produto".
- Tela Compras: cada compra tem **Abrir SEFAZ** (copia a chave guardada e abre a consulta pública; o captcha continua com a pessoa) ao lado de **Apagar compra**.
- Tela `/resumo?lista=<id>`: comprado, faltou, fora da lista (com selo de emergência), total gasto contra a estimativa e, quando houver (C-28), custo da ida e custo real (`itens + ida`); sem custo da ida mostra "estimativa pendente".

### 6.5 Custo da ida (`ida.ts`)

- **`Mercado.distanciaKm` e `tempoMinIda` são de IDA** (casa → mercado). O custo e o tempo total usam ida e volta (×2): `custoIdaDoMercado(mercado, perfil)`. `custoIda({ meio, kmIdaVolta, perfil, custoFixoCentavos })` recebe km de ida e volta. O custo fixo (estacionamento) vale só para o carro. `estatisticasDeIdas(compras, mercados, ano, mes)` conta idas e minutos (informação; nunca vira dinheiro) e soma `custoIdaCentavos` das compras.
- **Tipos de mercado** (`TIPOS_MERCADO`): hortifruti, supermercado, atacarejo, padaria, açougue, lanchonete, farmácia, conveniência, feira, outro; `sugerirTipoMercado` reconhece pelo nome (padaria, pizzaria, drogaria…). Salvar o mercado em Mercados chama `aplicarCustoNasCompras`: as compras dele sem custo da ida passam a ter (senão o lembrete "falta estimar" da tela Início nunca sumia).
- **Meio de transporte por compra:** `Compra.meio` (`carro`, `bike_eletrica`, `a_pe`; a pé custa R$ 0). **É perguntado em toda importação**, mesmo com a distância do mercado já conhecida (o mesmo mercado pode ser visitado de carro, bike ou a pé); o cartão mostra "Última vez: …" mas nunca preenche sozinho. `registrarIdaDaCompra` grava meio e `custoIdaCentavos` na compra; o mercado guarda só o último meio. "Decidir depois" deixa a compra sem custo (o lembrete da tela Início continua). Em Mercados, o transporte/distância servem de padrão para compras antigas sem meio.
- **Estimativa ao importar (C-28)**: `estimarMercado(repos, mapas, mercadoId, meio, { online })` geocodifica o endereço da nota pelas variantes de `lib/endereco.ts` (1 consulta por segundo, para na primeira que achar; só bairro = **aproximado**), guarda as coordenadas no `Mercado` (cache: nunca geocodifica duas vezes) e calcula a rota desde a casa (bike: perfil `routed-bike`; se o serviço não tiver, carro × 1,12 e 15 km/h). `confirmarEstimativa` grava meio, distância e tempo no mercado e `custoIdaCentavos` nas compras dele que ainda não têm (RN-10; aparece em Compras e no Resumo). Mercado já com distância: a nota seguinte entra direto, sem perguntar. Sem casa, sem internet (`navigator.onLine`), endereço não achado ou serviço com erro: **nunca bloqueia**: o cartão "Quanto custou a ida?" oferece informar km e minutos à mão ou "Decidir depois" (refazer em Mercados → "Estimar pelo endereço"). Ao Nominatim vai só o texto do endereço do mercado; às rotas, só coordenadas (a casa já fica arredondada se `arredondarLocalizacao`). **Testes e2e usam o serviço simulado (`page.route`); nunca o real.**
- **Apagar todos os dados** (Ajustes → Zona de perigo, `ApagarTudo.tsx`, `data/apagarTudo.ts`): explica o risco e mostra o que será perdido (compras, produtos, mercados, listas), oferece guardar cópia na hora, e exige checkbox "Entendi" + digitar `APAGAR`. `apagarTodosOsDados` usa `restaurar(vazio, "substituir")` (uma transação) e recria a casa com o seed; o tema (localStorage) fica.
- **Casa (`Perfil.localizacaoCasa`)**: "Estou em casa agora" chama `getCurrentPosition` uma única vez (sem alta precisão), com opção de arredondar a 3 casas (`arredondarLocalizacao`, padrão ligado; o valor arredondado é o que fica guardado) e alternativa de colar coordenadas (`-8.0631, -34.8711`, ponto decimal). `tests/seguranca-estatica.test.ts` falha se aparecer `watchPosition`, `innerHTML`, `eval`, `confirm/alert/prompt`, rota de API ou IndexedDB fora de `src/data/indexeddb`.

- Carro: `km × (precoCombustível ÷ consumoKmPorLitro + desgastePorKm) + custoFixo`.
- Bike elétrica: `km × custoPorKm`.
- `km` é ida e volta. Resultado em centavos, arredondado ao centavo. **Tempo não entra no cálculo** (só dinheiro); tempo e número de idas são apenas exibidos.
- `custoRealCompra = totalItens + custoIda`.

### 6.6 Preços e comparação (`precos.ts`, `comparacao.ts`, `economia.ts`)

- `precoNormalizado(item)` (`precos.ts`): `KG` → R$/kg; `L` → R$/l; embalagem com tamanho → R$/100 g ou R$/100 ml (`PCT 180` sem medida = gramas; `LEITE 1L` → 100 ml); `CX 12` → R$/un; o resto → R$/un. `historicoPorProduto` agrupa por produto + **base** (embalagens diferentes do mesmo produto se comparam), com último, anterior, variação (mostrada se ≥ 0,5%), menor, maior e média, tudo normalizado. `mediaDoUsuario(pontos, { hoje, dias })` aceita janela. A tela `/precos` mostra o gráfico de linha em SVG próprio (`lib/grafico.ts` + `GraficoPreco`, sem biblioteca). O Backup fica em Ajustes.

- Comparar sempre por **preço normalizado**: `KG` → centavos/kg; `UNID` → centavos/unidade; embalagem com tamanho (ex.: `PCT 180`) → centavos por 100 g ou por unidade de medida.
- Alerta de preço (`alertaDePreco`, `alertasPorProduto`): último preço normalizado acima da **média das compras anteriores** em **mais que** `limiarAlertaPrecoPct` (padrão 20; exatamente no limiar não alerta) **e** pelo menos 3 compras no histórico. Também há aviso discreto "abaixo da média" quando está mais que o limiar abaixo. Selo na lista e no modo compra (`SeloPreco`); o limiar é editável em Ajustes.
- Melhor mercado (`melhorMercadoPorProduto`): menor preço normalizado **mais recente por mercado**, dentro da janela `Perfil.janelaPrecoDias` (padrão 60, editável em Ajustes; 60 dias é inclusivo). Empate é sinalizado. Cesta (`custoDaCesta`): produtos ativos com meta × último preço no mercado; informa a cobertura ("preços de N de M itens"). `sugerirMercadoPreferido`: com preços de ≥ 2 mercados, sem empate, melhor ≠ preferido atual e mais barato que o limiar de 10% (contra o preferido, ou contra a média dos outros); **nunca troca sozinho**: a tela Preços → Comparar oferece o botão.
- `economiaLiquida = economiaDePreço − custoDaIdaExtra` (`economia.ts`). (**divisão de lista: sem uso na interface desde 06/11/2026; só resta a função no domínio**) `proporDivisao` avalia cada mercado alternativo **com custo de ida conhecido**: soma a economia dos itens que lá são mais baratos que no mercado habitual (economia percentual normalizada aplicada ao gasto no habitual) e desconta a ida extra; só propõe se o líquido for positivo **e** ≥ `Perfil.economiaMinimaDivisaoCentavos` (padrão R$ 5,00), escolhendo a melhor alternativa. Mercado habitual = o da agenda da ida (`AgendaIda.mercadoId`), senão o mais usado (`mercadoHabitual`). `dividirLista` cria uma segunda lista (mesma ida, `Lista.mercadoId` do alternativo) e **move** os itens (nada se perde); regerar a original não traz de volta o que está na lista irmã. Bike elétrica (custo ~0) tende a propor.
- Aviso de ida pouco vantajosa (`avisoIdaPoucoVantajosa`, mostrado na lista quando o custo da ida do mercado habitual é conhecido): custo da ida ≥ 40% do total estimado (exatamente 40% avisa), ou menos de 5 itens; limites parametrizáveis. Texto: "Esta ida tem N itens, R$ X, e custa R$ Y para ir e voltar. Dá para esperar a feira mensal?".
- Gastos (`gastos.ts`, tela `/gastos`): `gastosPorMes` (itens por categoria; item sem produto → `outros`; deslocamento = Σ `custoIdaCentavos`; custo real = itens + deslocamento). **Inflação pessoal** (`inflacaoPessoal`, `serieDeInflacao`): variação do custo de uma **cesta fixa** = só produtos comprados nos dois meses **na mesma base de preço**; preço = média normalizada do mês; quantidades do mês base mantidas (equivale à média dos reajustes ponderada pelo gasto do mês base), então comprar mais ou menos de um produto não distorce. Gráficos em SVG próprio (`GraficoSerie`).

### 6.6.1 Painel do objetivo (`painel.ts`, tela `/painel`)

Métricas do mês contra o mês anterior, com tendência (▼ melhorou, ▲ piorou) e texto curto: **idas** (por tipo da lista; compra sem lista = "sem lista"), **compras de emergência** (itens fora da lista em ida de reposição, via `reconciliar`), **rupturas** (= produtos marcados "acabou" na conferência que ainda não estavam acabados, gravados em `RegistroConferencia.rupturas`, **mais** as emergências), **tempo médio de conferência** (meta < 3 min), **% de itens já no catálogo** (`Compra.itensCasados`, contados na importação: apelido que já existia; reimportar a mesma nota mantém o valor da 1ª vez; meta > 90%), **gasto com deslocamento** e **minutos em idas** (só informação). Sem compras mostra orientação, nunca zeros enganosos; métrica sem dados aparece como "—".

### 6.7 Catálogo (`categorias.ts` e fluxo de importação)

- **Normalização de nomes (`domain/normalizacao.ts`, sem IA):** `normalizarDescricao(descricao)` devolve `{ nome, chave, palavras, tamanho }`: minúsculas, sem acento nem pontuação, artigos (`de`, `da`, `do`...) fora da chave, palavras sem ordem, e o tamanho extraído e canônico (`500g`, `500 g`, `500GR`, `0,5kg` → `500g`; `1 LT` → `1l`; `1,5kg`). Sufixos da nota (`PCT 180`, `UN`, `KG` no fim) saem do nome (o tamanho da embalagem para preço continua vindo de `extrairEmbalagem` sobre a descrição do item da compra). `chaveDeProduto(nome)` é a **identidade do produto**: nomes só diferentes em caixa, acento, ordem, espaços ou escrita do tamanho têm a mesma chave e viram **um** produto (inclusive produtos antigos digitados à mão). Tamanho faz parte da identidade (`Maionese Liza 500g` ≠ `Maionese Liza 400g` ≠ `Maionese Liza`). `chaveDeNome` (caixa/acento) segue para busca e reconciliação.
- **Parecidos (só sugestão):** `produtosParecidos(nome, produtos)` lista até 3 produtos ativos com mesmas palavras e tamanho diferente/ausente (`motivo: tamanho`) ou com 2 de 3 palavras em comum (Jaccard ≥ 0,66, `motivo: parecido`); marcas diferentes (`Maionese Helmaz` × `Maionese Liza`) **não** são sugeridas. Na conferência de importação, item `novo` mostra "Usar “…”" por parecido; escolher só troca o nome do campo (a ligação mercado + código → produto é gravada ao salvar). Nada une sozinho além de chave igual. `sugerirMesclagens(produtos, compras)` alimenta a tela **Catálogo → Possíveis duplicados** (pares `igual` / `tamanho` / `parecido`, destino sugerido = o mais comprado), que só mescla (`mesclarProdutos`) após diálogo de confirmação e aviso para fazer backup.
- IA para esse problema, análises com IA e treino do OCR estão **adiados** (`docs/pos-mvp.md`); qualquer uso exige backend e decisão registrada aqui (regras 2 e 3 da seção 13).
- **Tamanho da embalagem (opção A):** o tamanho faz parte da identidade do produto (Coca 2l ≠ Coca 350ml). Na conferência, item por `UNID`/`PCT` cujo nome não traz tamanho (`faltaTamanho`) mostra o campo "Tamanho da embalagem" (aceita `2l`, `350ml`, `200g`, `1,5kg`; `lerTamanhoDigitado`), com atalhos pelos tamanhos de produtos de mesmas palavras; digitar reescreve o nome (`Nome 2l`), o que resolve para outro produto. "Vendido por unidade" (ovo, pizza) grava `Produto.vendidoPorUnidade` e não pergunta mais. `ItemCompra.tamanho` guarda o tamanho do nome no momento da importação e **vence a descrição da nota** em `precoNormalizado` (R$/100 ml ou R$/100 g). Compras antigas não mudam; reimportar a nota (substituir) aplica o tamanho.
- Importação (`data/importarNota.ts`): o nome do produto de cada item é resolvido por `chaveDeProduto` (ver acima); se existir, reutiliza o produto, senão cria (nome sugerido = `normalizarDescricao(descricao).nome`). O apelido `cnpj + código → produto` é regravado a cada importação. Nota com a mesma chave só é salva com `substituir`. Estoque e metas por média entram nas C-21/C-26.

- Produto nasce das notas. `unidade`: `KG` → `kg`, `UNID` → `un`, `PCT` → `pacote`, `L` → `l`. Categoria: mercado de hortifruti → `hortifruti`; senão palavras-chave em `categorias.ts` (da mais específica à mais geral; palavra-chave com espaço no fim casa a palavra inteira, sem espaço casa o começo da palavra); padrão `outros`. Tipo de ida: hortifruti → `hortifruti_semanal`, o resto → `mercado_semanal`.
- `meta` inicial = média da quantidade comprada por compra; atualizada a cada compra enquanto `metaManual` for falso.
- Vida útil padrão (dias): hortifruti 7, laticínios 10, carnes 3, mercearia 180, limpeza 365, higiene 365, bebidas 90, outros 90.
- Sugestão (nunca automática), `sugestaoDeTipoDeIda`: produto durável (`vidaUtilDias` > 14), ativo e que não é de feira mensal, comprado em 3 ou mais **semanas civis (segunda a domingo) seguidas** → sugerir `feira_mensal`; a interface mostra a sugestão com botão para aplicar.
- Meta automática (`metaAutomatica`): média da quantidade por compra (itens do mesmo produto na mesma nota somam), recalculada a cada importação enquanto `metaManual` for falso. Editar a meta à mão (`salvarProdutoEditado`) trava; `liberarMetaAutomatica` destrava. Mesclar (`mesclarProdutos`) move apelidos, itens de compra, itens de lista e **soma o estoque** dos dois (Coca 1 + Coca 1 = 2; vale a confirmação mais recente) e apaga a origem.

### 6.8 Valores padrão (editáveis em Ajustes: `/ajustes`, formulários validados por `lib/formAjustes.ts`)

**Layout de Ajustes:** cards com valor definido ficam **fechados** e mostram só o resumo, com **Alterar**. Localização da casa e cada ida da agenda derivam o estado dos dados (sem coordenada ou sem agenda: aberto; definido: fechado; salvar fecha sozinho; remover pede confirmação). Regras e Custo da ida são `Details` recolhíveis com resumo no título e o próprio botão Salvar, que fecha ao concluir. Aparência é um seletor de 3 opções numa linha. Nos e2e, abra seções com `abrirSecao` (`e2e/util.ts`).

Folga 2 dias; alerta de preço 20%; carro 10 km/L, combustível R$ 6,00, desgaste R$ 0,30/km; bike elétrica R$ 0,05/km; (economia mínima para dividir lista, sem uso na interface, R$ 5,00).

---

## 7. NFC-e: especificação técnica

### 7.1 Chave de acesso (44 dígitos)

| Posição | Campo                                                      |
| ------- | ---------------------------------------------------------- |
| 1-2     | UF (26 = PE)                                               |
| 3-6     | AAMM                                                       |
| 7-20    | CNPJ do emitente                                           |
| 21-22   | modelo (65 = NFC-e)                                        |
| 23-25   | série                                                      |
| 26-34   | número                                                     |
| 35      | tpEmis (1 ou 9 aceitos)                                    |
| 36-43   | código numérico                                            |
| 44      | DV, módulo 11 com pesos 2 a 9 (da direita para a esquerda) |

Uma chave só é considerada válida se: 44 dígitos, DV correto, CNPJ válido, modelo 65, UF conhecida, ano entre 2019 e 2040, mês 1 a 12 e tpEmis 1 ou 9.

### 7.2 QR Code

`keyFromQR(texto)` extrai a chave de URLs v1 (`chNFe=`) e v2 (`?p=chave|2|1|1|hash`). QR de PE aponta para `nfce.sefaz.pe.gov.br/nfce/consulta?p=…`.

### 7.3 Reparo de leitura por OCR (`chaveDoOCR`)

Escalonado; para na primeira etapa com resultado: (1) janela exata de 44 dígitos; (2) um dígito a mais ou a menos; (3) uma troca por confusão de OCR; (4) duas trocas, só se sobrarem no máximo 3 candidatas (prefere CNPJ conhecido). Confusões: 0→8,6 · 1→7 · 2→7 · 3→8,5 · 4→9 · 5→6,3,9 · 6→5,8,0 · 7→1,2 · 8→0,3,6,9 · 9→8,4,0 (5→9 acrescentado: o OCR leu 5 onde a nota pontilhada real tinha 9; só entram confusões observadas). Retorno: `exata`, `candidatas` ou `vazio`/`ambíguo`. **Nunca** devolver como exata uma chave que não passou em todas as validações do 7.1. A interface nunca preenche sozinha a partir de candidatas: o usuário escolhe. Sem candidata, `lerChaveDaFoto` pode devolver `{ vazio, aproximada }` (`leituraAproximada`: a linha com 36 a 52 dígitos mais próxima de 44, com os grupos como o OCR os leu): a tela mostra essa leitura **sem preencher o campo** e só a leva ao campo se o usuário tocar em "Usar para corrigir"; grupos com ≠ 4 dígitos são destacados. A chave só segue quando passa em todas as validações do 7.1. Para uma chave digitada ou corrigida com 44 dígitos e DV inválido, a tela oferece `correcoesDeUmDigito` (trocas de 1 dígito pela mesma tabela, que tornam a chave válida), rotuladas por grupo e dígito ("Grupo 11, dígito 4: trocar 8 por 0") para o usuário conferir no papel; nunca aplicadas sozinhas. Uma chave **impressa** inválida existe: nota emitida em contingência (`tpEmis 9`) saiu com DV errado e a própria SEFAZ a recusa ("Dígito verificador da chave inválido", conferido em 05/11/2026). O app **não** relaxa o DV (a regra concorda com a SEFAZ); a tela avisa que a nota está com a chave inválida e que é preciso pedir nova via ao estabelecimento.

### 7.4 Acesso à nota

Consulta pública de PE: `https://nfce.sefaz.pe.gov.br/nfce-web/consNfce`, protegida por reCAPTCHA. **O app não contorna o captcha.** (O QR Code do cupom é outro caminho, legítimo: ver 5.5.) Fluxo: o app copia a chave e abre a página; o usuário resolve o captcha; o texto resultante é colado (ou recebido por Compartilhar) e lido pelo parser. A SVRS exige certificado ICP-Brasil e não é usada.

### 7.5 Parser (`parser.ts`)

- Entrada: texto copiado da página da SEFAZ. Saída: `{ nota, avisos, erros }` validada por Zod.
- Item: `DESCRIÇÃO(Código: N)` + `Qtde.: x  UN: KG|UNID|L|PCT  Vl. Unit.: y` + `Vl. Total z`. O código é interno do mercado (PLU), **não é EAN**.
- Conferências: soma dos itens × valor a pagar (tolerância R$ 0,05); contagem × "Qtd. total de itens"; `qtd × unitário ≈ total` (R$ 0,02); CNPJ e número do texto × chave. **Erros impedem salvar; avisos não.**
- Tolerar espaços extras, quebras de linha, NBSP e milhar com ponto.
- Saída em centavos (`valorUnitarioCentavos`, `valorTotalCentavos`, `valorPagarCentavos`, `somaItensCentavos`); `unidade` ∈ `KG|UNID|L|PCT` (`UN`/`UND` → `UNID`; unidade desconhecida gera aviso e vira `UNID`). `suggestName` e `extrairEmbalagem` ficam no `parser.ts`; `PCT 180` devolve `{ tipo: 'pct', tamanho: 180 }` sem `medida` (a C-31 assume gramas).
- Fixtures de nota: `tests/fixtures/notas/*.txt`; o teste do parser roda sobre todas as que existirem.
- **Nunca persistir CPF.** Se o texto contiver CPF, apenas sinalizar `cpfNaNota`.
- Fixture de referência: nota Cia Santos, 16 itens, total R$ 77,24, chave `26261108868231000638650020000689031020778720`, sem erros nem avisos.

### 7.6 Leitura por câmera e imagem

- QR: `BarcodeDetector` quando existir; senão `jsqr` em 3 escalas (1600/1000/640) com `inversionAttempts: 'attemptBoth'`. Câmera traseira pedindo 1920×1080 ideal e foco contínuo quando houver (o padrão do Android é 640×480, pouco para o QR do papel térmico), quadro a cada ~350 ms, dica de uso após 8 s sem leitura, **parar o stream** ao ler, fechar ou sair da tela. **Foco:** `ligarFocoContinuo` lê `getCapabilities().focusMode` e só diz "ligado" se `applyConstraints` aceitou (a tela mostra o estado: contínuo, manual ou indisponível); toque na imagem ou botão **Focar** chama `refocar` (foco pontual e volta ao contínuo); **Tirar foto** abre a **câmera do sistema** (`<input capture>`, que foca bem; o app lê o QR ou a chave da foto), **Escanear QR** abre a câmera do app, e nela, quando o foco contínuo não está ligado, aparece "A câmera não foca? Usar a câmera do celular"; **Fotografar** (na câmera do app) usa `ImageCapture.takePhoto()` (resolução máxima, com foco) ou, sem suporte, o quadro do vídeo; se a câmera não abrir, cai no `<input capture>` do sistema. **Várias lentes:** o Chrome do Android abre a lente "environment" que escolher, e em muitos celulares é a grande-angular, sem autofoco (o aviso "o app não consegue controlar o foco" é o sintoma; não é culpa do PWA, que usa a mesma câmera do Chrome). `abrirCameraComFoco` testa as outras câmeras traseiras (`enumerateDevices`) e fica com a primeira que confirma foco contínuo; o botão **Trocar câmera** percorre as lentes; a lente que leu um QR é lembrada (`gravarCameraPreferida`) e a próxima abertura vai direto nela (se sumir, volta à busca normal). Em iOS/Safari o foco não é controlável pelo navegador.
- OCR: Tesseract.js 5 em worker, carregado **por import dinâmico** apenas quando usado. Assets em `/vendor/tesseract/` (worker, core LSTM e SIMD, `eng.traineddata.gz`). Whitelist `0123456789 `, PSM 6, até 3 tentativas de pré-processamento (cinza/contraste 1800 px; Otsu 1800 px; cinza/contraste 2600 px). Sempre `worker.terminate()` no `finally`.
- Imagem → canvas respeitando orientação EXIF, lado máximo 2200 px.
- Arquivos: `lib/qr.ts` (`lerQR`, `iniciarScanner`), `lib/ocr.ts` (`lerChaveDaFoto`, com `DependenciasOCR` injetável para teste), `lib/preprocessamento.ts` (funções puras sobre pixels: cinza, contraste, Otsu, `TENTATIVAS_OCR`), `lib/imagem.ts`. `jsqr` e `tesseract.js` entram por import dinâmico (fora do bundle inicial). O worker, o core (`tesseract-core-lstm.wasm.js` e `-simd-`) e `eng.traineddata.gz` vêm de `node_modules` via `scripts/copy-vendor.mjs` (que falha o build com mensagem clara se faltar arquivo).

---

## 8. PWA e offline

- `public/manifest.webmanifest` estático: `display: standalone`, `lang: pt-BR`, `start_url` e `scope` `/`, ícones 192, 512 e maskable, `share_target` `GET` para `/importar` com `params { title, text, url }`.
- `public/sw.js` manual (sem plugin), cache versionado `despensa-vN`:
  - `/_next/static/*` e ícones: cache primeiro.
  - Navegação (HTML) e requisições RSC (`?_rsc=`): rede primeiro, cache como reserva. Falha de RSC offline devolve erro para o Next fazer navegação completa, atendida pelo HTML em cache.
  - `install`: pré-cache das rotas listadas em `src/lib/rotas.ts` e dos estáticos do build. `skipWaiting` + `clients.claim`; `activate` apaga caches antigos.
  - `/vendor/tesseract/*` (~11 MB): **não** pré-cachear; cache sob demanda no primeiro uso.
- Pré-cache: `npm run build` roda `scripts/gen-precache.mjs` depois do `next build`, que escreve `public/precache.json` (não versionado) com as rotas (HTML em `.next/server/app`) e os estáticos. Rota nova precisa ser pré-renderizada para entrar; **rotas dinâmicas (`[id]`) não são pré-renderizadas: use rota estática com parâmetro na query** (ex.: `/compra?lista=<id>`) para funcionar offline.
- Navegação: rede primeiro com limite de 4 s, depois cache; a chave do cache é o caminho sem query (`/importar?text=…` usa o HTML de `/importar`). RSC (`?_rsc=`) não é cacheado: offline devolve erro e o Next faz navegação completa (o log "Failed to fetch RSC payload… Falling back to browser navigation" é esperado).
- Registro: `RegistrarSW` (em `layout.tsx`) registra `/sw.js?v=<NEXT_PUBLIC_BUILD_ID>` (o parâmetro muda a cada build e força a instalação do SW novo) só em produção ou `localhost`. O SW usa `skipWaiting`; ao trocar de controlador a interface mostra "Nova versão disponível" com botão Atualizar.
- Alterou rota, asset ou estratégia: incremente a versão do cache (hoje `despensa-v3`; `theme-init.js` entra no pré-cache).
- Funcionalidades que dependem de rede (mapas) degradam sem bloquear (ver seção 9.4).

---

## 9. Segurança

### 9.1 Headers (fonte única: `src/lib/security-headers.ts`, aplicados em `next.config.ts` para `/:path*`)

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(), geolocation=(self)
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://nominatim.openstreetmap.org https://routing.openstreetmap.de;
  worker-src 'self' blob:;
  frame-src 'none'; frame-ancestors 'none'; object-src 'none';
  base-uri 'self'; form-action 'self'
```

### 9.2 Exceções ao padrão e justificativa

| Exceção                              | Motivo                                    |
| ------------------------------------ | ----------------------------------------- |
| `camera=(self)`                      | leitura de QR e foto da nota              |
| `geolocation=(self)`                 | captura única da posição de casa          |
| `'unsafe-inline'` em `script-src`    | scripts de hidratação inline do Next      |
| `'wasm-unsafe-eval'`                 | WebAssembly do Tesseract                  |
| `worker-src blob:` e `img-src blob:` | worker do OCR e prévia de imagem          |
| `connect-src` com `nominatim.openstreetmap.org` e `routing.openstreetmap.de` | geocodificação do endereço do mercado e rota, direto do navegador (sem chave; ver `docs/spike-mapas.md`) |

Qualquer nova origem ou diretiva exige entrada nesta tabela e atualização do teste de headers.

### 9.3 Regras de código

- Nunca usar `innerHTML`, `dangerouslySetInnerHTML` ou `eval`. Texto vindo da SEFAZ, de QR ou de backup é sempre renderizado como texto pelo React.
- Nunca usar `window.confirm/alert/prompt`; usar o componente de diálogo próprio.
- `localStorage` só para a preferência de tema (`despensa-tema`) e a câmera que já leu um QR (`despensa-camera`, `lib/qr.ts`: id do dispositivo, específico do aparelho, fora do backup); dados do usuário vão sempre pelo repositório (IndexedDB).
- Nunca persistir CPF, dados de cartão ou o texto bruto da nota.
- Nunca usar `watchPosition` nem rastrear localização. Capturar posição apenas sob ação explícita do usuário, uma vez.
- Segredos não existem no cliente. Variáveis `NEXT_PUBLIC_*` são públicas por definição; só colocar valores que possam ser públicos.
- Toda entrada externa (backup, texto colado, resposta de API de mapas) é validada com Zod ou parser com tratamento de erro.

### 9.4 Privacidade

Dados ficam no aparelho. O endereço e a posição de casa **não** são enviados a nenhum serviço; ao serviço de mapas vão apenas coordenadas e o endereço do mercado (que vem da nota). A posição de casa pode ser armazenada arredondada (3 casas decimais ≈ 100 m). **A lista de compras só sai do aparelho quando a pessoa toca em "Compartilhar lista" e escolhe o destino no menu do sistema (texto com nomes, quantidades e o valor estimado pelo último preço pago; sem endereço, mercado ou dados da nota).** **A cópia de segurança leva a posição de casa por padrão** (opção de omitir) e só sai do aparelho por escolha do usuário (menu de compartilhar ou download); o app não envia o arquivo a nenhum serviço. Envio direto ao Google Drive e senha no arquivo estão no pós-MVP (`docs/pos-mvp.md`) e exigem decisão registrada aqui (regras 2 e 3 da seção 13).

---

## 10. Infraestrutura e deploy

### 10.1 Variáveis

| Variável               | Onde                              | Uso                                                |
| ---------------------- | --------------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | build (ARG), secret do GitHub     | URL pública do site                                |
| `NEXT_PUBLIC_MAPS_KEY` | build (ARG), secret do GitHub     | **sem uso** com Nominatim + OSRM (não exigem chave); reservada se o serviço for trocado |
| `NODE_ENV`             | runtime (`.env` na VPS)           | `production`                                       |
| `DOMINIO`              | `.env` na VPS (lido pelo compose) | host usado nas regras do Traefik; não é versionado |

`.env.example` lista todas, sem valores reais. `.env` nunca é versionado.

### 10.2 Docker

- `Dockerfile` multi-stage. `builder`: `node:22-alpine`, `ARG NEXT_PUBLIC_SITE_URL` (e `NEXT_PUBLIC_MAPS_KEY` se existir), `npm ci`, `npm run build`. `runner`: `NODE_ENV=production`, `PORT=3000`, usuário `nextjs` (uid 1001), copia `.next/standalone`, `.next/static` e `public` (incluindo `public/vendor`), `CMD ["node","server.js"]`. Não rodar como root.
- `docker-compose.yml` (VPS): `image: despensa-web:latest`, `container_name: despensa-web`, `restart: unless-stopped`, `env_file: .env`, rede externa `web`, limites de memória 256 MB e CPU 0,25 (reserva 64 MB), labels do Traefik (router HTTPS com `certresolver=le`, porta 3000, redirect permanente HTTP→HTTPS).

### 10.3 CI/CD

- `ci.yml` (pull request): `npm ci`, lint, typecheck, test, build, e2e (Chromium do Playwright), upload do relatório.
- `deploy.yml` (push na `main`): job `qualidade` (lint, typecheck, test, build) → job `deploy`: `docker build` com build-args, `docker save despensa-web:latest | gzip | ssh deploy@VPS "gunzip | docker load"` (a imagem **não** passa por registry), então SSH em `/opt/docker/despensa-web` executando `set -euxo pipefail; docker compose up -d --force-recreate --remove-orphans; docker image prune -af`.
- Secrets do GitHub: `NEXT_PUBLIC_SITE_URL`, `VPS_HOST`, `VPS_USER` (`deploy`), `VPS_SSH_KEY`, e `NEXT_PUBLIC_MAPS_KEY` se aplicável. A chave SSH é escrita em arquivo temporário com permissão 600 e removida ao fim.
- O job `qualidade` barra o deploy quando lint, tipos, testes ou build falham (acréscimo ao Padrão B). O `ci.yml` (PR) roda o mesmo e acrescenta ffmpeg, Chromium e e2e; o `deploy.yml` usa `concurrency` para nunca rodar dois deploys ao mesmo tempo.
- A `main` deve estar sempre estável: todo push nela publica.

### 10.4 Servidor

Diretório `/opt/docker/despensa-web` (dono `deploy`), `.env` com permissão 600, Traefik + Let's Encrypt, Cloudflare com proxy ativo, monitoramento no Uptime Kuma. Rollback e comandos operacionais em `docs/deploy.md`.

---

## 11. Convenções de código e processo

### 11.1 Código

- TypeScript `strict`. Tipos de entidades derivados dos schemas Zod (`z.infer`); não duplicar tipos à mão.
- Funções de domínio puras, pequenas, com entrada e saída tipadas. Sem efeitos colaterais, sem `Date.now()` ou `new Date()` direto (usar parâmetro `hoje` ou `hojeRecife()`).
- Componentes: um por arquivo, nomes em PascalCase, props tipadas. Classes Tailwind compostas com `clsx` + `tailwind-merge` (helper `cn`).
- Imports com alias `@/…`. Sem imports circulares entre camadas.
- Tailwind 3.4: tokens semânticos de tema (seção 5.4 e `docs/design.md`); sem cores hexadecimais nos componentes.
- Mobile-first: viewport de referência 390×844 (mínimo 360×640), coluna de até 40rem centralizada; alvos de toque ≥ 44 px; foco visível; rótulos acessíveis; contraste AA nos dois temas (verificado por `tests/lib/contraste.test.ts` e e2e); sem rolagem horizontal.
- Textos de interface em pt-BR. Datas `dd/mm/aaaa`, hora `HH:mm`, moeda `R$ 1.234,56`.

### 11.2 Git

- Branches `tipo/descricao-curta`. Commits no formato `tipo(escopo): descrição` (`feat`, `fix`, `test`, `chore`, `docs`, `refactor`).
- Merge na `main` por squash e somente com CI verde.
- Nenhum segredo, CPF ou dado pessoal real em commits (conferir `git diff`).

### 11.3 Testes

- **Vitest** (`tests/`, espelha `src/`): toda regra de `src/domain` com testes tabelados, incluindo bordas (zero, vazio, mês curto, ano bissexto, limites de tolerância). Relógio sempre injetado. Repositórios testados com `fake-indexeddb`, incluindo migração e backup ida e volta.
- **Playwright** (`e2e/`): roda contra `next start` para exercitar CSP e service worker. Câmera simulada com flags do Chrome (`--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, `--use-file-for-fake-video-capture`). Falha o teste se aparecer violação de CSP no console. Cobre offline (navegar e recarregar todas as rotas). Helpers de semente em `e2e/util.ts`: `prepararDespensa` (todos os itens recorrentes e zerados, via IndexedDB, para testes que dependem da lista da casa) e `envelhecerEstoques` (itens sem confirmação há meses, para a revisão); os fluxos de tela têm testes próprios (`despensa.spec.ts`). `backup.spec.ts` cobre guardar (download e menu de compartilhar simulado), lembrete, restaurar em aparelho vazio e com dados, as confirmações duplas e arquivos adulterados, cortados ou de versão nova; use o helper `restaurarBackupPelaTela` (`e2e/util.ts`) para carregar dados de seed. Acessibilidade roda nos dois temas e em 360×640 (`acessibilidade.spec.ts`); `tema.spec.ts` cobre Claro/Escuro/Sistema, persistência e a coluna em telas largas. O contraste dos tokens é testado em Vitest (`tests/lib/contraste.test.ts`).
- E2E: `e2e/global-setup.ts` gera o vídeo falso da câmera (`test-results/camera-qr.y4m`, a partir de `tests/fixtures/fotos/qr-nota.png`, com `ffmpeg`); sem `ffmpeg` o teste da câmera é pulado. `tests/fixtures/foto-nota-real.jpeg` **não é versionada** (mostra final de cartão); o teste de OCR com ela é pulado quando o arquivo não existe (ex.: no CI). Imagens sintéticas (QR, ruído, chave com DV errado, sem chave) vêm de `scripts/gerar-fixtures-fotos.py`.
- Fixtures em `tests/fixtures/`: notas reais em texto (sem CPF) e fotos. Ao encontrar nota que o parser não lê, adicione-a como fixture e corrija sem quebrar as anteriores.
- E2E: `playwright.config.ts` nunca reaproveita servidor já em pé (`reuseExistingServer: false`, porta por `E2E_PORT`): um `next start` esquecido de uma rodada interrompida serve build antigo e gera falhas falsas. Se a porta estiver ocupada, use `E2E_PORT=3105 npm run e2e`.
- Mapas: testar sempre com serviço simulado (sucesso, falha de endereço, timeout, offline, cache); nunca chamar serviço real em teste.

---

## 12. Dependências adicionais e justificativa

| Pacote                   | Tipo    | Motivo                                                                           |
| ------------------------ | ------- | -------------------------------------------------------------------------------- |
| `jsqr`                   | runtime | leitura de QR em navegadores sem `BarcodeDetector` (iOS, alguns Android)         |
| `tesseract.js` (5)       | runtime | OCR no aparelho para ler a chave de acesso em foto, sem enviar imagem a servidor |
| `@tesseract.js-data/eng` | dev     | fonte do `eng.traineddata.gz`, copiado para `public/vendor` no build             |
| `@playwright/test`       | dev     | testes e2e com câmera simulada e modo offline                                    |
| `fake-indexeddb`         | dev     | testes de repositório sem navegador                                              |
| `@vitest/coverage-v8`    | dev     | cobertura dos testes de domínio                                                  |

Nova dependência: registrar aqui (pacote, versão, tipo, motivo) no mesmo commit que a adiciona.

---

## 13. Regras permanentes (nunca fazer)

1. Contornar, automatizar ou burlar o reCAPTCHA da SEFAZ.
2. Enviar a chave, a nota, fotos, CPF ou o endereço de casa a qualquer serviço de terceiros (a única passagem pelo servidor do app é a URL do QR no proxy da 5.5, e o CPF nunca sai dele).
3. Criar backend, rota de API, autenticação ou banco no servidor sem decisão explícita registrada neste arquivo (decisão existente: só `/api/nfce`, seção 5.5).
4. Acessar IndexedDB fora da camada de repositório.
5. Colocar lógica de negócio em componentes React.
6. Usar float para dinheiro nos modelos (sempre centavos inteiros).
7. Usar Tailwind v4, Server Actions, `middleware.ts` ou bibliotecas de estado global.
8. Fazer deploy manual na VPS fora do fluxo do GitHub Actions (exceto rollback documentado).
9. Registrar imagens Docker em registry público.
10. Rastrear localização contínua do usuário.
11. Alterar migração de IndexedDB já publicada.
12. Mudar headers de segurança sem atualizar a seção 9 e o teste correspondente.
13. Usar cor hexadecimal, `dark:` ou token antigo (`verde`) em componente; usar dourado e vermelho no mesmo componente; usar Michroma em botão, número ou parágrafo; deixar a cor como único sinal de estado.

---

## 14. Modelos de referência (infraestrutura)

Este arquivo é a fonte única para infraestrutura; não há outro documento de padrões. Os modelos abaixo são o ponto de partida e devem ser ajustados no próprio repositório.

### 14.1 `Dockerfile`

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MAPS_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_MAPS_KEY=$NEXT_PUBLIC_MAPS_KEY
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

- `npm ci --ignore-scripts` porque `scripts/` ainda não foi copiado nessa etapa. O script `build` do `package.json` executa `node scripts/copy-vendor.mjs && next build`.
- `public/vendor/tesseract/` nasce no build e precisa chegar ao `runner` (a cópia de `public` já cobre isso).
- `.dockerignore`: `node_modules`, `.next`, `.git`, `e2e`, `tests`, `docs`, `referencia`, `.env*`, `playwright-report`, `test-results`, `coverage`.

### 14.2 `docker-compose.yml` (VPS)

```yaml
services:
  despensa-web:
    image: despensa-web:latest
    container_name: despensa-web
    restart: unless-stopped
    env_file: .env
    environment:
      - NODE_ENV=production
    networks:
      - web
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.25"
        reservations:
          memory: 64M
    labels:
      - traefik.enable=true
      - traefik.docker.network=web
      - traefik.http.routers.despensa-web.rule=Host(`${DOMINIO}`)
      - traefik.http.routers.despensa-web.entrypoints=websecure
      - traefik.http.routers.despensa-web.tls=true
      - traefik.http.routers.despensa-web.tls.certresolver=le
      - traefik.http.services.despensa-web.loadbalancer.server.port=3000
      - traefik.http.routers.despensa-web-http.rule=Host(`${DOMINIO}`)
      - traefik.http.routers.despensa-web-http.entrypoints=web
      - traefik.http.routers.despensa-web-http.middlewares=despensa-web-redirect
      - traefik.http.middlewares.despensa-web-redirect.redirectscheme.scheme=https
      - traefik.http.middlewares.despensa-web-redirect.redirectscheme.permanent=true

networks:
  web:
    external: true
```

Premissas a confirmar na VPS: entrypoints do Traefik chamados `web` (80) e `websecure` (443), resolvedor de certificado chamado `le` e rede Docker `web`. Se os nomes forem outros, ajustar os labels e registrar aqui.

### 14.3 `.github/workflows/deploy.yml`

```yaml
name: deploy
on:
  push:
    branches: [main]

jobs:
  qualidade:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build

  deploy:
    needs: qualidade
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build
        run: |
          docker build \
            --build-arg NEXT_PUBLIC_SITE_URL=${{ secrets.NEXT_PUBLIC_SITE_URL }} \
            -t despensa-web:latest .
      - name: Enviar imagem por SSH
        env:
          VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
        run: |
          install -m 700 -d ~/.ssh
          printf '%s\n' "$VPS_SSH_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H "${{ secrets.VPS_HOST }}" >> ~/.ssh/known_hosts
          docker save despensa-web:latest | gzip | \
            ssh -i ~/.ssh/deploy_key "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}" "gunzip | docker load"
          rm -f ~/.ssh/deploy_key
      - name: Recriar container
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            set -euxo pipefail
            cd /opt/docker/despensa-web
            docker compose up -d --force-recreate --remove-orphans
            docker image prune -af
```

Se houver `NEXT_PUBLIC_MAPS_KEY`, acrescentar o `--build-arg` correspondente. `ci.yml` repete o job `qualidade` em `pull_request` e acrescenta `npx playwright install --with-deps chromium`, `npm run e2e` e upload de `playwright-report/`.

### 14.4 Preparação da VPS (referência para o runbook)

```bash
# como root ou sudo
sudo mkdir -p /opt/docker/despensa-web
sudo chown deploy:deploy /opt/docker/despensa-web
# como deploy
cd /opt/docker/despensa-web
printf 'NODE_ENV=production\nDOMINIO=despensa.exemplo.com.br\n' > .env
chmod 600 .env
# copiar docker-compose.yml para esta pasta
docker network ls | grep -w web   # a rede web precisa existir
```

O usuário `deploy` precisa ter a chave pública do deploy em `~/.ssh/authorized_keys` e permissão para usar Docker. Nunca usar root no deploy.

### 14.5 `next.config.ts` (esqueleto)

```ts
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default config;
```

`securityHeaders` é `{ key: string; value: string }[]` montado conforme a seção 9.1. Para o service worker, servir `/sw.js` com `Cache-Control: no-cache` e `Service-Worker-Allowed: /`.

### 14.6 Checklist de segurança (verificar antes de cada release)

- [ ] Headers da seção 9.1 presentes em produção (`curl -I https://DOMINIO`).
- [ ] Nenhuma violação de CSP no console nos fluxos de câmera, OCR, Compartilhar e mapas.
- [ ] HTTPS ativo com redirect permanente de HTTP; Cloudflare com proxy ativo.
- [ ] `.env` na VPS com permissão 600; `.env` e chaves ausentes do repositório; `.env.example` completo.
- [ ] `npm audit --omit=dev` sem vulnerabilidades críticas ou altas.
- [ ] Container roda como usuário `nextjs` (não root) e com limites de memória e CPU.
- [ ] Nenhum `innerHTML`, `dangerouslySetInnerHTML`, `eval` ou `window.confirm/alert/prompt` no código.
- [ ] CPF não é persistido (teste com texto de nota contendo CPF).
- [ ] Nenhum `watchPosition`; endereço e posição de casa não saem do aparelho.
- [ ] Imagem Docker não publicada em registry; transferida só por SSH.
- [ ] Monitor ativo no Uptime Kuma.
- [ ] Revisão trimestral: `npm outdated`, logs do container, espaço em disco, imagens antigas.
