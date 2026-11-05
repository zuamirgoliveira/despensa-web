# Despensa (`despensa-web`)

PWA de gestão da despensa e das compras da casa. Roda 100% no aparelho (IndexedDB), funciona offline e instala no Android. Em português do Brasil.

- Produto e requisitos: [docs/blue-print.md](docs/blue-print.md)
- Como usar: [docs/usuario.md](docs/usuario.md) · Backup: [docs/backup.md](docs/backup.md)
- Arquitetura: [docs/arquitetura.md](docs/arquitetura.md) · Deploy: [docs/deploy.md](docs/deploy.md)
- Segurança: [docs/seguranca.md](docs/seguranca.md) · Qualidade: [docs/qualidade.md](docs/qualidade.md)
- Plano de execução: [docs/tarefas.md](docs/tarefas.md)
- Referência técnica (stack, regras, segurança, deploy): [AGENTS.md](AGENTS.md)

## Requisitos

Node 22 (`nvm use`, versão em `.nvmrc`) e npm 10+.

## Instalar e rodar

```bash
npm ci
npm run dev        # http://localhost:3000
```

Para câmera, OCR e service worker use `npm run build && npm start` (ou HTTPS/localhost).
O OCR precisa dos arquivos em `public/vendor/tesseract/`, gerados por `npm run build`
(ou `npm run vendor` no desenvolvimento).

## Comandos

| Comando             | Função                                  |
| ------------------- | --------------------------------------- |
| `npm run dev`       | servidor de desenvolvimento             |
| `npm run build`     | build standalone                        |
| `npm start`         | serve o build                           |
| `npm run lint`      | ESLint                                  |
| `npm run typecheck` | `tsc --noEmit`                          |
| `npm test`          | Vitest                                  |
| `npm run e2e`       | Playwright contra `next start` (porta por `E2E_PORT`; exige `npm run build`) |
| `npm run seed:dev`  | gera dados de desenvolvimento para importar em Ajustes |

## Estrutura

```
src/domain      regras de negócio puras (sem React nem IndexedDB)
src/data        repositórios, migrações e backup (IndexedDB)
src/schemas     schemas Zod
src/lib         QR, OCR, formatação, datas, headers
src/components  componentes de interface
src/app         telas (App Router)
tests / e2e     Vitest e Playwright
referencia/     protótipo em JS puro (somente leitura)
```

Antes de abrir PR: `npm run typecheck && npm run lint && npm test && npm run build`.
