# Tarefas: Despensa (`despensa-web`), do zero até o deploy na VPS

> Documento de execução derivado do `blue-print.md` (v1.1). Cada tarefa tem contexto suficiente para ser implementada de forma autônoma pelo `claude-code`. Tarefas da **Zuma** são ações que dependem de acesso, decisão ou uso real e que o `claude-code` não pode fazer.
>
> **Leia antes de começar:** `docs/blue-print.md` (produto, requisitos RF-xxx, regras RN-xx, decisões D-xx), `AGENTS.md` (stack, Docker, CI/CD, segurança, regras de negócio, convenções: **fonte única de orientação técnica**) e, se existir, `referencia/prototipo/` (protótipo funcional em JavaScript puro, a ser portado).

---

## 0. Regras gerais para o `claude-code`

### 0.1 Como trabalhar

1. Execute as tarefas **na ordem das dependências**. Não comece uma tarefa cuja dependência não esteja concluída.
2. **Bloqueio por tarefa da Zuma:** se uma tarefa depender de algo da Zuma que ainda não existe (secret, domínio, arquivo, decisão), **pare nessa tarefa**, registre o bloqueio em `docs/bloqueios.md` (o que falta, qual tarefa, o que já foi feito) e siga para uma tarefa independente. Nunca invente credenciais, domínio ou dados pessoais.
3. **Um branch por tarefa:** `feat/C-05-nfce-dominio`. Commits pequenos, mensagens no formato `tipo(escopo): descrição` (`feat`, `fix`, `test`, `chore`, `docs`, `refactor`).
4. Faça merge na `main` (squash) **somente com CI verde**. Todo push na `main` dispara deploy (tarefa C-15), então a `main` deve estar sempre estável.
5. Ao concluir cada tarefa, atualize o checklist no fim deste arquivo (`[x]`) e, se mudou algo relevante, o `AGENTS.md`.
6. Não tem acesso à VPS. Tudo que precisa ser feito lá vira **runbook** em `docs/deploy.md` para a Zuma executar.

### 0.2 Definição de pronto (vale para toda tarefa do `claude-code`)

- `npm run typecheck`, `npm run lint`, `npm test` e `npm run build` passam.
- Testes novos para a lógica nova (Vitest para regra de negócio; Playwright para fluxo de tela).
- Nenhuma dependência nova sem entrada no `AGENTS.md` (nome, versão, motivo).
- Nenhum segredo, CPF ou dado pessoal real no repositório (conferir `git diff`).
- Textos de interface em **português do Brasil**; moeda em reais; datas `dd/mm/aaaa`.
- Entidades e regras de negócio com nomes em português (conforme blueprint: `produto`, `mercado`, `compra`); código técnico (utilitários, infra) em inglês.
- Funciona no celular (viewport 390×844), com alvos de toque de pelo menos 44 px.

### 0.3 Convenções técnicas fixas

- **Stack:** Next.js 16 (App Router, `output: 'standalone'`), React 19, TypeScript 5 (`strict`), Tailwind CSS **3.4.x** (v4 proibida), `clsx` 2 + `tailwind-merge` 3, Zod ^4, Vitest ^4, Node 22 LTS.
- **Não usar:** Supabase, Server Actions, rotas de API próprias, autenticação, `middleware.ts`, Framer Motion e Sonner (só se houver necessidade real, com justificativa).
- **Telas são Client Components** (`'use client'`) porque o app funciona offline e lê dados do IndexedDB. Layouts podem ser Server Components.
- **Dados:** IndexedDB atrás de **repositórios** (interface + implementação). Todo registro tem `id` (UUID v4, `crypto.randomUUID()`) e `casaId` (uma casa padrão). Regras de negócio **não** conhecem IndexedDB nem React.
- **Datas:** fuso `America/Recife`. Regras de agenda trabalham com **datas sem hora** (`YYYY-MM-DD`) para evitar erros de fuso. Datas e horas de nota ficam como `YYYY-MM-DDTHH:mm:ss` (local, sem fuso), como já faz o protótipo.
- **Dinheiro:** guardar valores monetários em **centavos (inteiro)** nos novos modelos, formatar só na tela. Quantidades podem ser decimais (kg).

### 0.4 Estrutura de pastas alvo

```
despensa-web/
├─ docs/                 blue-print.md, tarefas.md, deploy.md, bloqueios.md, spike-mapas.md, parametros-iniciais.md
├─ referencia/prototipo/ protótipo em JS puro (somente leitura)
├─ src/
│  ├─ domain/            regras puras em TS (sem React, sem IndexedDB)
│  ├─ data/              repositórios (interface + IndexedDB), migrações, backup
│  ├─ lib/               câmera, QR, OCR, formatação, datas
│  ├─ schemas/           schemas Zod
│  ├─ components/        componentes de interface
│  └─ app/               rotas (App Router)
├─ public/               sw.js, manifest.webmanifest, ícones, vendor/ (gerado)
├─ scripts/              copy-vendor.mjs
├─ tests/                unitários (Vitest) e fixtures/
├─ e2e/                  Playwright
├─ Dockerfile, docker-compose.yml, .dockerignore
├─ .github/workflows/    ci.yml, deploy.yml
├─ .env.example, AGENTS.md, README.md
```

---

## 1. Visão geral das tarefas

| ID   | Tarefa                                         | Resp.       | Depende de             | Marco |
| ---- | ---------------------------------------------- | ----------- | ---------------------- | ----- |
| Z-01 | Criar repositório privado e dar acesso         | Zuma        | n/a                    | M0    |
| Z-02 | Colocar materiais de referência no repositório | Zuma        | Z-01                   | M0    |
| Z-03 | Entregar notas reais adicionais (fixtures)     | Zuma        | Z-01                   | M0    |
| Z-04 | Definir domínio e criar DNS no Cloudflare      | Zuma        | n/a                    | M0    |
| Z-05 | Preparar a VPS (diretório, `.env`, chave SSH)  | Zuma        | Z-04                   | M0    |
| Z-06 | Configurar secrets do GitHub                   | Zuma        | Z-01, Z-04, Z-05       | M0    |
| Z-07 | Preencher parâmetros iniciais                  | Zuma        | n/a                    | M0    |
| C-01 | Scaffold do projeto                            | claude-code | Z-01                   | M0.5  |
| C-02 | `AGENTS.md` e `README.md`                      | claude-code | C-01                   | M0.5  |
| C-03 | Headers de segurança e CSP                     | claude-code | C-01                   | M0.5  |
| C-04 | Modelos de domínio e schemas Zod               | claude-code | C-01                   | M0.5  |
| C-05 | Núcleo da chave e do QR (portar)               | claude-code | C-01, Z-02             | M0.5  |
| C-06 | Parser do texto da nota (portar)               | claude-code | C-05                   | M0.5  |
| C-07 | Camada de repositório e backup                 | claude-code | C-04                   | M0.5  |
| C-08 | Layout, navegação e componentes base           | claude-code | C-01                   | M0.5  |
| C-09 | PWA: manifest, service worker, offline         | claude-code | C-08                   | M0.5  |
| C-10 | Bibliotecas de QR e OCR (portar)               | claude-code | C-05                   | M0.5  |
| C-11 | Tela Importar nota                             | claude-code | C-06, C-07, C-08, C-10 | M0.5  |
| C-12 | Telas Compras, Preços e Backup                 | claude-code | C-07, C-08             | M0.5  |
| C-13 | Testes e2e de paridade com o protótipo         | claude-code | C-09, C-11, C-12       | M0.5  |
| C-14 | Dockerfile e docker-compose                    | claude-code | C-01                   | M0.5  |
| C-15 | GitHub Actions (CI e deploy) e runbook         | claude-code | C-14                   | M0.5  |
| Z-08 | Executar runbook e primeiro deploy             | Zuma        | C-15, Z-04..Z-06       | M0.5  |
| Z-09 | Testar no celular e aprovar a E0.5             | Zuma        | Z-08, C-13             | M0.5  |
| C-16 | Correções pós-teste da E0.5                    | claude-code | Z-09                   | M0.5  |
| C-17 | Spike de mapas (endereço e rota)               | claude-code | C-06                   | M1    |
| Z-10 | Decidir o serviço de mapas                     | Zuma        | C-17                   | M1    |
| C-18 | Regras: estoque, consumo e cobertura           | claude-code | C-04                   | M1    |
| C-19 | Regras: agenda das idas                        | claude-code | C-04                   | M1    |
| C-20 | Regras: geração da lista                       | claude-code | C-18, C-19             | M1    |
| C-21 | Catálogo automático e tela Catálogo            | claude-code | C-07, C-11, C-18       | M1    |
| C-22 | Tela Ajustes (perfil, agenda, parâmetros)      | claude-code | C-07, C-19, Z-07       | M1    |
| C-23 | Conferência rápida da despensa                 | claude-code | C-18, C-21             | M1    |
| C-24 | Lista inteligente (tela)                       | claude-code | C-20, C-23             | M1    |
| C-25 | Modo compra                                    | claude-code | C-24                   | M1    |
| C-26 | Reconciliação ao fechar a compra               | claude-code | C-11, C-25             | M1    |
| C-27 | Mercados e casa                                | claude-code | C-07, C-22             | M1    |
| C-28 | Estimativa da ida ao importar a nota           | claude-code | C-27, Z-10             | M1    |
| C-29 | Tela Início ("Hoje")                           | claude-code | C-24, C-27             | M1    |
| C-30 | Testes e2e da E1                               | claude-code | C-23..C-29             | M1    |
| Z-11 | Usar a E1 em compras reais e aprovar           | Zuma        | C-30                   | M1    |
| C-31 | Preços normalizados e histórico                | claude-code | C-21                   | M2    |
| C-32 | Alertas de preço na lista                      | claude-code | C-31, C-24             | M2    |
| C-33 | Comparação entre mercados e cesta              | claude-code | C-31, C-27             | M2    |
| C-34 | Economia líquida e divisão da lista            | claude-code | C-33, C-28             | M2    |
| C-35 | Gastos, deslocamento e inflação pessoal        | claude-code | C-31, C-28             | M2    |
| C-36 | Painel do objetivo                             | claude-code | C-26, C-28             | M2    |
| C-37 | Testes e2e da E2                               | claude-code | C-31..C-36             | M2    |
| Z-12 | Usar a E2 e aprovar                            | Zuma        | C-37                   | M2    |
| C-38 | Segurança final                                | claude-code | M2                     | M3    |
| C-39 | Performance e acessibilidade                   | claude-code | M2                     | M3    |
| C-40 | Documentação final                             | claude-code | M2                     | M3    |
| Z-13 | Rotina de revisão e monitoramento              | Zuma        | Z-08                   | M3    |

**Marcos:** M0 preparação · M0.5 migração e primeiro deploy · M1 lista inteligente e modo compra · M2 preços e comparação · M3 produção.

---

# FASE 0: Preparação (Zuma)

### Z-01: Criar repositório privado e dar acesso

- **Responsável:** Zuma
- **Contexto:** o deploy descrito no `AGENTS.md` (seção 10.3) transfere a imagem por SSH e exige repositório privado.
- **Fazer:** criar o repositório **`despensa-web`** privado no GitHub, branch padrão `main`. Dar ao `claude-code` permissão de leitura e escrita (clone, branch, push, PR).
- **Pronto quando:** o `claude-code` consegue clonar e dar push em um branch.

### Z-02: Colocar materiais de referência no repositório

- **Responsável:** Zuma
- **Depende de:** Z-01
- **Contexto:** o `claude-code` só enxerga o que estiver no repositório.
- **Fazer:** commitar na `main`:
  - `AGENTS.md` (raiz), `docs/blue-print.md` e `docs/tarefas.md` (este arquivo).
  - `referencia/prototipo/` com o conteúdo do `despensa.zip` entregue (inclui `nfce.js`, `img.js`, `db.js`, `app.js`, `sample/nota-exemplo.txt` e `tests/nfce.test.mjs`).
  - `tests/fixtures/foto-nota-real.jpeg`: a foto real da nota da Cia Santos (a mesma usada na validação do OCR). **Antes de commitar, confirmar que não aparece CPF nem dado de cartão** (a nota tem os últimos 4 dígitos do cartão; cubrir se quiser).
- **Pronto quando:** os arquivos estão na `main`.

### Z-03: Entregar notas reais adicionais (fixtures)

- **Responsável:** Zuma
- **Depende de:** Z-01
- **Contexto:** o parser foi validado com uma única nota (Cia Santos, hortifruti). Mercados diferentes podem ter texto diferente. Sem mais exemplos, o parser pode quebrar no uso real.
- **Fazer:** entregar, em `tests/fixtures/notas/`, o **texto copiado da página da SEFAZ** de pelo menos **3 notas de mercados diferentes** (de preferência um supermercado e um atacarejo), um arquivo `.txt` por nota. **Apagar o CPF** se aparecer. Entregar também 2 ou 3 fotos de notas (com e sem QR Code) em `tests/fixtures/fotos/`.
- **Pronto quando:** os arquivos estão na `main`. Se a Zuma não entregar a tempo, o `claude-code` segue só com a nota de exemplo e registra a pendência em `docs/bloqueios.md`.

### Z-04: Definir domínio e criar DNS no Cloudflare

- **Responsável:** Zuma
- **Contexto:** o app precisa de HTTPS para câmera, instalação e Compartilhar. O Traefik emite o certificado (Let's Encrypt) para o domínio do compose.
- **Fazer:** escolher o domínio ou subdomínio (ex.: `despensa.seudominio.com.br`), criar o registro DNS apontando para o IP da VPS com **proxy laranja** no Cloudflare. Informar o domínio ao `claude-code` (arquivo `docs/parametros-iniciais.md`, campo `dominio`).
- **Pronto quando:** o domínio resolve para a VPS.

### Z-05: Preparar a VPS

- **Responsável:** Zuma
- **Depende de:** Z-04
- **Contexto:** padrão de infraestrutura (`AGENTS.md` seção 10 e 14): usuário `deploy` (nunca root), diretório `/opt/docker/NOME`, rede Docker `web` externa gerenciada pelo Traefik.
- **Fazer** (o `claude-code` detalha os comandos em `docs/deploy.md`, tarefa C-15):
  1. Criar `/opt/docker/despensa-web` com dono `deploy`.
  2. Criar `/opt/docker/despensa-web/.env` com permissão 600 (deve conter `NODE_ENV=production` e `DOMINIO=<seu domínio>`; o app não tem segredos de servidor).
  3. Gerar um par de chaves SSH para este projeto; colocar a pública no `authorized_keys` do usuário `deploy`.
  4. Confirmar que a rede `web` e o Traefik estão no ar.
- **Pronto quando:** o usuário `deploy` acessa a pasta e a rede `web` existe.

### Z-06: Configurar secrets do GitHub

- **Responsável:** Zuma
- **Depende de:** Z-01, Z-04, Z-05
- **Fazer:** em _Settings → Secrets and variables → Actions_ do repositório, criar:

| Secret                 | Valor                            |
| ---------------------- | -------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | `https://DOMINIO`                |
| `VPS_HOST`             | host ou IP da VPS                |
| `VPS_USER`             | `deploy`                         |
| `VPS_SSH_KEY`          | chave **privada** gerada na Z-05 |

- **Pronto quando:** os quatro secrets existem.

### Z-07: Preencher parâmetros iniciais

- **Responsável:** Zuma
- **Contexto:** valores usados como padrão no app (todos editáveis depois em Ajustes). Sem eles, o `claude-code` usa os padrões marcados com **(assumido)**.
- **Fazer:** criar `docs/parametros-iniciais.md` com:

```
dominio: despensa.exemplo.com.br
agenda:
  feira_mensal:        { dia_do_mes: ?, mercado: ? }      # padrão assumido: dia 5
  mercado_semanal:     { dia_da_semana: ?, mercado: ? }   # 0=domingo..6=sábado; assumido: sábado
  hortifruti_semanal:  { dia_da_semana: ?, mercado: Cia Santos }  # assumido: quarta
folga_dias: ?                       # assumido: 2
idas_semanais_ao_mercado_alvo: ?    # quantas eliminar
transporte:
  carro:  { consumo_km_por_litro: ?, preco_combustivel_reais: ?, desgaste_reais_por_km: ? }
  bike_eletrica: { custo_reais_por_km: ? }
mercados:   # nome como aparece na nota, endereço como aparece na nota, meio de transporte habitual
  - { nome: ?, endereco_da_nota: ?, transporte: carro|bike_eletrica }
casa: { endereco_ou_bairro: ? }     # só para referência; a localização real é capturada no app
```

- **Pronto quando:** o arquivo está na `main`.

---

# FASE 1: Fundação do projeto (marco M0.5)

### C-01: Scaffold do projeto

- **Responsável:** claude-code
- **Depende de:** Z-01
- **Contexto:** projeto novo, Perfil A (dados locais). Stack e versões: `AGENTS.md` seções 2 e 3.
- **Fazer:**
  - Criar o app Next.js 16 (App Router, TypeScript `strict`, ESLint, sem `src`-less: usar `src/`), **Tailwind 3.4.x** (fixar a versão; não instalar v4), React 19.
  - Dependências: `zod@^4`, `clsx@2`, `tailwind-merge@3`. Dev: `vitest@^4`, `@vitest/coverage-v8`, `@playwright/test`, `fake-indexeddb` (testes de repositório; justificar no `AGENTS.md`).
  - `next.config.ts`: `output: 'standalone'`, `poweredByHeader: false`.
  - Fonte via `next/font/google` (sugestão: Inter; self-hosted em build).
  - Scripts em `package.json`: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:watch`, `e2e` (`playwright test`).
  - `.nvmrc` com `22`, `engines.node >=22 <23`.
  - `.gitignore` com `node_modules`, `.next`, `.env*`, `!.env.example`, `public/vendor/`, `playwright-report`, `test-results`, `coverage`.
  - `.env.example` com `NEXT_PUBLIC_SITE_URL=https://despensa.exemplo.com.br` comentado.
  - Alias `@/*` para `src/*`.
  - Criar a árvore de pastas da seção 0.4 (com `.gitkeep` onde necessário).
- **Critérios de aceite:** `npm ci && npm run build` funciona; `npm run dev` abre uma página inicial vazia; `npm test` roda (pode ter 1 teste trivial).

### C-02: `AGENTS.md` e `README.md`

- **Responsável:** claude-code
- **Depende de:** C-01
- **Fazer:** revisar o `AGENTS.md` que já existe na raiz (não recriar do zero) e mantê-lo atualizado; ele contém: resumo do produto (1 parágrafo, link para `docs/blue-print.md`), perfil (A com dados locais), stack e versões, comandos, regras de arquitetura (domínio puro, repositórios, Client Components, datas, centavos), **tabela de dependências adicionais com motivo** (`jsqr`, `tesseract.js`, `@tesseract.js-data/eng`, `@playwright/test`, `fake-indexeddb`), **exceções de segurança** (Permissions-Policy e CSP, ver C-03), convenções de commit e branch. Criar `README.md` curto (como rodar, testar, estrutura). Manter `AGENTS.md` atualizado a cada tarefa que mude algo relevante.
- **Critérios de aceite:** qualquer pessoa consegue rodar o projeto só com o README.

### C-03: Headers de segurança e CSP

- **Responsável:** claude-code
- **Depende de:** C-01
- **Contexto:** `AGENTS.md` seção 9 define os headers e as exceções (blueprint 10.2).
- **Fazer:** em `next.config.ts`, bloco `headers()` para `/:path*` com:
  - `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy: camera=(self), microphone=(), geolocation=(self)`.
  - `Content-Security-Policy`:
    ```
    default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';
    style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';
    connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; frame-ancestors 'none';
    object-src 'none'; base-uri 'self'; form-action 'self'
    ```
  - Extrair a lista de headers para `src/lib/security-headers.ts` (importada pelo `next.config.ts`), para poder testar. O `connect-src` ganha o domínio do serviço de mapas na C-28.
  - Documentar cada exceção no `AGENTS.md` (por que câmera, geolocalização, `wasm-unsafe-eval`, `worker-src blob:`, `img-src blob:`).
- **Critérios de aceite:** teste Vitest verifica cada header e cada diretiva; em `npm run build && npm start`, `curl -I http://localhost:3000` mostra os headers. A validação com câmera e OCR ativos é feita no e2e (C-13).

### C-04: Modelos de domínio e schemas Zod

- **Responsável:** claude-code
- **Depende de:** C-01
- **Contexto:** blueprint seção 7. Todos os registros têm `id` (UUID) e `casaId`.
- **Fazer:** em `src/schemas/` e `src/domain/types.ts` (tipos inferidos dos schemas), definir:
  - `Casa` (`id`, `nome`).
  - `Perfil` (`casaId`, `localizacaoCasa?: {lat, lng}`, `arredondarLocalizacao: boolean`, `folgaDias: number` (padrão 2), `limiarAlertaPrecoPct` (padrão 20), `carro: {consumoKmPorLitro, precoCombustivelCentavos, desgasteCentavosPorKm}`, `bikeCentavosPorKm`).
  - `AgendaIda` (`tipo: 'feira_mensal' | 'mercado_semanal' | 'hortifruti_semanal'`, `diaDoMes?`, `diaDaSemana?`, `mercadoId?`).
  - `Mercado` (`cnpj` 14 dígitos, `nome`, `apelido?`, `endereco`, `coordenadas?`, `tipo: 'hortifruti'|'supermercado'|'atacarejo'|'feira'|'outro'`, `transporte: 'carro'|'bike_eletrica'`, `distanciaKm?`, `tempoMinIda?`, `custoFixoIdaCentavos?`).
  - `Produto` (`nome`, `categoria`, `unidade: 'kg'|'un'|'pacote'|'l'`, `meta`, `frequencia: 'semanal'|'quinzenal'|'mensal'|'sob_demanda'`, `tipoIda`, `vidaUtilDias`, `mercadoPreferidoId?`, `localCasa?`, `ativo`).
  - `ApelidoMercado` (`cnpj`, `codigo`, `produtoId`).
  - `Estoque` (`produtoId`, `nivel: 'cheio'|'metade'|'acabando'|'acabou'`, `quantidadeExata?`, `confirmadoEm`, `consumoDiarioEstimado?`).
  - `Compra` (`chave`, `mercadoId`, `emissao` ISO local, `valorTotalCentavos`, `pagamento`, `itens: ItemCompra[]`, `custoIdaCentavos?`, `listaId?`, `importadoEm`) e `ItemCompra` (`codigo`, `descricao`, `produtoId`, `quantidade`, `unidade: 'KG'|'UNID'`, `valorUnitarioCentavos`, `valorTotalCentavos`).
  - `Lista` (`tipoIda`, `data`, `status: 'rascunho'|'em_compra'|'fechada'`, `mercadoId?`) e `ItemLista` (`listaId`, `produtoId?`, `nomeAvulso?`, `quantidadeSugerida`, `quantidadePega?`, `status: 'pendente'|'pego'|'nao_encontrado'|'adiado'|'extra'`, `precoCentavos?`).
  - Enums e constantes (categorias padrão, vida útil padrão por categoria **(assumido):** hortifruti 7, laticínios 10, carnes 3, mercearia 180, limpeza 365, higiene 365, bebidas 90, outros 90).
- **Critérios de aceite:** testes Vitest validam exemplos válidos e inválidos de cada schema; tipos exportados sem `any`.

### C-05: Núcleo da chave e do QR (portar)

- **Responsável:** claude-code
- **Depende de:** C-01, Z-02
- **Contexto:** o protótipo em `referencia/prototipo/nfce.js` e `tests/nfce.test.mjs` já implementa e testa tudo isto (28 verificações). Estrutura da chave de 44 dígitos: UF(2) AAMM(4) CNPJ(14) modelo(2) série(3) número(9) tpEmis(1) cNF(8) DV(1).
- **Fazer:** portar para `src/domain/nfce/chave.ts` (TypeScript, **comportamento idêntico**):
  - `onlyDigits`, `parseBR`, `round2`, `calcDV` (módulo 11, pesos 2 a 9), `cnpjOk`, `formatCNPJ`.
  - `decodeKey(raw)` → união discriminada `{ ok: true, chave, uf, ano, mes, cnpj, modelo, serie, numero, tpEmis, ehNFCe } | { ok: false, error }`.
  - `keyFromQR(texto)`: extrai 44 dígitos de URLs de QR v1 (`chNFe=`) e v2 (`?p=chave|2|1|1|hash`).
  - `chavePlausivel` e `chaveDoOCR(texto, cnpjsConhecidos)` com as **etapas** do protótipo (janela exata de 44 dígitos; dígito a mais ou a menos; 1 troca por confusão de OCR; 2 trocas só se sobrarem ≤ 3 candidatas, e prefere CNPJ conhecido). Retorno: `{ exata } | { candidatas: {chave, trocas}[] } | { vazio: true, ambiguo?: true }`. **Nunca** devolver como "exata" uma chave que não passou em DV, modelo 65, UF, ano 2019 a 2040, mês 1 a 12, tpEmis 1 ou 9 e CNPJ válido.
  - Mapa de UF (`26` = PE etc.).
- **Critérios de aceite:** portar **todos** os testes do protótipo para Vitest (`tests/domain/chave.test.ts`) e passar. Chave de teste: `26261108868231000638650020000689031020778720` (PE, CNPJ 08.868.231/0006-38, série 2, número 68903, DV 0).

### C-06: Parser do texto da nota (portar)

- **Responsável:** claude-code
- **Depende de:** C-05
- **Contexto:** o texto vem da página de consulta da SEFAZ-PE colado pelo usuário. Formato visto na nota real (`tests/fixtures` e `referencia/prototipo/sample/nota-exemplo.txt`): linhas do mercado (nome, `CNPJ: ...`, endereço), depois blocos de item `DESCRIÇÃO(Código: 0000000000052)` / `Qtde.: 1,26  UN: KG  Vl. Unit.: 7,88` / `Vl. Total` / `9,93`, depois `Qtd. total de itens:16`, `Valor a pagar R$:77,24`, `Forma de pagamento:` e linha como `Cartão de Crédito77,24`, `Número: 68903 Série: 2 Data de Emissão: 04/11/2026 10:33:31`, `Protocolo de Autorização: 226261025408429 ...`, `Chave de acesso:` com 11 grupos de 4 dígitos, `Consumidor não identificado`.
- **Fazer:** portar `parseNota` de `referencia/prototipo/nfce.js` para `src/domain/nfce/parser.ts`, com:
  - Retorno tipado e validado por Zod: `{ nota, avisos: string[], erros: string[] }`.
  - Todas as **conferências** do protótipo: soma dos itens × valor a pagar (tolerância R$ 0,05), contagem de itens × `Qtd. total de itens`, `qtd × unitário ≈ total` (R$ 0,02), CNPJ e número do texto × chave. Erros impedem salvar; avisos não.
  - **Nunca** guardar CPF (se o texto tiver CPF, só sinalizar `cpfNaNota`).
  - Valores monetários do modelo de saída em **centavos**; quantidades decimais.
  - `suggestName(descricao)` (remove sufixos `KG`, `UN`, `UNID`, `PCT 180`...) e `extrairEmbalagem(descricao)` (ex.: `PCT 180` → `{ tipo: 'pct', tamanho: 180 }`, usado depois na C-31).
  - Tolerância a variações: espaços, quebras de linha, `NBSP`, milhar com ponto (`1.234,56`), unidades `UN`/`UNID`/`KG`/`L`/`PCT`.
- **Critérios de aceite:** testes do protótipo portados; a nota de exemplo gera **16 itens, total 77,24, sem erros nem avisos**; testes novos para **cada nota** de `tests/fixtures/notas/` (Z-03). Se uma nota real não for lida corretamente, ajustar o parser **sem quebrar os testes anteriores** e registrar o formato novo no `AGENTS.md`.

### C-07: Camada de repositório e backup

- **Responsável:** claude-code
- **Depende de:** C-04
- **Contexto:** dados só no aparelho (IndexedDB). O protótipo (`referencia/prototipo/db.js`) tem `compras` e `mapa`. A camada de repositório permitirá trocar por Supabase no Perfil C sem mexer em telas e regras.
- **Fazer:**
  - `src/data/repositorios.ts`: interfaces genéricas (`obter`, `listar`, `salvar`, `apagar`, consultas específicas) para `Compra`, `Mercado`, `Produto`, `ApelidoMercado`, `Estoque`, `Lista`, `ItemLista`, `AgendaIda`, `Perfil`.
  - `src/data/indexeddb/`: implementação sem biblioteca externa, banco `despensa`, **versionamento de schema com migrações numeradas** (`migrations/001-inicial.ts`...). Índices úteis (compras por `emissao`, apelidos por `cnpj+codigo`, itens de lista por `listaId`).
  - **Eventos de mudança** (pequeno emissor) e hook `useRepositorio(consulta)` que reexecuta a consulta quando a coleção muda, para as telas atualizarem sozinhas. Sem bibliotecas de estado.
  - `src/data/backup.ts`: `exportar()` e `importar(json)` com **validação Zod** de todo o arquivo (versão, coleções); importação idempotente (mesmos `id`/`chave` sobrescrevem). Arquivo com versão maior que a suportada deve ser rejeitado com mensagem clara.
  - Fábrica `criarRepositorios()` que devolve a implementação IndexedDB; telas só importam a fábrica.
  - Garantir `casaId` padrão criado na primeira abertura.
- **Critérios de aceite:** testes com `fake-indexeddb` cobrem CRUD de cada repositório, migração a partir do schema vazio, exportar e importar (ida e volta), arquivo inválido rejeitado.

### C-08: Layout, navegação e componentes base

- **Responsável:** claude-code
- **Depende de:** C-01
- **Fazer:**
  - `src/app/layout.tsx` (Server Component): `lang="pt-BR"`, fonte, `<meta name="viewport">` com `viewport-fit=cover`, `theme-color` `#1f6f4a`, referência ao manifest.
  - Barra de abas inferior **mobile-first**: Início, Importar, Lista, Compras, Preços (as telas das etapas futuras entram como placeholders "em breve" e **não** aparecem até existirem; começar com Importar, Compras e Preços).
  - Tailwind: tokens em `tailwind.config.ts` (verde `#1f6f4a`, fundo `#f6f8f7`, borda `#d6ddd9`, texto `#1d2420`, erro `#9b1c1c`, aviso `#8a5a00`).
  - Componentes em `src/components/ui/`: `Button` (primário, secundário, perigo), `Card`, `Input`, `Textarea`, `Select`, `Badge`, `Alert` (aviso e erro), `Toast` simples (contexto + hook, sem biblioteca), `Progress`, `Details` (acordeão), `EmptyState`.
  - `src/lib/format.ts`: `brl(centavos)`, `dataBR(iso)`, `horaBR(iso)`, `kg(n)`, com testes.
  - Todos com foco visível e rótulos acessíveis.
- **Critérios de aceite:** navegação entre abas funciona, layout correto em 390×844, testes de `format.ts`.

### C-09: PWA: manifest, service worker e offline

- **Responsável:** claude-code
- **Depende de:** C-08
- **Contexto:** o app precisa abrir e funcionar **sem internet** em todas as rotas, e receber o texto da nota via Compartilhar (Android). Decisão D22: service worker escrito à mão, sem plugin.
- **Fazer:**
  - `public/manifest.webmanifest` **estático** (os tipos de `app/manifest.ts` podem não incluir `share_target`): `name`, `short_name` "Despensa", `lang` `pt-BR`, `start_url` `/`, `scope` `/`, `display` `standalone`, cores, ícones 192, 512 e maskable (gerar PNGs a partir de um SVG simples: prateleira com potes, verde `#1f6f4a` e branco), e `share_target`: `{ action: "/importar", method: "GET", params: { title: "title", text: "text", url: "url" } }`. Referenciar em `metadata.manifest`.
  - `public/sw.js`: cache versionado (`despensa-vN`). **Estratégia:** `/_next/static/*` e ícones: cache primeiro; navegações (HTML) e requisições RSC (`?_rsc=`): **rede primeiro, cache como reserva**; se uma requisição RSC falhar offline, devolver erro para que o Next faça navegação completa, que será atendida pelo HTML em cache. No `install`, **pré-cachear** a lista de rotas do app (gerada em build: `scripts/gen-precache.mjs` lê as rotas e os arquivos estáticos do `.next`, ou lista fixa mantida em `src/lib/rotas.ts`). `skipWaiting` + `clients.claim`; ao ativar, apagar caches antigos.
  - Registro do SW em um Client Component no layout (só em produção ou `localhost`), com aviso discreto "nova versão disponível, atualizar" quando houver SW novo esperando.
  - Cache dos assets do OCR (`/vendor/tesseract/*`) **sob demanda** (não pré-cachear os ~11 MB): cache primeiro depois da primeira busca.
- **Critérios de aceite:** teste e2e (Playwright): carregar todas as rotas online, ir offline (`context.setOffline(true)`), navegar entre todas as abas e **recarregar cada rota** sem erro; Lighthouse/instalabilidade: manifest válido com ícones; o `share_target` abre `/importar?text=...`.

### C-10: Bibliotecas de QR e OCR (portar)

- **Responsável:** claude-code
- **Depende de:** C-05
- **Contexto:** protótipo em `referencia/prototipo/img.js`. O OCR roda no aparelho (Tesseract.js 5 com dados `eng`), carregado **só quando necessário**. O QR usa o detector nativo quando existe e `jsqr` caso contrário (iPhone).
- **Fazer:**
  - Dependências: `jsqr`, `tesseract.js@5`; dev: `@tesseract.js-data/eng` (arquivo `4.0.0_best_int/eng.traineddata.gz`).
  - `scripts/copy-vendor.mjs` (rodado no script `build`, antes do `next build`; no `dev`, rodar `node scripts/copy-vendor.mjs` ou `npm run vendor`): copia para `public/vendor/tesseract/` o `worker.min.js`, `core/tesseract-core-lstm.wasm.js`, `core/tesseract-core-simd-lstm.wasm.js` e `lang/eng.traineddata.gz`. A pasta `public/vendor/` fica no `.gitignore` (arquivos grandes, regenerados no build). Falhar o build com mensagem clara se a cópia falhar.
  - `src/lib/qr.ts`: `lerQR(origem: HTMLVideoElement | HTMLCanvasElement)` (detector nativo → `jsqr` em 3 escalas 1600/1000/640 com `inversionAttempts: 'attemptBoth'`) e `iniciarScanner(video, aoLer)` (câmera traseira, quadro a cada ~350 ms, **parar a câmera** ao ler ou fechar).
  - `src/lib/imagem.ts`: `arquivoParaCanvas(file, maxLado=2200)` respeitando a orientação EXIF (`createImageBitmap` com `imageOrientation: 'from-image'`).
  - `src/lib/ocr.ts`: `lerChaveDaFoto(canvas, { cnpjsConhecidos, aoProgredir })`: importa `tesseract.js` dinamicamente; `createWorker('eng', 1, { workerPath, corePath, langPath, gzip: true })` apontando para `/vendor/tesseract/...` (URLs absolutas pela origem); `setParameters` com `tessedit_char_whitelist: '0123456789 '`, `tessedit_pageseg_mode: '6'`; **3 tentativas** de pré-processamento (cinza e contraste a 1800 px; Otsu a 1800 px; cinza e contraste a 2600 px); parar na primeira com chave **exata**; senão, devolver a melhor candidata; **sempre** `worker.terminate()` no `finally`.
  - Se `tesseract.js` não funcionar bem empacotado pelo Next, alternativa aceita: carregar o `tesseract.min.js` de `/vendor/tesseract/` como script (como o protótipo). Documentar a escolha no `AGENTS.md`.
- **Critérios de aceite:** teste unitário do pré-processamento e do fluxo com `chaveDoOCR`; teste e2e (C-13) com `tests/fixtures/foto-nota-real.jpeg` achando a chave `2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720` (na validação do protótipo o OCR errou 1 dígito e o reparo devolveu essa chave como única candidata; aceitar `exata` **ou** uma candidata única igual a essa).

### C-11: Tela Importar nota

- **Responsável:** claude-code
- **Depende de:** C-06, C-07, C-08, C-10
- **Contexto:** fluxo em 4 passos do blueprint 4.5 e RF-101 a RF-112. Protótipo em `referencia/prototipo/app.js` e `index.html`.
- **Fazer:** rota `/importar` com:
  1. **Passo 1, chave:** campo (agrupa de 4 em 4, valida a cada digitação; mostra UF, mês/ano, CNPJ, número e série; avisa se já importada). Três botões: **Escanear QR** (câmera ao vivo), **Tirar foto** (`<input type=file accept=image/* capture=environment>`), **Enviar imagem**. Imagem: tenta QR; senão OCR (com barra de progresso). Resultado do OCR: `exata` preenche o campo com aviso "confira os números"; `candidatas` mostra botões para escolher (nunca preenche sozinho); `ambiguo` e `vazio` orientam a refazer a foto ou digitar. Prévia da imagem. Botão "Abrir o link do QR (teste sem captcha)" quando o QR trouxer URL.
  2. **Passo 2, SEFAZ:** botão "Copiar chave e abrir SEFAZ" (`navigator.clipboard.writeText` + `window.open('https://nfce.sefaz.pe.gov.br/nfce-web/consNfce', '_blank', 'noopener')`); habilitado só com chave válida de UF suportada (hoje PE; outras UFs: mensagem para colar o texto manualmente).
  3. **Passo 3, colar:** `textarea`, botão "Colar da área de transferência" (`readText`) e "Ler nota". **Receber via Compartilhar:** se a URL tiver `?text=`, preencher e ler automaticamente, e limpar a URL (`history.replaceState`).
  4. **Passo 4, conferência:** resumo (mercado, data, itens, soma, valor pago), lista de erros e avisos, e para cada item um campo com o **nome do produto** (preenchido pelo apelido guardado para `CNPJ + código`, senão `suggestName`), marcando "novo". Chave do texto diferente da chave do passo 1 = erro. Nota duplicada: aviso e botão "Substituir". Salvar cria/atualiza `Mercado` (por CNPJ), `Compra`, `ApelidoMercado` e (a partir da C-21) `Produto`. Após salvar: toast e ir para `Compras`.
  - Câmera: parar o stream ao sair da tela e ao fechar. Tratar permissão negada com mensagem e alternativa.
  - Segurança: nenhum texto externo com `innerHTML`; usar renderização do React.
- **Critérios de aceite:** paridade com o protótipo: chave inválida (dígito trocado, tamanho errado), chave válida, QR em imagem, foto com OCR, texto da nota de exemplo → 16 itens, salvar, duplicada, apelido lembrado, texto adulterado → aviso. Testes e2e na C-13.

### C-12: Telas Compras, Preços e Backup

- **Responsável:** claude-code
- **Depende de:** C-07, C-08
- **Fazer:**
  - `/compras`: lista de compras (mais recente primeiro) com mercado, data e total; detalhe expansível com tabela de itens (produto, quantidade, preço unitário, total); apagar compra com confirmação (componente de diálogo próprio, **sem `window.confirm`**); estado vazio.
  - `/precos` (versão simples da E0): por produto e unidade (`kg` ou `un`), último preço, variação percentual contra a compra anterior (▲ ▼, só se ≥ 0,5%), menor e maior preço, histórico por data e mercado. A versão normalizada completa vem na C-31.
  - Backup (na tela Compras ou em Ajustes, escolher e documentar): **Exportar backup** (download `despensa-backup-AAAA-MM-DD.json`) e **Importar backup** (arquivo, validação Zod, resumo do que entrou, erros claros).
- **Critérios de aceite:** testes de componente ou e2e para listar, apagar, exportar e importar (ida e volta restaura os dados).

### C-13: Testes e2e de paridade com o protótipo

- **Responsável:** claude-code
- **Depende de:** C-09, C-11, C-12
- **Contexto:** o protótipo foi validado com Playwright e Chrome (câmera simulada, QR em imagem, OCR, offline, Compartilhar). Reproduzir contra o app novo, **com a CSP ativa** (`next start`).
- **Fazer:** `e2e/` com Playwright (projeto Chromium; Chrome com `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-video-capture=<y4m>` para a câmera; gerar o vídeo de QR a partir de uma imagem com `ffmpeg` no setup do teste, ou pular o teste da câmera com aviso se não houver `ffmpeg`). Cenários:
  1. Chave inválida e válida; botão da SEFAZ copia a chave (permissão de clipboard) e abre a URL (interceptar o popup).
  2. Texto da nota de exemplo → 16 itens, total R$ 77,24 → salvar → aparece em Compras e Preços.
  3. Reimportar → aviso de duplicada; apelido lembrado; texto com total adulterado → aviso.
  4. QR em imagem enviada → chave preenchida; câmera ao vivo com vídeo falso → chave preenchida.
  5. Foto real (`foto-nota-real.jpeg`) → chave correta (exata ou candidata única) e imagens sintéticas ruins nunca preenchem chave errada.
  6. Exportar e importar backup.
  7. Compartilhar: abrir `/importar?text=<nota>` → itens lidos.
  8. Offline: navegar por todas as rotas e recarregar, sem erro de console.
  9. **CSP:** nenhum erro de CSP no console durante todos os cenários (`page.on('console')` falha o teste com "Content Security Policy").
- **Critérios de aceite:** `npm run e2e` passa localmente e no CI; relatório HTML gerado.

### C-14: Dockerfile e docker-compose

- **Responsável:** claude-code
- **Depende de:** C-01
- **Contexto:** modelos em `AGENTS.md` seções 14.1 e 14.2. Nome do projeto e do container: `despensa-web`.
- **Fazer:**
  - `Dockerfile` multi-stage: `builder` (`node:22-alpine`, `ARG NEXT_PUBLIC_SITE_URL`, `npm ci`, `npm run build`, que inclui a cópia do vendor) e `runner` (`NODE_ENV=production`, `PORT=3000`, usuário `nextjs` uid 1001, copia `standalone`, `static`, `public`, `USER nextjs`, `CMD ["node","server.js"]`). **Garantir que `public/vendor/` (gerada no build) vai para o `runner`.**
  - `.dockerignore` (`node_modules`, `.next`, `.git`, `e2e`, `tests`, `docs`, `referencia`, `.env*`).
  - `docker-compose.yml` para a VPS (modelo em `AGENTS.md` 14.2): `image: despensa-web:latest` (carregada por `docker load`), `container_name: despensa-web`, `restart: unless-stopped`, `env_file: .env`, `NODE_ENV=production`, rede `web` externa, limites **memória 256m / cpus 0.25** (reservas 64m), labels do Traefik (router `despensa-web` com `Host(\`DOMINIO\`)`, `websecure`, `tls.certresolver=le`, porta 3000, router HTTP com middleware de redirect permanente para HTTPS). Usar `${DOMINIO}`lido do`.env` da VPS para não commitar o domínio, ou deixar o domínio como placeholder documentado.
- **Critérios de aceite:** `docker build` conclui; `docker run -p 3000:3000` serve o app; o processo roda como `nextjs` (não root); a imagem contém `public/vendor/tesseract/lang/eng.traineddata.gz`. Se o ambiente não tiver Docker, validar no CI (C-15) e registrar.

### C-15: GitHub Actions (CI e deploy) e runbook

- **Responsável:** claude-code
- **Depende de:** C-14
- **Contexto:** Modelo em `AGENTS.md` seção 14.3: a imagem **nunca** vai para um registry; é transferida por pipe SSH para o Docker da VPS.
- **Fazer:**
  - `.github/workflows/ci.yml` em pull requests: `npm ci`, `lint`, `typecheck`, `test`, `build`, e2e com Playwright (instalar o Chromium) e upload do relatório.
  - `.github/workflows/deploy.yml` em push na `main`: job `qualidade` (lint, typecheck, test, build) e job `deploy` (`needs: qualidade`): `docker build` com `build-args: NEXT_PUBLIC_SITE_URL=${{ secrets.NEXT_PUBLIC_SITE_URL }}`, `docker save despensa-web:latest | gzip | ssh ... "gunzip | docker load"` (chave do secret escrita em arquivo temporário com `chmod 600` e apagada depois), depois `appleboy/ssh-action@v1` em `/opt/docker/despensa-web`: `set -euxo pipefail`, `docker compose up -d --force-recreate --remove-orphans`, `docker image prune -af`. Usar os secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`. O job `qualidade` já está descrito no `AGENTS.md` (10.3).
  - `docs/deploy.md` (**runbook para a Zuma**): preparar a VPS (comandos exatos para criar a pasta com dono `deploy`, `.env` 600, chave SSH e `authorized_keys`), copiar `docker-compose.yml` para a VPS, configurar secrets, DNS, primeiro deploy, como verificar HTTPS (`curl -I https://DOMINIO` e checar os headers de segurança e `permissions-policy`), logs (`docker logs despensa-web --tail 100`), **rollback** (reimplantar um commit anterior: `git revert` + push, ou refazer `docker load` de uma imagem salva), e adicionar o monitor no Uptime Kuma.
- **Critérios de aceite:** workflows válidos (rodar `actionlint` se disponível); `docs/deploy.md` cobre todos os passos sem depender de conhecimento prévio.

### Z-08: Executar o runbook e o primeiro deploy

- **Responsável:** Zuma
- **Depende de:** C-15, Z-04, Z-05, Z-06
- **Fazer:** seguir `docs/deploy.md`: copiar o `docker-compose.yml` para `/opt/docker/despensa-web`, conferir o `.env`, dar push na `main` (ou rodar o workflow manualmente) e acompanhar o job. Conferir: certificado HTTPS emitido; `curl -I https://DOMINIO` mostra os headers de segurança (CSP, `x-frame-options`, `permissions-policy` com `camera=(self)`); container listado como saudável; monitor criado no Uptime Kuma.
- **Pronto quando:** o app abre em `https://DOMINIO`.

### Z-09: Testar no celular e aprovar a E0.5

- **Responsável:** Zuma
- **Depende de:** Z-08, C-13
- **Fazer, no Android, com notas reais:**
  1. Abrir o endereço e **instalar** o app (Adicionar à tela inicial).
  2. **QR ao vivo:** escanear o QR de uma nota (se houver).
  3. **Foto da nota** sem QR: a chave aparece certa? Quantas fotos foram necessárias? Anotar o tempo.
  4. **Compartilhar:** na página da SEFAZ, selecionar o texto e usar Compartilhar → Despensa.
  5. **Offline:** ativar modo avião e abrir o app, navegar, abrir Compras.
  6. Importar 2 ou 3 notas reais e conferir itens e totais.
  7. Anotar qualquer problema em issues do GitHub (ou em `docs/problemas-e05.md`), com captura de tela.
- **Pronto quando:** a Zuma responde "aprovado" ou lista os problemas.

### C-16: Correções pós-teste da E0.5

- **Responsável:** claude-code
- **Depende de:** Z-09
- **Fazer:** corrigir tudo que a Zuma listou, **com teste de regressão** para cada correção. Atenção a: CSP bloqueando câmera/OCR/worker, câmera no Android, taxa de acerto do OCR (se baixa, melhorar o pré-processamento: recorte da faixa de dígitos, mais escalas), formatos de nota novos no parser. Atualizar fixtures e `AGENTS.md`.
- **Critérios de aceite:** problemas fechados; CI verde; redeploy automático feito.

---

# FASE 2: Spike de mapas (marco M1)

### C-17: Spike de mapas (endereço e rota)

- **Responsável:** claude-code
- **Depende de:** C-06
- **Contexto:** a estimativa da ida (RF-804) precisa transformar o **endereço do mercado que vem na nota** (às vezes abreviado, ex.: `AVENIDA GOVERNADOR CARLOS DE LIMA CAVALC , 1245 , CASA CAIADA , OLINDA , PE`) em coordenadas e calcular distância e tempo desde a casa, para **carro** e **bike elétrica**. Chamado **direto do navegador** (D24), sem rota própria. O endereço de casa não deve sair do aparelho: só coordenadas (opcionalmente arredondadas).
- **Fazer:** produzir `docs/spike-mapas.md` com:
  - Comparação de pelo menos 3 serviços (ex.: Nominatim + OSRM, OpenRouteService, Mapbox, Google): geocodificação, rota de carro, **rota de bicicleta**, suporte a CORS no navegador, limites e **termos de uso** (especialmente a política de uso do Nominatim), custo, necessidade de chave.
  - **Teste prático** de geocodificação com os endereços de `docs/parametros-iniciais.md` (Z-07) e com os endereços das notas em `tests/fixtures`: taxa de acerto, e como o texto abreviado afeta o resultado. Propor **normalização** do endereço (expandir `AV`, `CAVALC`, remover espaços antes de vírgula, usar CEP/bairro/cidade como reserva).
  - Se o ambiente não tiver rede para testar, descrever o teste a ser feito e deixar os scripts em `scripts/spike-mapas/` para a Zuma rodar.
  - **Recomendação** de serviço, de fallback (marcar o ponto no mapa; digitar km e minutos) e de como estimar a distância da bike quando o serviço não tiver perfil de bicicleta (fator sobre a distância de carro, documentando a margem).
- **Critérios de aceite:** documento com tabela comparativa, resultados dos testes e uma recomendação clara em uma frase.

### Z-10: Decidir o serviço de mapas

- **Responsável:** Zuma
- **Depende de:** C-17
- **Fazer:** ler `docs/spike-mapas.md`, escolher o serviço e, se exigir chave, criar a conta e a chave (restringir por domínio, se o serviço permitir) e guardar no GitHub como secret `NEXT_PUBLIC_MAPS_KEY` (chaves de uso no navegador são públicas por natureza; por isso a restrição por domínio). Responder no próprio documento: "serviço escolhido: X".
- **Pronto quando:** `docs/spike-mapas.md` tem a decisão e, se for o caso, o secret existe.

---

# FASE 3: Lista inteligente e modo compra (marco M1)

### C-18: Regras de estoque, consumo e cobertura

- **Responsável:** claude-code
- **Depende de:** C-04
- **Contexto:** RN-01 a RN-03 e RF-401 a RF-403. Funções **puras** em `src/domain/estoque.ts`, sem React nem IndexedDB.
- **Fazer:**
  - `fracaoDoNivel`: cheio 1, metade 0,5, acabando 0,2, acabou 0.
  - `estoqueEstimado(nivel, quantidadeReferencia)` = fração × referência (a meta; ou a última quantidade comprada se existir).
  - `consumoDiario(produto, compras)`: com **2 ou mais compras** do produto, média das últimas até 4 razões `quantidade_i ÷ dias(i → i+1)` (compras ordenadas por data; descartar intervalos de 0 dia); com menos, **frequência declarada**: semanal → `meta/7`, quinzenal → `meta/15`, mensal → `meta/30`, sob demanda → `undefined`.
  - `coberturaDias(estoque, consumo)` = estoque ÷ consumo (`Infinity` se consumo for 0 ou indefinido).
  - `estoqueNaData(estoqueAgora, consumo, dias)` = `max(0, estoqueAgora − consumo × dias)`.
  - `aplicarCompra(estoque, compra)`: produto comprado volta a `cheio` (RF-402).
  - `sugerirProvavelmenteAcabando(produto, estoque, hoje)`: se a cobertura estimada for menor que 2 dias e o nível ainda não for `acabando` ou `acabou`, marcar para confirmação (RF-403).
- **Critérios de aceite:** testes tabelados para cada função (inclusive consumo com 0, 1, 2 e 5 compras, intervalos iguais a 0 e produtos "sob demanda"); `100%` das ramificações cobertas.

### C-19: Regras da agenda das idas

- **Responsável:** claude-code
- **Depende de:** C-04
- **Contexto:** RF-301 a RF-303. Três tipos: `feira_mensal` (dia do mês), `mercado_semanal` e `hortifruti_semanal` (dia da semana, 0 = domingo). Datas sem hora, fuso `America/Recife`.
- **Fazer:** em `src/domain/agenda.ts`:
  - `proximaOcorrencia(agenda, aPartirDe: 'YYYY-MM-DD', incluirHoje = true)`: semanal = próximo dia da semana; mensal = próxima data com o `diaDoMes`, **ajustando para o último dia do mês** quando o mês for mais curto (ex.: dia 31 em abril → 30; dia 30 em fevereiro → 28 ou 29).
  - `ocorrenciasEntre(agenda, de, ate)`.
  - `diasEntre(a, b)` (inteiro, sem fuso).
  - `proximaIdaDoTipo(agendas, tipo, hoje)` e `idaSeguinte(agendas, tipo, data)` (a ocorrência depois de uma data).
  - `tiposCompativeis(produto)`: para onde um produto pode ser "puxado" quando acabar antes da ida padrão: `feira_mensal` e mercearia → `mercado_semanal`; `hortifruti_semanal` → ele mesmo.
  - Utilitário `hojeRecife()` (injetável nos testes).
- **Critérios de aceite:** testes de mês curto, ano bissexto, virada de mês e de ano, dia atual com e sem `incluirHoje`, e todas as 7 posições da semana.

### C-20: Regras de geração da lista

- **Responsável:** claude-code
- **Depende de:** C-18, C-19
- **Contexto:** RN-04, RN-05, RN-06, RF-501 a RF-504. **Interpretação formal** (registrar no `AGENTS.md`; a Zuma valida na Z-11):
  - Seja `T` a ida (tipo e data) para a qual a lista é gerada, `T2` a ocorrência seguinte do mesmo tipo, `folga` em dias (`Perfil.folgaDias`, padrão 2), `consumo` e `estoqueAgora` de cada produto.
  - `estoqueEmT = estoqueNaData(estoqueAgora, consumo, dias(hoje → T))`.
  - **Regra base** (produto cujo `tipoIda == T.tipo`): entra se `nivel == 'acabou'` **ou** `coberturaEmT < dias(T → T2) + folga`, onde `coberturaEmT = estoqueEmT ÷ consumo`.
  - **Quantidade** = `consumo × (dias(T → T2) + folga) − estoqueEmT`, **arredondada para cima** à unidade de compra (kg: múltiplos de 0,1; `un`, `pacote`: inteiros; `l`: 0,5), **mínimo** de 1 unidade (ou 0,1 kg) quando entrar; **limitada pela vida útil**: nunca mais que `consumo × vidaUtilDias`. Sem `consumo` conhecido, usar a `meta` como quantidade.
  - **Puxar para uma ida anterior** (RF-304, RN-04 exemplo do café): produto `feira_mensal` cujo estoque **acaba antes** da próxima feira (`hoje + cobertura < data da próxima feira`) entra na **primeira ida compatível** (`tiposCompativeis`) com data ≤ data de fim do estoque; quantidade = `consumo × (dias(Tcompat → próxima feira) + folga) − estoqueEmTcompat`. Se não houver ida compatível até a data de fim, entra na lista da **próxima ida compatível** de qualquer forma e o item é marcado `urgente`.
  - **Acabou** sempre entra na próxima ida do tipo do produto ou, se ela vier depois de hoje + 1 dia, na **primeira ida compatível**.
  - Produtos `sob_demanda`: só entram se `acabou` ou `acabando`.
  - **Perecível** (`vidaUtilDias` ≤ 14) nunca vai para a feira mensal; se estiver configurado assim, gerar aviso.
  - Produtos arquivados (`ativo = false`) nunca entram.
  - **Estimativa de custo** = soma de `quantidade × último preço unitário` do produto (último preço pago; sem preço, não soma e marca "sem preço").
  - Saída: `ItemListaSugerido[]` com `{ produtoId, quantidade, motivo: 'acabou' | 'cobertura' | 'puxado' , urgente, precoEstimadoCentavos? }` e `resumo` (total estimado, itens sem preço).
- **Critérios de aceite:** testes tabelados com **relógio injetado**: (1) café acaba dia 18 e a feira é dia 30 → entra na ida semanal até dia 18; (2) arroz que dura além da feira não entra; (3) hortifruti semanal com tomate "metade" entra com a quantidade esperada; (4) perecível não vai para a feira; (5) `acabou` entra mesmo com meta zero; (6) arredondamentos por unidade; (7) limite pela vida útil; (8) produto arquivado ignorado; (9) sem histórico usa meta e frequência declarada.

### C-21: Catálogo automático e tela Catálogo

- **Responsável:** claude-code
- **Depende de:** C-07, C-11, C-18
- **Contexto:** RF-201 a RF-207, decisão: o catálogo **nasce das notas importadas**, sem cadastro manual obrigatório.
- **Fazer:**
  - Ao salvar uma compra (C-11), criar ou ligar o `Produto` para cada item (via `ApelidoMercado`; se o nome escolhido já existir no catálogo, reutilizar). Para produto novo: `unidade` pela unidade da nota (`KG` → `kg`, `UNID` → `un`, `PCT` → `pacote`), `categoria` por **regras simples** (se o `Mercado.tipo` for hortifruti → `hortifruti`; senão por dicionário de palavras-chave em `src/domain/categorias.ts`, padrão `outros`), `vidaUtilDias` pelo padrão da categoria, `tipoIda` (`hortifruti_semanal` para hortifruti, senão `mercado_semanal`), `frequencia` `semanal`, `meta` = **média da quantidade comprada por compra** (atualizada a cada nova compra enquanto o usuário não editar a meta manualmente: guardar flag `metaManual`).
  - Heurística de sugestão (RF-304): produto durável comprado em 3 ou mais idas semanais seguidas → sugerir `feira_mensal` (apenas **sugestão** visível, nunca troca sozinha).
  - Tela `/catalogo`: lista por categoria com busca; editar nome, categoria, unidade, meta, frequência, tipo de ida, vida útil, local da casa e mercado preferido; arquivar e desarquivar; **mesclar** dois produtos (move apelidos e histórico). Mostrar a sugestão da heurística.
- **Critérios de aceite:** testes: importar a nota de exemplo cria 16 produtos com unidade, categoria `hortifruti` e meta igual à quantidade comprada; segunda compra atualiza a meta pela média; editar meta manual trava a atualização automática; mesclar mantém histórico.

### C-22: Tela Ajustes (perfil, agenda e parâmetros)

- **Responsável:** claude-code
- **Depende de:** C-07, C-19, Z-07
- **Fazer:** rota `/ajustes` com seções: **Agenda das idas** (3 tipos, cada um com dia do mês ou da semana e mercado habitual escolhido entre os mercados cadastrados); **Folga em dias**; **Parâmetros de custo** (consumo do carro, preço do combustível, desgaste por km, custo por km da bike elétrica; mostrar o custo estimado por km resultante); **Limiar de alerta de preço** (%); **Backup** (mover para cá se a C-12 não tiver feito). Valores iniciais vêm de `docs/parametros-iniciais.md` (carregar como seed na primeira abertura, via arquivo `src/config/seed.ts` gerado ou transcrito) e, na falta, dos padrões **(assumidos):** feira mensal dia 5, mercado semanal sábado, hortifruti semanal quarta, folga 2 dias, alerta 20%, carro 10 km/L, combustível R$ 6,00, desgaste R$ 0,30/km, bike R$ 0,05/km. Validar com Zod, mostrar erros por campo.
- **Critérios de aceite:** salvar e recarregar mantém os valores; testes de validação; seed aplicado só na primeira abertura.

### C-23: Conferência rápida da despensa

- **Responsável:** claude-code
- **Depende de:** C-18, C-21
- **Contexto:** RF-401 a RF-404; meta: menos de 3 minutos por ida.
- **Fazer:** rota `/conferencia?ida=<tipo>`:
  - Seleciona os produtos **que vencem na próxima ida** do tipo escolhido (os que a regra de cobertura da C-20 incluiria, mais os de nível desatualizado: sem confirmação há mais de N dias, N = ciclo da ida).
  - Uma tela por produto com 4 botões grandes: **Cheio, Metade, Acabando, Acabou**; opção de quantidade exata (campo numérico) só para produtos que a Zuma marcar como "contável"; atalho **"Mesmo que o estimado"** quando o app tiver estimativa (RF-403 "provavelmente acabando").
  - **Agrupar por local da casa** (geladeira, armário, área de serviço; `Produto.localCasa`) e permitir pular, voltar, e concluir antes.
  - Registrar o **tempo total** da conferência (para o painel, C-36) e o número de produtos conferidos.
  - Persistir cada resposta no `Estoque` na hora (funciona se o usuário sair no meio).
  - Ao final, botão "Gerar lista".
- **Critérios de aceite:** e2e: conferir 5 produtos, níveis persistem após recarregar; produtos "acabou" aparecem na lista gerada; tempo registrado.

### C-24: Lista inteligente (tela)

- **Responsável:** claude-code
- **Depende de:** C-20, C-23
- **Fazer:** rota `/lista`:
  - Escolher o **tipo de ida** (default: a mais próxima na agenda); gerar a lista com a C-20; criar `Lista` e `ItemLista` (status `rascunho`).
  - Itens agrupados por categoria; para cada item: nome, quantidade sugerida (editável com +/−), motivo ("acabou", "vai faltar antes da próxima ida", "puxado da feira"), badge **urgente**, remover da lista.
  - **Itens avulsos** (fora do catálogo): campo "Adicionar item" com nome e quantidade.
  - **Estimativa de custo** no topo e itens "sem preço" listados à parte.
  - Opção **separar por mercado** quando houver mercado preferido diferente (RF-506); no MVP, só agrupa visualmente.
  - Botão **"Iniciar compra"** (vai para o Modo compra, C-25).
  - Regenerar a lista mantém edições manuais do usuário (itens removidos continuam removidos; quantidades editadas continuam editadas) e só acrescenta o que mudou.
- **Critérios de aceite:** e2e: a partir de estoque e compras de fixture, a lista esperada aparece; editar quantidade, remover e adicionar avulso persistem; custo estimado confere com o cálculo.

### C-25: Modo compra

- **Responsável:** claude-code
- **Depende de:** C-24
- **Contexto:** RF-601 a RF-604; uso dentro do mercado, **offline**.
- **Fazer:** rota `/compra/[listaId]`:
  - Checklist agrupado por categoria, com **alvos de toque grandes**; ações por item: **Peguei** (toque), ajustar quantidade, **Não encontrei** (vira `nao_encontrado`; reaparece na próxima ida), **Adiar** (`adiado`), campo de **preço opcional** (nunca obrigatório), remover.
  - **Adicionar extra** durante a compra (cria `ItemLista` `extra`).
  - **Total corrente** (soma de quantidade pega × preço informado, quando houver) contra a estimativa; **orçamento** opcional definido pelo usuário, com alerta visual ao passar.
  - Barra de progresso (itens pegos / total); itens pegos vão para o fim da lista.
  - Persistência a cada toque (funciona se o app fechar); a lista passa a `em_compra`.
  - Botão **"Terminar compra"**: leva ao passo de importar a nota (C-26).
  - Manter a tela acesa (Screen Wake Lock API) com a permissão e o fallback silencioso quando não houver suporte.
- **Critérios de aceite:** e2e **offline**: com a lista gerada online, ir offline, marcar itens, adicionar extra, recarregar e ver o estado preservado.

### C-26: Reconciliação ao fechar a compra

- **Responsável:** claude-code
- **Depende de:** C-11, C-25
- **Contexto:** RF-701 a RF-705, RN-11.
- **Fazer:** quando uma nota for importada e houver uma lista `em_compra` (ou o usuário escolher a lista), depois da conferência de itens:
  - **Casar** itens da nota com itens da lista pelo `produtoId` (via apelido). Resultado em três grupos: **comprado** (estava na lista), **ficou de fora** (estava na lista e não veio na nota), **fora da lista** (veio na nota e não estava).
  - Atualizar: produtos comprados → `Estoque` `cheio` (RF-402/702); **ficou de fora** → permanece pendente para a próxima ida (RN-11); **fora da lista** → se a ida for de **reposição** (mercado semanal ou hortifruti semanal), marcar como **compra de emergência** (conta na métrica da C-36); oferecer **criar produto** no catálogo (RF-704) quando não existir.
  - Registrar `Compra.listaId`, fechar a `Lista` (`fechada`) e guardar quanto a lista previa e quanto foi gasto.
  - Tela de **resumo da compra**: comprado, faltou, fora da lista, total gasto contra estimativa, e (quando houver, C-28) custo da ida e **custo real** (RN-10).
  - Compra sem lista associada continua funcionando (apenas importa, atualiza estoque e preços).
- **Critérios de aceite:** testes de domínio da reconciliação (três grupos, emergência, estoque), e2e do fluxo lista → compra → nota → resumo.

### C-27: Mercados e casa

- **Responsável:** claude-code
- **Depende de:** C-07, C-22
- **Contexto:** RF-801 a RF-803, RF-807, RF-808. O endereço de casa **nunca sai do aparelho**.
- **Fazer:**
  - Entidade `Mercado` criada **automaticamente** ao importar uma nota (por CNPJ; filiais diferentes são mercados diferentes), com nome e endereço da nota; `tipo` sugerido (nome com "hortifruti/sacolão" → hortifruti; "atacado/atacarejo" → atacarejo; senão supermercado) e editável.
  - Tela `/mercados`: lista de mercados com apelido, tipo, **meio de transporte** (carro ou bike elétrica, lembrado por mercado), distância, tempo e custo da ida; editar manualmente distância (km) e tempo (min) como **fallback**.
  - **Casa:** em Ajustes, "Estou em casa agora" (`navigator.geolocation.getCurrentPosition`, uma única vez, alta precisão desligada), com opção de **arredondar** a posição (3 casas decimais ≈ 100 m) e alternativa de **marcar manualmente** (digitar latitude e longitude, ou coordenadas coladas). Guardar só coordenadas, no `Perfil`.
  - Tempo total em idas por mês e número de idas (RF-807), calculados a partir das compras com custo de ida; exibidos como **informação**, sem valorar.
  - **Não** usar `watchPosition` nem rastrear a localização em nenhum momento (RF-808).
- **Critérios de aceite:** teste: importar a nota cria o mercado; permissão de localização negada mostra a alternativa manual; nenhum código chama `watchPosition` (teste estático ou `grep` no CI).

### C-28: Estimativa da ida ao importar a nota

- **Responsável:** claude-code
- **Depende de:** C-27, Z-10
- **Contexto:** RN-08, RF-804 a RF-806, RF-705; serviço de mapas escolhido na Z-10, chamado **direto do navegador** (D24).
- **Fazer:**
  - `src/domain/ida.ts` (puro): `custoIda({ meio, kmIdaVolta, perfil, custoFixoCentavos })`: carro = `km × (precoCombustível ÷ consumo + desgasteKm) + fixos`; bike elétrica = `km × custoKmBike`. Centavos, arredondamento para o centavo mais próximo. Só dinheiro (o tempo **não** entra na conta).
  - `src/lib/mapas.ts`: cliente do serviço escolhido com interface `Mapas { geocodificar(endereco), rota(origem, destino, meio) }`, **timeouts e tratamento de erro**, **cache por mercado** (não repetir chamadas), respeitando limites e identificação exigidos pelo serviço, e `normalizarEndereco()` conforme `docs/spike-mapas.md`. Bike sem perfil no serviço: distância de carro × fator documentado.
  - Fluxo ao importar uma nota de mercado novo ou sem estimativa: geocodificar o endereço da nota, calcular distância e tempo desde a casa (coordenadas do `Perfil`) e mostrar **"Cia Santos, 4,2 km, cerca de 12 min. Você foi de carro ou de bike elétrica?"**, com confirmação em um toque; escolha lembrada por mercado. Falha na geocodificação: pedir **uma vez** o ponto (coordenadas ou km e minutos manuais) e guardar.
  - Gravar `Compra.custoIdaCentavos` e mostrar o **custo real da compra** (itens + ida, RN-10) no resumo.
  - Atualizar a CSP: acrescentar o domínio do serviço em `connect-src` (C-03) e registrar no `AGENTS.md`; se houver chave, lê-la de `NEXT_PUBLIC_MAPS_KEY` (acrescentar como `ARG` no Dockerfile e como `build-arg` no workflow).
  - Sem casa cadastrada ou sem internet: **não bloquear** a importação; deixar a estimativa pendente e oferecer refazer depois.
- **Critérios de aceite:** testes de `custoIda` (carro e bike, com e sem fixos); testes do fluxo com **serviço simulado** (sucesso, falha de endereço, timeout, offline, cache); nenhum dado além de coordenadas e endereço do mercado sai do aparelho.

### C-29: Tela Início ("Hoje")

- **Responsável:** claude-code
- **Depende de:** C-24, C-27
- **Fazer:** rota `/` com: **próxima ida** (tipo, data, em quantos dias), quantos produtos vencem nela, botões **Conferir despensa** e **Ver lista**; lembrete de **estimativa de ida pendente**; lembrete de **nota pendente de importar** (lista `em_compra` há mais de 1 dia); atalho **Importar nota**; estado vazio amigável para quem ainda não importou nenhuma nota. Passar a barra de abas para: Início, Importar, Lista, Compras, Preços, Mercados e Ajustes (agrupando o excesso em um menu "Mais").
- **Critérios de aceite:** e2e: com agenda e dados de fixture, mostra a próxima ida e a contagem corretas.

### C-30: Testes e2e da E1

- **Responsável:** claude-code
- **Depende de:** C-23 a C-29
- **Fazer:** cenário completo em Playwright com relógio controlado e fixtures: importar nota (cria catálogo) → ajustar agenda → conferir despensa (alguns "acabou" e "metade") → gerar lista → iniciar compra **offline** (marcar, extra, não encontrei) → voltar online → importar nota → reconciliação (comprado, faltou, fora da lista) → estoque atualizado → resumo com custo da ida (serviço de mapas simulado). Mais: seed de dados de desenvolvimento (`npm run seed:dev`) para facilitar testes manuais.
- **Critérios de aceite:** `npm run e2e` verde; nenhuma violação de CSP no console.

### Z-11: Usar a E1 em compras reais e aprovar

- **Responsável:** Zuma
- **Depende de:** C-30 (e deploy automático)
- **Fazer:** usar o app em **pelo menos 2 ciclos reais** (conferência → lista → compra → nota), idealmente cobrindo a feira mensal e as idas semanais. Anotar: tempo de conferência; se a lista bateu com o que faltava; quantas "compras de emergência" ocorreram; se a regra de cobertura puxou itens para a hora certa; incômodos. Validar a **interpretação da regra de lista** descrita na C-20 e os **valores padrão** (folga, vida útil). Registrar em `docs/feedback-e1.md`.
- **Pronto quando:** a Zuma aprova ou pede ajustes.

---

# FASE 4: Preços e comparação (marco M2)

### C-31: Preços normalizados e histórico

- **Responsável:** claude-code
- **Depende de:** C-21
- **Contexto:** RN-07, RF-901. Comparar sempre pelo **preço normalizado**.
- **Fazer:** `src/domain/precos.ts`: `precoNormalizado(item)`: `KG` → centavos por kg; `UNID` → centavos por unidade; **embalagem** (ex.: `PCT 180` extraída na C-06) → centavos por **100 g** ou por unidade de medida quando houver tamanho; mesma lógica para `L`/`ML`. `historicoDoProduto(compras, produtoId)` ordenado por data, com mercado e preço normalizado. `variacao(atual, anterior)` em %. `mediaDoUsuario(historico, janela)`. Atualizar a tela `/precos` para usar isso: último preço, variação, menor e maior, média, histórico por mercado, gráfico simples (linha ou barras em SVG, sem biblioteca; justificar se adicionar uma).
- **Critérios de aceite:** testes tabelados com kg, unidade, pacote de 180 g, litro; nota de exemplo gera histórico de 16 produtos.

### C-32: Alertas de preço na lista

- **Responsável:** claude-code
- **Depende de:** C-31, C-24
- **Fazer:** na lista e no modo compra, selo **"preço X% acima da sua média"** quando o último preço conhecido do produto exceder a média do usuário em mais que o `limiarAlertaPrecoPct` (padrão 20%) e houver **pelo menos 3 compras** no histórico; selo discreto "abaixo da média" quando estiver muito abaixo (opcional). Configurável em Ajustes (C-22).
- **Critérios de aceite:** testes: 2 compras não geram alerta; 3 compras com último preço 25% acima geram; limiar editado muda o resultado.

### C-33: Comparação entre mercados e cesta

- **Responsável:** claude-code
- **Depende de:** C-31, C-27
- **Contexto:** RF-903, RF-905. Só faz sentido com preços de pelo menos dois mercados.
- **Fazer:** `src/domain/comparacao.ts`: `melhorMercadoPorProduto` (menor preço normalizado **mais recente** por mercado, dentro de uma janela de 60 dias, configurável); `custoDaCesta(produtos, mercado)` (cesta = itens da lista padrão ou do catálogo ativo com meta; só soma produtos com preço conhecido naquele mercado e **informa a cobertura**, por exemplo "preços de 18 de 24 itens"); `sugerirMercadoPreferido` (quando houver preços de ≥ 2 mercados e a diferença passar de um limiar, sugerir; **nunca troca sozinho**). Tela `/precos` (aba "Comparar"): por produto, preço em cada mercado com o melhor destacado; resumo da cesta por mercado.
- **Critérios de aceite:** testes com 2 e 3 mercados, janela de tempo, produto sem preço em um mercado, empate.

### C-34: Economia líquida e divisão da lista

- **Responsável:** claude-code
- **Depende de:** C-33, C-28
- **Contexto:** RN-09, RF-904, RF-908. Evita que "mercado mais barato" aumente o número de idas.
- **Fazer:** `src/domain/economia.ts`: `economiaLiquida(economiaPrecoCentavos, custoIdaExtraCentavos)`. `proporDivisao(lista, mercados)`: para a lista da ida, calcula quanto se economiza comprando cada grupo de itens no mercado mais barato **contra** o mercado habitual e desconta o custo da ida extra (custo de ida do `Mercado`); só **propõe** dividir quando a economia líquida for **positiva** e acima de um limiar mínimo configurável (padrão R$ 5,00). `avisoIdaPoucoVantajosa`: ida com poucos itens e custo da ida alto (ex.: "esta ida tem 4 itens, R$ 18, e custa R$ 11 para ir e voltar. Dá para esperar a feira mensal?"; limiar: custo da ida ≥ 40% do total estimado **ou** menos de 5 itens; parametrizável). UI: na lista, banner "Dividir a lista entre A e B economiza R$ X líquidos" com botão para aplicar (cria duas listas); aviso de ida pouco vantajosa.
- **Critérios de aceite:** testes: economia menor que a ida → não propõe; maior → propõe; bike elétrica (custo ~0) tende a propor; aviso dispara nos limiares; dividir cria duas listas sem perder itens.

### C-35: Gastos, deslocamento e inflação pessoal

- **Responsável:** claude-code
- **Depende de:** C-31, C-28
- **Contexto:** RF-906 e RF-907.
- **Fazer:** `src/domain/gastos.ts` e tela `/gastos` (ou aba em Preços): **gasto por categoria por mês**; **gasto com deslocamento por mês** (soma de `custoIdaCentavos`); **custo real** mensal (itens + ida); **inflação pessoal** mês a mês: variação do custo de uma **cesta fixa** (os produtos comprados em ambos os meses, com a mesma quantidade de referência, a preços normalizados) para evitar distorção por mudança de consumo. Gráficos simples em SVG.
- **Critérios de aceite:** testes com 3 meses de dados de fixture: totais por categoria, deslocamento e variação da cesta conferem com o cálculo manual.

### C-36: Painel do objetivo

- **Responsável:** claude-code
- **Depende de:** C-26, C-28
- **Contexto:** M10 do blueprint e seção 13.1; objetivo: reduzir as idas semanais.
- **Fazer:** rota `/painel` com, por mês: **idas** (por tipo), **compras de emergência** (itens fora da lista em ida de reposição, de C-26), **rupturas** (quando o usuário marcou `acabou` antes da próxima ida prevista ou um produto virou emergência), **tempo médio de conferência** (de C-23), **% de itens da nota já casados** com o catálogo (itens cujo apelido existia antes da importação), **gasto com deslocamento** e **minutos em idas** (tempo estimado × idas, **só informação**, sem valorar). Comparar o mês atual com o anterior e mostrar tendência (▲ ▼). Texto curto de interpretação por métrica.
- **Critérios de aceite:** testes de cálculo de cada métrica com fixtures; painel vazio mostra orientação em vez de zeros enganosos.

### C-37: Testes e2e da E2

- **Responsável:** claude-code
- **Depende de:** C-31 a C-36
- **Fazer:** cenários e2e com dados de fixture de 3 meses e 2 mercados: histórico e variação, alerta de preço, comparação e cesta, divisão da lista (positiva e negativa), gastos, painel.
- **Critérios de aceite:** `npm run e2e` verde.

### Z-12: Usar a E2 e aprovar

- **Responsável:** Zuma
- **Depende de:** C-37
- **Fazer:** usar por algumas semanas; avaliar se os alertas e a comparação mudam o que e onde compra, se a economia líquida faz sentido com carro e com bike elétrica, e se o painel mostra o progresso na redução de idas. Registrar em `docs/feedback-e2.md`.
- **Pronto quando:** aprovação ou pedido de ajustes.

---

# FASE 5: Produção (marco M3)

### C-38: Segurança final

- **Responsável:** claude-code
- **Depende de:** M2
- **Fazer:** executar o **checklist de segurança** (`AGENTS.md` seção 14.6) e registrar o resultado em `docs/seguranca.md`: headers e CSP revisados contra o que o app realmente carrega (nenhuma origem a mais, nenhuma a menos); `npm audit` sem críticos; nenhuma variável sensível no código e `.env.example` completo; confirmar que **CPF nunca é guardado** (teste com texto que contenha CPF); confirmar que **nada é inserido com `innerHTML`**; confirmar que a localização da casa não é enviada a nenhum serviço e que só coordenadas e endereço do mercado vão ao serviço de mapas; revisar dependências (licenças compatíveis, versões fixadas) e o `AGENTS.md`.
- **Critérios de aceite:** documento com cada item do checklist marcado e evidência.

### C-39: Performance e acessibilidade

- **Responsável:** claude-code
- **Depende de:** M2
- **Fazer:** medir com Lighthouse (mobile): PWA instalável, acessibilidade ≥ 90, performance ≥ 85 nas telas principais; **o OCR e o QR só carregam sob demanda** (verificar no relatório de bundle que `tesseract.js` e `jsqr` não estão no bundle inicial); navegação por teclado e leitor de tela nos fluxos principais (rótulos, foco, contraste AA); tamanho do primeiro carregamento. Corrigir o que ficar abaixo.
- **Critérios de aceite:** relatório em `docs/qualidade.md` com os números e as correções.

### C-40: Documentação final

- **Responsável:** claude-code
- **Depende de:** M2
- **Fazer:** atualizar `README.md`, `AGENTS.md`, `docs/deploy.md`; criar `docs/arquitetura.md` (camadas, fluxo de dados, regras de negócio com as fórmulas implementadas, decisões D-xx), `docs/usuario.md` (guia curto de uso para a Zuma: rotina antes, durante e depois da ida), `docs/backup.md` (exportar, restaurar, trocar de aparelho) e `CHANGELOG.md`. Atualizar o `blue-print.md` com as decisões e as questões em aberto que foram resolvidas.
- **Critérios de aceite:** um desenvolvedor novo roda, testa e faz deploy só com os documentos.

### Z-13: Rotina de revisão e monitoramento

- **Responsável:** Zuma
- **Depende de:** Z-08
- **Fazer:** conferir o monitor no Uptime Kuma; simular uma queda do container para testar o alerta; agendar a **revisão trimestral** do padrão (`npm audit`, `npm outdated`, logs, disco, imagens antigas, registro do Cloudflare ainda laranja); combinar uma rotina de **backup** (exportar o arquivo de backup pelo menos uma vez por mês e guardar fora do celular).
- **Pronto quando:** alerta testado e rotina anotada no calendário.

---

## 2. Checklist de acompanhamento

### Zuma

- [ ] Z-01 Repositório
- [ ] Z-02 Materiais de referência
- [ ] Z-03 Notas reais adicionais
- [ ] Z-04 Domínio e DNS
- [ ] Z-05 VPS preparada
- [ ] Z-06 Secrets
- [ ] Z-07 Parâmetros iniciais
- [ ] Z-08 Primeiro deploy
- [ ] Z-09 Teste no celular (E0.5)
- [ ] Z-10 Serviço de mapas
- [ ] Z-11 Aprovação E1
- [ ] Z-12 Aprovação E2
- [ ] Z-13 Monitoramento e rotina

### claude-code

- [x] C-01 Scaffold
- [x] C-02 AGENTS.md e README
- [x] C-03 Headers e CSP
- [ ] C-04 Modelos e schemas
- [ ] C-05 Chave e QR
- [ ] C-06 Parser da nota
- [ ] C-07 Repositórios e backup
- [ ] C-08 Layout e componentes
- [ ] C-09 PWA e offline
- [ ] C-10 QR e OCR
- [ ] C-11 Tela Importar
- [ ] C-12 Compras, Preços e Backup
- [ ] C-13 e2e de paridade
- [ ] C-14 Docker
- [ ] C-15 CI e deploy
- [ ] C-16 Correções E0.5
- [ ] C-17 Spike de mapas
- [ ] C-18 Estoque e cobertura
- [ ] C-19 Agenda
- [ ] C-20 Geração da lista
- [ ] C-21 Catálogo
- [ ] C-22 Ajustes
- [ ] C-23 Conferência
- [ ] C-24 Lista
- [ ] C-25 Modo compra
- [ ] C-26 Reconciliação
- [ ] C-27 Mercados e casa
- [ ] C-28 Estimativa da ida
- [ ] C-29 Início
- [ ] C-30 e2e E1
- [ ] C-31 Preços normalizados
- [ ] C-32 Alertas de preço
- [ ] C-33 Comparação e cesta
- [ ] C-34 Economia líquida
- [ ] C-35 Gastos e inflação
- [ ] C-36 Painel
- [ ] C-37 e2e E2
- [ ] C-38 Segurança final
- [ ] C-39 Performance e acessibilidade
- [ ] C-40 Documentação final

---

## 3. Suposições registradas (valores padrão assumidos)

Estes valores foram assumidos para não bloquear a implementação. Todos são editáveis no app e a Zuma valida nas tarefas Z-07 e Z-11.

| Parâmetro                                           | Valor assumido                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Folga da regra de cobertura                         | 2 dias                                                                                                |
| Feira mensal                                        | dia 5                                                                                                 |
| Mercado semanal                                     | sábado                                                                                                |
| Hortifruti semanal                                  | quarta (Cia Santos)                                                                                   |
| Limiar do alerta de preço                           | 20% (mínimo de 3 compras)                                                                             |
| Carro                                               | 10 km/L, combustível R$ 6,00, desgaste R$ 0,30/km                                                     |
| Bike elétrica                                       | R$ 0,05/km                                                                                            |
| Vida útil por categoria (dias)                      | hortifruti 7, laticínios 10, carnes 3, mercearia 180, limpeza 365, higiene 365, bebidas 90, outros 90 |
| Economia mínima para propor divisão da lista        | R$ 5,00                                                                                               |
| Aviso de ida pouco vantajosa                        | custo da ida ≥ 40% do total estimado, ou menos de 5 itens                                             |
| Limite de memória do container                      | 256 MB                                                                                                |
| Regra de "puxar" item da feira para uma ida semanal | seção C-20 (interpretação formal a validar na Z-11)                                                   |
