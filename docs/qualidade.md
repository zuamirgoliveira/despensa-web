# Qualidade: bundle, desempenho e acessibilidade (C-39)

Medido em 05/11/2026 sobre a `main` (build de produção, viewport 390×844).

## Carregamento inicial (JavaScript, sem OCR nem leitura de QR)

| Tela        | Scripts | Tamanho | Gzip   | Contém OCR/QR no carregamento? |
| ----------- | ------- | ------- | ------ | ------------------------------ |
| `/` (Início)| 10      | 729 KB  | 224 KB | não                            |
| `/lista`    | 10      | 753 KB  | 232 KB | não                            |
| `/compras`  | 10      | 722 KB  | 222 KB | não                            |
| `/importar` | 11      | 763 KB  | 237 KB | não (só o código-cola que decide carregar) |

`tesseract.js` (chunk `32m643m45t5ua`) e `jsqr` (chunk `39fgiytt47ohq`) são chunks **dinâmicos**: não aparecem entre os scripts de nenhuma tela e só são baixados quando o usuário usa foto ou QR (`import()` em `lib/ocr.ts` e `lib/qr.ts`). Os ~11 MB do OCR (worker, core, idioma) vêm de `/vendor/tesseract/` sob demanda e entram no cache do service worker no primeiro uso.

Como repetir: o script na seção "Como medir" abaixo.

## Acessibilidade e toque (automatizado)

`e2e/acessibilidade.spec.ts`, em 11 rotas e no 390×844:

- `lang="pt-BR"`, meta viewport, **um** `h1` por tela.
- Todo botão, link, campo, select e textarea visível tem **nome acessível** (rótulo, `aria-label` ou texto).
- Todo alvo de toque visível tem **≥ 44 × 44 px** (checkbox: o rótulo inteiro conta).
- Sem rolagem horizontal.
- Foco visível na barra inferior; menu **Mais** abre com Enter e fecha com Esc.

Contraste: a paleta (`#1f6f4a` sobre branco, `#1d2420` sobre `#f6f8f7`, `#9b1c1c`, `#8a5a00`) atende AA (≥ 4,5:1) para texto normal. Texto auxiliar usa `text-texto/70` sobre branco, ainda acima de 4,5:1.

## Lighthouse (mobile): pendente

Não foi possível rodar o Lighthouse neste ambiente (o comando precisa baixar e executar um pacote externo e foi bloqueado). **Pendência para a Zuma** (ou para um passo do CI), na VPS ou local:

```bash
npm run build && npm start        # em outro terminal
npx lighthouse http://localhost:3000 --form-factor=mobile --only-categories=performance,accessibility,pwa --view
```

Metas: acessibilidade ≥ 90, desempenho ≥ 85, PWA instalável (manifest com ícones 192/512/maskable, service worker, `start_url`/`scope`). Os itens do manifest e do service worker já são cobertos por `e2e/offline.spec.ts`. Registrar os números aqui quando medidos; corrigir o que ficar abaixo.

## Como medir o bundle inicial

```bash
npm run build
node -e '
const fs=require("fs"),zlib=require("zlib");
const html=fs.readFileSync(".next/server/app/index.html","utf8");
const js=[...new Set([...html.matchAll(/\/_next\/static\/(chunks\/[^"\\]+\.js)/g)].map(m=>m[1]))];
let kb=0,gz=0;for(const f of js){const b=fs.readFileSync(".next/static/"+f);kb+=b.length;gz+=zlib.gzipSync(b).length}
console.log(js.length,"scripts",(kb/1024).toFixed(0),"KB",(gz/1024).toFixed(0),"KB gzip")'
```
