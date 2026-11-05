# Checklist de segurança (Perfil A) — resultado da C-38

Verificado em 05/11/2026 sobre a `main`. Cada item aponta a evidência (teste automatizado ou comando). Itens marcados **[VPS]** só podem ser conferidos em produção pela Zuma (runbook em `docs/deploy.md`, seção 5).

| # | Item | Resultado | Evidência |
| - | ---- | --------- | --------- |
| 1 | Headers e CSP (9.1) presentes e exatos | ✅ local e na imagem Docker | `tests/lib/security-headers.test.ts` (cada diretiva); `curl -I` no container da imagem (CSP, `x-frame-options`, `permissions-policy: camera=(self), microphone=(), geolocation=(self)`, `/sw.js` com `cache-control: no-cache`). **[VPS]** repetir com `curl -I https://DOMINIO` |
| 2 | CSP bate com o que o app realmente carrega (nenhuma origem a mais, nenhuma a menos) | ✅ | os e2e falham em qualquer violação de CSP (`semViolacaoDeCsp` em todos os fluxos: câmera, OCR com worker/WebAssembly, Compartilhar, mapas simulados, offline). `connect-src` só tem `'self'` + `nominatim.openstreetmap.org` + `routing.openstreetmap.de`; `img-src blob:`/`worker-src blob:` servem à prévia da foto e ao worker do Tesseract; `'unsafe-inline'` é do Next |
| 3 | `npm audit --omit=dev` sem críticas/altas | ✅ 0 vulnerabilidades | `npm audit --omit=dev` |
| 4 | Sem segredos no código; `.env.example` completo | ✅ | `git ls-files` sem `.env`/chaves; as únicas variáveis são `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MAPS_KEY` (sem uso com o serviço atual) e, na VPS, `NODE_ENV`/`DOMINIO` |
| 5 | CPF nunca é guardado | ✅ | `tests/domain/nfce/parser.test.ts` (texto com CPF: só `cpfNaNota`, nunca o número); `tests/data/importarNota.test.ts` e `repositorios.test.ts` (backup e dados sem CPF/texto bruto); `tests/seed-dev.test.ts` |
| 6 | Nada é inserido com `innerHTML`/`dangerouslySetInnerHTML`/`eval`/`confirm`/`alert`/`prompt` | ✅ | `tests/seguranca-estatica.test.ts` (varre `src/`) |
| 7 | Localização da casa não é enviada; ao serviço de mapas vão só coordenadas e o endereço do mercado | ✅ | `e2e/estimativa-ida.spec.ts` (inspeciona todos os pedidos: geocodificador só recebe `q` com o endereço do mercado; rotas só coordenadas); sem `watchPosition` (teste estático); captura única por toque |
| 8 | Sem backend, rota de API, autenticação ou `middleware`/`proxy` | ✅ | `tests/seguranca-estatica.test.ts` |
| 9 | IndexedDB só pela camada de repositório; domínio sem React/IndexedDB | ✅ | `tests/seguranca-estatica.test.ts` |
| 10a | Cópia de segurança: restauração atômica, soma de verificação e confirmação | ✅ | `tests/data/restauracao.test.ts` (falha simulada no meio, mutação sem `tx.abort()`, registro inválido e chave duplicada recusados sem gravar); `tests/data/backupV2.test.ts` (arquivo alterado ou cortado); `e2e/backup.spec.ts` (confirmação dupla, "Entendi" obrigatório). A cópia leva a posição de casa por padrão (opção de omitir) e só sai do aparelho por escolha do usuário (compartilhar ou download); o app não a envia a nenhum serviço |
| 10 | Dados lidos do IndexedDB e de backup passam por Zod | ✅ | `ColecaoIdb` valida leitura e escrita; `lerBackup`; `tests/data/repositorios.test.ts` (registro corrompido e backup inválido são recusados) |
| 11 | Dependências: versões fixadas e licenças compatíveis | ✅ | `package-lock.json` com `npm ci`; licenças diretas: MIT e Apache-2.0 (jsqr, tesseract.js, @playwright/test, fake-indexeddb, typescript). `vitest` fixado em 4.0.18 (ver `AGENTS.md` seção 2) |
| 12 | Container não roda como root e tem limites | ✅ imagem / **[VPS]** limites | `docker exec ... id` → `uid=1001(nextjs)`; limites no `docker-compose.yml` (256 MB, 0,25 CPU) — conferir com `docker inspect` na VPS |
| 13 | Imagem não vai a registry | ✅ | `deploy.yml`: `docker save | gzip | ssh ... docker load` |
| 14 | HTTPS com redirect permanente; Cloudflare com proxy ativo | **[VPS]** | `docker-compose.yml` (labels do Traefik) e `docs/deploy.md` |
| 15 | Monitor ativo no Uptime Kuma | **[VPS]** | `docs/deploy.md` seção 8 |
| 16 | `.env` da VPS com permissão 600 | **[VPS]** | `docs/deploy.md` seção 2 |
| 17 | Texto da SEFAZ/QR/backup renderizado só como texto | ✅ | React escapa; item 6 impede as saídas de emergência |
| 18 | Captcha da SEFAZ não é contornado | ✅ | o app só copia a chave e abre a página (`e2e/importar.spec.ts`); regra permanente nº 1 |

## Pendências para a Zuma

- Itens **[VPS]** acima, depois do primeiro deploy (Z-08).
- Rodar `actionlint` nos workflows (não pôde ser executado aqui; ver `docs/bloqueios.md`).
- Revisão trimestral: `npm audit`, `npm outdated`, logs, disco e imagens antigas.
