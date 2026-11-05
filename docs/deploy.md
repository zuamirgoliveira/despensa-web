# Runbook de deploy: despensa-web

Para quem opera a VPS. Não exige conhecimento prévio do projeto. Referência técnica: [AGENTS.md](../AGENTS.md) seções 10 e 14.

**Como funciona:** todo push na `main` roda o workflow `deploy.yml`. Ele valida (lint, tipos, testes, build), constrói a imagem Docker no GitHub, envia a imagem por SSH para a VPS (`docker save | gzip | ssh ... "gunzip | docker load"`, **sem registry**) e recria o container com `docker compose`. Não há deploy manual fora desse fluxo, exceto o rollback abaixo.

## 0. O que você precisa ter

- VPS com Docker, Docker Compose v2, a rede Docker externa `web` e o Traefik (entrypoints `web` na 80 e `websecure` na 443, resolvedor de certificado `le`). Se os nomes forem outros, ajuste os `labels` em `docker-compose.yml` e registre no `AGENTS.md` (seção 14.2).
- Usuário `deploy` na VPS, com permissão para usar o Docker (grupo `docker`). Nunca usar root no deploy.
- Domínio ou subdomínio (ex.: `despensa.seudominio.com.br`) no Cloudflare.
- Repositório privado `zuamirgoliveira/despensa-web` no GitHub, com acesso de administrador para você.

## 1. DNS (Cloudflare)

1. Crie um registro `A` (ou `AAAA`) do domínio apontando para o IP da VPS.
2. Deixe o **proxy ativo (nuvem laranja)**.
3. Em SSL/TLS, use o modo **Full (strict)** (o Traefik emite o certificado pelo Let's Encrypt).
4. Confira: `dig +short despensa.seudominio.com.br` deve responder um IP (do Cloudflare, com o proxy ativo).

## 2. Preparar a VPS (uma vez)

Como `root` ou com `sudo`:

```bash
sudo mkdir -p /opt/docker/despensa-web
sudo chown deploy:deploy /opt/docker/despensa-web
docker network ls | grep -w web      # a rede web precisa existir
docker ps --format '{{.Names}}' | grep -i traefik   # o Traefik precisa estar no ar
```

Como usuário `deploy`:

```bash
cd /opt/docker/despensa-web
printf 'NODE_ENV=production\nDOMINIO=despensa.seudominio.com.br\n' > .env
chmod 600 .env
```

O app não tem segredos de servidor: o `.env` só guarda `NODE_ENV` e o `DOMINIO` lido pelos labels do Traefik.

### Copiar o `docker-compose.yml`

Do seu computador, na pasta do repositório:

```bash
scp docker-compose.yml deploy@IP_DA_VPS:/opt/docker/despensa-web/
```

Quando o `docker-compose.yml` mudar no repositório, copie de novo (o workflow não o copia).

### Chave SSH do deploy

No seu computador (uma chave exclusiva deste projeto, sem senha, para o GitHub Actions usar):

```bash
ssh-keygen -t ed25519 -C "deploy-despensa-web" -f ./despensa_deploy -N ""
ssh-copy-id -i ./despensa_deploy.pub deploy@IP_DA_VPS     # ou cole a linha em ~deploy/.ssh/authorized_keys
ssh -i ./despensa_deploy deploy@IP_DA_VPS 'docker ps >/dev/null && echo ok'   # deve imprimir ok
```

Guarde o conteúdo de `./despensa_deploy` (a chave **privada**) para o próximo passo e **apague os dois arquivos** do seu computador depois.

## 3. Secrets do GitHub

Em _Settings → Secrets and variables → Actions → New repository secret_:

| Secret                 | Valor                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | `https://despensa.seudominio.com.br`                                   |
| `VPS_HOST`             | IP ou host da VPS                                                      |
| `VPS_USER`             | `deploy`                                                               |
| `VPS_SSH_KEY`          | conteúdo completo da chave **privada** (inclui as linhas `-----BEGIN`) |

Se o serviço de mapas exigir chave (tarefa C-28), acrescente `NEXT_PUBLIC_MAPS_KEY` e o `--build-arg` correspondente em `deploy.yml`. Chaves de uso no navegador são públicas por natureza: restrinja por domínio no provedor.

## 4. Primeiro deploy

1. Garanta que `docker-compose.yml` e `.env` estão em `/opt/docker/despensa-web` (seção 2).
2. Faça push na `main` (ou rode o workflow manualmente em _Actions → deploy → Run workflow_).
3. Acompanhe os jobs `qualidade` e `deploy`. O `deploy` leva alguns minutos (build + envio da imagem de ~350 MB).
4. Na VPS: `cd /opt/docker/despensa-web && docker compose ps` deve mostrar `despensa-web` em execução.

## 5. Verificar

```bash
curl -I https://despensa.seudominio.com.br
```

Esperado: `HTTP/2 200` e os headers:

- `content-security-policy:` com `default-src 'self'`, `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`, `worker-src 'self' blob:` etc.
- `x-frame-options: SAMEORIGIN`
- `x-content-type-options: nosniff`
- `referrer-policy: strict-origin-when-cross-origin`
- `permissions-policy: camera=(self), microphone=(), geolocation=(self)`

Outras checagens:

```bash
curl -I http://despensa.seudominio.com.br              # 301/308 para https
curl -I https://despensa.seudominio.com.br/sw.js       # cache-control: no-cache
docker inspect despensa-web --format '{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}'   # 268435456 250000000
docker exec despensa-web id                            # uid=1001(nextjs), nunca root
```

No celular (Android, Chrome): abra o endereço, instale pelo menu (Adicionar à tela inicial) e teste câmera, foto, Compartilhar e modo avião (tarefa Z-09).

## 6. Operação

Na VPS, em `/opt/docker/despensa-web`:

| O que                | Comando                                                      |
| -------------------- | ------------------------------------------------------------ |
| Estado               | `docker compose ps`                                          |
| Logs                 | `docker logs despensa-web --tail 100` (`-f` para acompanhar) |
| Reiniciar            | `docker compose restart`                                     |
| Uso de memória e CPU | `docker stats despensa-web --no-stream`                      |
| Espaço em disco      | `df -h` e `docker system df`                                 |

O `docker image prune -af` do workflow remove **todas** as imagens sem container, inclusive a anterior do `despensa-web`. Se a VPS hospeda outros projetos, imagens deles que estejam paradas também são removidas. Por isso o rollback abaixo prefere reconstruir a partir do Git.

## 7. Rollback

**Opção A (recomendada): voltar o código.** Na máquina de desenvolvimento:

```bash
git revert <commit-ruim>        # cria um commit que desfaz a mudança
git push origin main            # o workflow publica a versão anterior
```

**Opção B: reenviar uma imagem salva.** Antes de uma mudança arriscada, na VPS:

```bash
docker save despensa-web:latest | gzip > ~/despensa-web-$(date +%F).tar.gz
```

Para voltar:

```bash
cd /opt/docker/despensa-web
gunzip -c ~/despensa-web-AAAA-MM-DD.tar.gz | docker load
docker compose up -d --force-recreate
```

Se precisar parar o app: `docker compose down` (os dados dos usuários ficam no navegador de cada pessoa, não na VPS).

## 8. Monitoramento (Uptime Kuma)

1. _Add New Monitor_ → tipo **HTTP(s)**.
2. URL `https://despensa.seudominio.com.br`, intervalo de 60 s, tentativas 3.
3. Em _Advanced_, marque a validação do certificado e, se quiser, use "Keyword" com o texto `Despensa`.
4. Ligue as notificações (e-mail, Telegram etc.).
5. Teste o alerta: `docker compose stop` na VPS, espere o aviso, depois `docker compose start`.

## 9. Problemas comuns

| Sintoma                            | Causa provável                                          | O que fazer                                                                      |
| ---------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Job `deploy` falha no `ssh`        | chave errada, usuário sem Docker ou host desconhecido   | refazer a seção 2 (chave) e conferir os secrets                                  |
| `network web not found`            | rede externa inexistente                                | conferir o nome da rede do Traefik e ajustar o compose                           |
| Site responde 404 do Traefik       | `DOMINIO` errado no `.env` ou entrypoint com outro nome | conferir `.env` e os labels; `docker compose up -d --force-recreate`             |
| Certificado não emitido            | DNS não aponta para a VPS ou Cloudflare em modo errado  | conferir DNS, modo Full (strict), logs do Traefik                                |
| Câmera ou instalação indisponíveis | acesso por HTTP                                         | usar sempre `https://`                                                           |
| Container reinicia sem parar       | falta de memória (limite de 256 MB)                     | `docker logs`, `docker stats`; ajustar o limite em `docker-compose.yml`          |
| App não atualiza no celular        | service worker antigo                                   | abrir o app online; o aviso "Nova versão disponível" aparece, toque em Atualizar |

## 10. Revisão trimestral

`npm audit --omit=dev`, `npm outdated`, logs do container, espaço em disco, imagens antigas (`docker image ls`) e conferir que o registro no Cloudflare continua com o proxy ativo (nuvem laranja).
