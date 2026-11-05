# Blueprint do produto: Despensa

> Gestão da despensa e das compras de uma casa, com lista gerada a partir do estoque, notas fiscais importadas e controle do custo de cada ida ao mercado.
>
> **Nome:** provisório ("Despensa"). **Versão do documento:** 1.1, 04/11/2026.
> **Stack:** padrão da Raia Manta (Perfil A com dados locais), com caminho de evolução para os Perfis C e D. Ver seção 10.
> **Fase:** discovery concluída, MVP pessoal em construção. Multiusuário e cobrança só depois da validação.

---

## 1. Visão e objetivo

### 1.1 Problema

Uma casa compra de forma recorrente, esquece o que já tem, compra em excesso ou deixa faltar, faz idas de emergência ao mercado e não sabe se paga caro. Os apps de lista de compras resolvem a lista, mas não o planejamento entre as idas nem o histórico real de preços.

### 1.2 Objetivo do MVP (uso pessoal)

**Reduzir as idas semanais ao mercado** com uma gestão da despensa "boa o suficiente", e acumular dados reais de preço e de custo de deslocamento para decidir melhor onde e quando comprar.

### 1.3 Proposta de valor (diferenciais)

1. **A lista nasce do estoque e do consumo**, não de digitação do zero.
2. **O histórico de preços vem da nota fiscal**, sem digitar cada item.
3. **O app planeja a cobertura entre as idas** (feira mensal, mercado semanal, hortifruti semanal), em vez de só gerar uma lista.
4. **O custo de cada ida entra na conta**, para que "mercado mais barato" e "menos idas" não se contradigam.

### 1.4 Quem usa

- **Agora:** uma pessoa (o autor), no celular Android, em Pernambuco, com compras em vários mercados.
- **Depois da validação:** a família (multiusuário) e eventualmente outros usuários (cobrança).

### 1.5 Princípios de produto

1. **Estoque por exceção.** O app estima e o usuário só confirma o que fugiu.
2. **Nível em vez de quantidade** na maior parte dos itens.
3. **Nada trava a compra.** Preço, quantidade exata e nota fiscal são opcionais na hora.
4. **Funciona offline** (sinal ruim dentro do mercado).
5. **Dados no aparelho.** Privacidade por padrão.
6. **Nunca aceitar dado errado em silêncio.** Toda leitura automática é validada e, se houver dúvida, o app pergunta.
7. **Pouco atrito.** Cada passo manual precisa justificar sua existência.

---

## 2. Escopo

### 2.1 Dentro do MVP

Importação de nota fiscal, catálogo, agenda das idas, estoque por nível, lista inteligente, modo compra, fechamento da compra com conferência, mercados e custo de ida, e (na etapa seguinte) preços e comparação.

### 2.2 Fora do MVP (futuro)

Multiusuário e compartilhamento com a família, cobrança, sincronização entre aparelhos, validade dos produtos, cardápio e receitas, leitura dos itens direto da foto da nota, uso do código de barras (EAN), ida com duas paradas, comparação ida contra entrega, integração paga com APIs de nota fiscal.

---

## 3. Glossário

| Termo                   | Significado                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------- |
| **NFC-e**               | Nota Fiscal de Consumidor Eletrônica (modelo 65), a nota de supermercado e hortifruti. |
| **Chave de acesso**     | Código de 44 dígitos que identifica a nota.                                            |
| **Produto**             | Item do catálogo da casa.                                                              |
| **Apelido por mercado** | Ligação entre `CNPJ do mercado + código interno` e um produto do catálogo.             |
| **Nível**               | Estado do estoque de um produto: cheio, metade, acabando, acabou.                      |
| **Tipo de ida**         | Feira mensal, mercado semanal ou hortifruti semanal.                                   |
| **Cobertura**           | Quantos dias o estoque atual do produto dura.                                          |
| **Meta**                | Quantidade padrão que a casa quer ter de um produto.                                   |
| **Ida de emergência**   | Compra fora do plano porque algo acabou antes da hora.                                 |
| **Economia líquida**    | Economia de preço de comprar em outro mercado menos o custo da ida extra.              |

---

## 4. Fluxos de uso

### 4.1 Ciclo principal

```
Conferir despensa → Lista gerada por tipo de ida → Modo compra no mercado
        ↑                                                  ↓
Estoque e preços atualizados ← Fechar a compra ← Importar a nota fiscal
```

### 4.2 Antes da ida (cerca de 3 min)

1. Abrir o app e escolher o tipo de ida (ou aceitar a próxima da agenda).
2. Conferir só os produtos que vencem nessa ida, tocando no nível de cada um.
3. A lista aparece pronta, com quantidades sugeridas e estimativa de custo.

### 4.3 No mercado

1. Marcar "peguei" em cada item, ajustar quantidade, adiar o que não encontrou, adicionar extras.
2. Preço é opcional na hora (a nota preenche depois).
3. Acompanhar o total corrente contra a estimativa.

### 4.4 Depois (cerca de 30 s)

1. Importar a nota: informar a chave (digitar, QR ou foto), abrir a SEFAZ, marcar o captcha, copiar o texto e colar no app.
2. Conferir a leitura e confirmar.
3. O app atualiza estoque, preços e custo da ida, e fecha a lista.

### 4.5 Importação da nota (fluxo implementado)

1. **Chave da nota**, de três formas: digitar/colar, escanear QR com a câmera, ou tirar foto / enviar imagem (QR primeiro, depois leitura da chave impressa).
2. **Consultar na SEFAZ:** o app copia a chave e abre o site; o usuário cola no campo, marca o captcha e consulta.
3. **Colar o resultado:** colar o texto, ou usar Compartilhar (Android, PWA instalado).
4. **Conferência:** soma dos itens contra o valor pago, nome do produto no catálogo, salvar.

---

## 5. Requisitos funcionais

Legenda de etapa: **E0** = já construído; **E1** = próxima etapa; **E2** = preços e comparação; **E3+** = depois.

### M1. Importação de nota fiscal (E0, concluído)

| ID     | Requisito                                                                                                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-101 | Aceitar a chave de 44 dígitos digitada ou colada, com ou sem espaços.                                                                                                                                                                                           |
| RF-102 | Validar a chave: 44 dígitos, dígito verificador (módulo 11), modelo 65. Mostrar UF, mês/ano, CNPJ, número e série.                                                                                                                                              |
| RF-103 | Ler QR Code com a câmera ao vivo (detector nativo quando existir, leitor próprio caso contrário, inclusive iPhone).                                                                                                                                             |
| RF-104 | Tirar foto ou enviar imagem: procurar QR Code; se não houver, ler a chave impressa por OCR no próprio aparelho.                                                                                                                                                 |
| RF-105 | Corrigir dígitos que o OCR confunde (8/3, 5/6, 1/7 etc.) só quando o dígito verificador e a validação do CNPJ permitirem; mostrar até 3 opções para o usuário escolher; se houver dúvida demais, pedir nova foto. Nunca preencher uma chave errada em silêncio. |
| RF-106 | Copiar a chave e abrir a página de consulta da SEFAZ do estado (hoje só Pernambuco). O usuário resolve o captcha.                                                                                                                                               |
| RF-107 | Aceitar o texto da nota colado ou recebido por Compartilhar.                                                                                                                                                                                                    |
| RF-108 | Extrair: mercado (nome, CNPJ, endereço), número, série, data e hora, protocolo, chave, forma de pagamento, valor a pagar e os itens (descrição, código interno, quantidade, unidade, valor unitário, valor total).                                              |
| RF-109 | Conferir: soma dos itens contra o valor a pagar; contagem de itens contra o total informado; quantidade × valor unitário em cada linha; CNPJ e número do texto contra a chave. Erros impedem salvar; avisos pedem atenção.                                      |
| RF-110 | Impedir duplicidade pela chave; permitir substituir.                                                                                                                                                                                                            |
| RF-111 | Não guardar CPF, mesmo que a nota o traga.                                                                                                                                                                                                                      |
| RF-112 | Lembrar o nome do produto escolhido para cada `CNPJ + código interno` (apelido por mercado).                                                                                                                                                                    |
| RF-113 | Mostrar compras e histórico de preço por produto; exportar e importar backup em arquivo.                                                                                                                                                                        |
| RF-114 | Funcionar offline depois do primeiro uso.                                                                                                                                                                                                                       |

### M2. Catálogo (E1)

| ID     | Requisito                                                                                                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-201 | O catálogo é **povoado pelas notas importadas**, sem cadastro manual obrigatório.                                                                                                                                                      |
| RF-202 | Cada produto tem: nome, categoria, unidade de compra (kg, un, pacote, litro), meta, frequência (semanal, quinzenal, mensal, sob demanda), tipo de ida padrão, vida útil (perecível ou durável), mercado preferido, ativo ou arquivado. |
| RF-203 | A **meta** é sugerida pela média do que o usuário costuma comprar e pode ser editada.                                                                                                                                                  |
| RF-204 | Categorias padrão (hortifruti, mercearia, limpeza, higiene, carnes, laticínios, bebidas, outros), editáveis.                                                                                                                           |
| RF-205 | Arquivar um produto tira o item das listas sem apagar o histórico de preços.                                                                                                                                                           |
| RF-206 | Itens avulsos fora do catálogo podem entrar numa lista pontual.                                                                                                                                                                        |
| RF-207 | A **frequência pertence ao produto**, não à lista.                                                                                                                                                                                     |

### M3. Agenda das idas (E1)

| ID     | Requisito                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-301 | Três tipos de ida: **feira mensal**, **mercado semanal**, **hortifruti semanal**.                                                                                      |
| RF-302 | Cada tipo tem agenda (dia do mês ou dia da semana), mercado habitual e escopo de produtos.                                                                             |
| RF-303 | O app calcula, para cada produto, a **próxima ida que o cobre**.                                                                                                       |
| RF-304 | O app sugere mudar o produto de tipo de ida conforme o comportamento real (ex.: comprado em várias idas semanais, sugerir levá-lo para a feira mensal com meta maior). |

### M4. Estoque por nível (E1)

| ID     | Requisito                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RF-401 | Quatro níveis: **cheio, metade, acabando, acabou**. Quantidade exata é opcional e só para itens que o usuário escolher (contáveis ou caros).                                                                             |
| RF-402 | Depois de uma compra, o produto comprado volta a **cheio** automaticamente.                                                                                                                                              |
| RF-403 | O app **estima o consumo** pelo intervalo e pela quantidade das compras e mostra "provavelmente acabando" para o usuário confirmar ou corrigir.                                                                          |
| RF-404 | **Conferência rápida da despensa:** um produto por vez, toque no nível, só dos produtos que vencem na próxima ida, agrupados por lugar da casa (geladeira, armário, área de serviço). Meta de tempo: menos de 3 minutos. |

### M5. Lista inteligente (E1)

| ID     | Requisito                                                                                           |
| ------ | --------------------------------------------------------------------------------------------------- |
| RF-501 | Gerar a lista **por tipo de ida**, pela regra de cobertura (seção 6).                               |
| RF-502 | Produtos "acabou" entram sempre.                                                                    |
| RF-503 | Quantidade sugerida calculada, limitada pela vida útil, arredondada à unidade de compra e editável. |
| RF-504 | Estimativa de custo da lista pelo último preço pago de cada produto.                                |
| RF-505 | Itens avulsos podem ser adicionados à lista.                                                        |
| RF-506 | Lista agrupada por categoria e, quando houver mercado preferido diferente, separável por mercado.   |

### M6. Modo compra (E1)

| ID     | Requisito                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------- |
| RF-601 | Funcionar offline.                                                                                                     |
| RF-602 | Marcar cada item como pego, ajustar a quantidade, marcar "não encontrei" (adia para a próxima ida) e adicionar extras. |
| RF-603 | Preço opcional na hora; nunca obrigatório.                                                                             |
| RF-604 | Mostrar o total corrente contra a estimativa e, se o usuário definir, contra um orçamento.                             |

### M7. Fechar a compra (E1)

| ID     | Requisito                                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------- |
| RF-701 | Ao importar a nota, **reconciliar com a lista**: o que foi comprado, o que ficou de fora, o que foi comprado fora da lista. |
| RF-702 | Atualizar o estoque (comprado vira cheio) e registrar o histórico de preços.                                                |
| RF-703 | Itens da lista não comprados voltam a ser avaliados na próxima ida.                                                         |
| RF-704 | Itens comprados que não estão no catálogo são oferecidos para entrar nele.                                                  |
| RF-705 | Registrar a compra com o **custo da ida** daquele dia.                                                                      |

### M8. Mercados e deslocamento (E1 básico, E2 completo)

| ID     | Requisito                                                                                                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-801 | O **mercado é criado automaticamente pelo CNPJ da nota**, com nome, endereço e apelido editável.                                                                                        |
| RF-802 | Cadastro da **casa**: localização guardada só no aparelho. Captura com "estou em casa agora" (coordenadas) ou digitando o endereço. Opção de arredondar a posição.                      |
| RF-803 | Meio de transporte por mercado: **carro** ou **bike elétrica**. O app lembra a escolha.                                                                                                 |
| RF-804 | **Estimativa automática** de distância e tempo ao importar a nota, usando o endereço do mercado que vem na nota. Se o endereço não for encontrado, pedir o ponto no mapa uma única vez. |
| RF-805 | Parâmetros do custo, todos editáveis: consumo do carro (km/L), preço do combustível, desgaste por km, custo por km da bike elétrica, custos fixos (estacionamento).                     |
| RF-806 | Calcular o **custo financeiro da ida e volta** (só dinheiro). O valor do tempo **não** entra na conta.                                                                                  |
| RF-807 | Mostrar tempo total em idas por mês e número de idas **como informação**, sem converter em reais.                                                                                       |
| RF-808 | O app **não acompanha a localização** durante as compras.                                                                                                                               |

### M9. Preços e comparação (E2)

| ID     | Requisito                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------- |
| RF-901 | Histórico por produto em preço normalizado (R$/kg, R$/un, R$/L), com variação em relação à compra anterior.            |
| RF-902 | Alerta na lista quando o preço está acima da média do usuário (limiar padrão 20%, editável).                           |
| RF-903 | **Melhor mercado por produto** e **custo da cesta** em cada mercado.                                                   |
| RF-904 | **Economia líquida** entre mercados (seção 6). O app só sugere dividir a lista quando a economia líquida for positiva. |
| RF-905 | Mercado preferido por produto: manual no início, **sugerido** quando houver preços de pelo menos dois mercados.        |
| RF-906 | Gasto mensal por categoria e gasto mensal com deslocamento.                                                            |
| RF-907 | Inflação pessoal mês a mês.                                                                                            |
| RF-908 | Aviso sobre ida pouco vantajosa (ex.: "esta ida tem 4 itens, R$ 18, e custa R$ X para ir e voltar").                   |

### M10. Painel de objetivo (E2)

Métricas mostradas ao usuário: idas por mês, compras de emergência, rupturas, tempo de conferência, percentual de itens casados com o catálogo, gasto com deslocamento, minutos em idas por mês.

---

## 6. Regras de negócio

### RN-01. Nível para estoque estimado

| Nível    | Fração da quantidade de referência |
| -------- | ---------------------------------- |
| Cheio    | 100%                               |
| Metade   | 50%                                |
| Acabando | 20%                                |
| Acabou   | 0%                                 |

`estoque estimado = fração do nível × quantidade de referência` (a meta ou a última quantidade comprada).

### RN-02. Consumo diário

- Com 2 ou mais compras: `consumo diário = quantidade comprada ÷ dias entre compras consecutivas`, média das últimas compras.
- Com menos compras: usar a frequência declarada e a meta.
- A estimativa melhora com o uso e é corrigida pelas confirmações do usuário.

### RN-03. Cobertura

`cobertura (dias) = estoque estimado ÷ consumo diário`

### RN-04. Quando o produto entra na lista

Um produto entra na lista de uma ida se:

1. o nível é **acabou**; **ou**
2. a **cobertura é menor** que o número de dias até a **próxima ida que o cobre**, mais uma **folga** em dias (padrão a definir, ajustável).

Exemplo: café dura até dia 18, a feira mensal é dia 30, então ele entra na ida semanal anterior. Um pacote de arroz que dura além da próxima feira mensal não entra na lista semanal.

### RN-05. Quantidade sugerida

```
quantidade = consumo diário × (dias do ciclo da ida + folga) − estoque estimado
```

- Arredondada à unidade de compra, mínimo de 1 unidade quando entrar na lista.
- **Limite por vida útil:** produto perecível não leva mais do que o consumo de sua vida útil.
- **Meta mensal** (feira): `consumo diário × dias até a próxima feira + folga`. Mostrada como sugestão para o usuário aprovar.

### RN-06. Durável contra perecível

Cada produto tem vida útil estimada (curta, média, longa), com valor inicial por categoria. A feira mensal só recebe duráveis. Perecíveis ficam nas idas semanais.

### RN-07. Preço normalizado

- Unidade KG: preço por kg. Unidade UNID: preço por unidade. Tamanho de embalagem (ex.: "PCT 180") é extraído do nome quando existir, para comparar embalagens.
- Comparações sempre pelo preço normalizado, nunca pelo total da linha.

### RN-08. Custo da ida

```
Carro:          km (ida e volta) × (preço do combustível ÷ consumo + desgaste/km) + custos fixos
Bike elétrica:  km (ida e volta) × custo por km da bike
```

Apenas dinheiro. Tempo é informação separada.

### RN-09. Economia líquida

```
economia líquida = economia de preço comprando no mercado B − custo da ida extra
```

O app sugere dividir a lista entre mercados só quando a economia líquida for positiva (ou acima de um limiar definido pelo usuário). Como a bike elétrica custa quase zero em dinheiro, a conta tende a favorecer idas de bike; por isso o tempo e o número de idas são exibidos à parte.

### RN-10. Custo real da compra

`custo real = total dos itens + custo da ida daquele dia`

### RN-11. Reconciliação

- Produto comprado → nível **cheio**.
- Item da lista não comprado → permanece pendente para a próxima ida.
- Item comprado fora da lista → contado como **compra de emergência** (se feito numa ida de reposição) e oferecido para o catálogo.

### RN-12. Importação

- Nota duplicada (mesma chave) é bloqueada, com opção de substituir.
- Erro de conferência impede salvar. Aviso exige atenção.
- A chave do texto colado tem de ser a da chave informada no passo 1.
- CPF nunca é armazenado.

### RN-13. Mercado

O mercado é identificado pelo **CNPJ**. Filiais diferentes (sufixo do CNPJ) são mercados diferentes.

---

## 7. Modelo de dados (conceitual)

| Entidade                | Campos principais                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Perfil**              | Localização da casa, consumo do carro, preço do combustível, desgaste/km, custo/km da bike, folga em dias, limiar de alerta de preço                                  |
| **Mercado**             | CNPJ, nome, apelido, endereço, coordenadas, tipo (hortifruti, supermercado, atacarejo, feira), meio de transporte, distância, tempo, custo da ida                     |
| **Agenda de ida**       | Tipo, dia do mês ou da semana, mercado habitual                                                                                                                       |
| **Produto**             | Nome, categoria, unidade, meta, frequência, tipo de ida, vida útil, mercado preferido, local na casa, ativo                                                           |
| **Apelido por mercado** | CNPJ + código interno → produto                                                                                                                                       |
| **Estoque**             | Produto, nível, quantidade exata (opcional), data da confirmação, consumo diário estimado                                                                             |
| **Compra**              | Chave, mercado, data e hora, total, forma de pagamento, itens (código, descrição, produto, quantidade, unidade, preço unitário, total), custo da ida, lista de origem |
| **Lista**               | Tipo de ida, data, status                                                                                                                                             |
| **Item da lista**       | Produto, quantidade sugerida, quantidade pega, status (pendente, pego, não encontrado, adiado, extra), preço opcional                                                 |

Na versão atual (E0) existem apenas **Compra** e **Apelido por mercado**, em IndexedDB.

**Todas as entidades carregam `id` (UUID) e `casa_id`** (uma casa padrão no início), para permitir a migração ao Supabase e ao modelo multi-tenant sem refazer o modelo (D23).

---

## 8. Telas

| Tela                | Conteúdo                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| **Início ("Hoje")** | Próxima ida, quantos produtos vencem, atalho para conferir e para a lista |
| **Conferência**     | Um produto por vez, toque no nível                                        |
| **Lista**           | Itens por categoria, estimativa de custo, alertas de preço                |
| **Modo compra**     | Checklist offline, total corrente, ações rápidas                          |
| **Importar nota**   | Os quatro passos do fluxo 4.5 (existente)                                 |
| **Catálogo**        | Produtos com meta, frequência, tipo de ida e vida útil                    |
| **Mercados**        | Lista de mercados com distância, meio de transporte e custo de ida        |
| **Compras**         | Histórico e detalhe (existente)                                           |
| **Preços**          | Histórico por produto e comparação (existente em versão simples)          |
| **Painel**          | Métricas do objetivo (E2)                                                 |
| **Ajustes**         | Casa, agenda das idas, parâmetros de custo, backup                        |

---

## 9. Requisitos não funcionais

| Tema                   | Requisito                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Plataforma**         | PWA instalável (Next.js 16), Android como alvo principal, funcionando também no iPhone.                                                                                                          |
| **Offline**            | Uso completo sem internet, exceto consulta da SEFAZ e estimativa de rota.                                                                                                                        |
| **Dados**              | Locais (IndexedDB), sem backend no MVP. Backup por arquivo.                                                                                                                                      |
| **Privacidade (LGPD)** | Sem CPF. Localização da casa só no aparelho, com opção de arredondar. Só coordenadas e endereço de mercado vão a serviço de mapas. Sem rastreamento durante as compras.                          |
| **Desempenho**         | Conferência e geração da lista instantâneas; leitura de foto em poucos segundos.                                                                                                                 |
| **Idioma e formatos**  | Português do Brasil, moeda em reais, datas dd/mm/aaaa.                                                                                                                                           |
| **Segurança**          | Headers e CSP do padrão Raia Manta, com as exceções da seção 10.2. Nenhum texto externo é inserido na tela sem tratamento. HTTPS (Traefik + Let's Encrypt) obrigatório para câmera e instalação. |
| **Qualidade**          | Vitest para o núcleo (leitor da nota, validador de chave, regras), mais teste de ponta a ponta em navegador (Playwright, só em desenvolvimento).                                                 |

---

## 10. Stack e arquitetura técnica

Segue o padrão da **Raia Manta Soluções Inteligentes**, consolidado no `AGENTS.md` (seções 2, 9, 10 e 14). Perfil escolhido: **A com dados locais** (D18).

### 10.1 Stack

| Camada                    | Tecnologia                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework                 | Next.js 16 (App Router), `output: 'standalone'`                                                                                               |
| UI                        | React 19, TypeScript 5, Tailwind CSS 3.4.x (v4 proibida), clsx 2 + tailwind-merge 3                                                           |
| Fontes                    | `next/font/google` (self-hosted em build)                                                                                                     |
| Validação                 | Zod ^4: backup importado, registros lidos do IndexedDB, texto colado e formulários                                                            |
| Testes                    | Vitest ^4 (núcleo e regras)                                                                                                                   |
| Runtime                   | Node 22 LTS, imagem `node:22-alpine`, usuário `nextjs` (uid 1001)                                                                             |
| Armazenamento             | IndexedDB, atrás de uma camada de repositório                                                                                                 |
| Offline                   | Service worker manual em `public/sw.js` (rede primeiro, cache como reserva)                                                                   |
| Instalação e Compartilhar | `public/manifest.webmanifest` estático com `share_target` (Android)                                                                           |
| Analytics                 | Nenhum. Se um dia houver, só com consentimento explícito (LGPD)                                                                               |
| Deploy                    | Repositório privado: Padrão B revisado (build no GitHub Actions, `docker save`, pipe SSH, `docker load`)                                      |
| Servidor                  | VPS Raia Manta: Docker, rede externa `web`, Traefik + Let's Encrypt (`le`), redirect HTTP para HTTPS no compose, Cloudflare com proxy laranja |
| Monitoramento             | Uptime Kuma                                                                                                                                   |

**Não usar:** Supabase, Server Actions, rotas de API próprias, autenticação, middleware (regras do Perfil A). **Framer Motion** e **Sonner** constam nos perfis, mas só entram se houver necessidade real.

**Dependências adicionais (justificar no `AGENTS.md`):**

| Dependência                              | Motivo                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `jsqr`                                   | Ler QR Code em qualquer navegador, inclusive iPhone (o detector nativo só existe no Android)                                    |
| `tesseract.js` 5 + dados do idioma `eng` | Ler a chave impressa na foto, no aparelho, sem enviar a imagem a servidor (carregados só quando a foto é usada, cerca de 11 MB) |
| `@playwright/test` (desenvolvimento)     | Teste ponta a ponta com câmera simulada e modo offline                                                                          |

### 10.2 Exceções ao padrão (documentar no `AGENTS.md`)

| Ponto              | Padrão                              | O app precisa                                  | Exceção                                            |
| ------------------ | ----------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Permissions-Policy | `camera=(), geolocation=()`         | Câmera (QR e foto) e localização única da casa | `camera=(self), microphone=(), geolocation=(self)` |
| CSP, scripts       | `script-src 'self' 'unsafe-inline'` | OCR usa WebAssembly                            | Acrescentar `'wasm-unsafe-eval'`                   |
| CSP, workers       | Não prevista                        | Tesseract roda em worker                       | `worker-src 'self' blob:`                          |
| CSP, imagens       | `img-src 'self' data:`              | Prévia da foto                                 | Acrescentar `blob:`                                |
| CSP, conexões      | `connect-src 'self'`                | Serviço de mapas (E1)                          | Acrescentar o domínio do serviço escolhido         |
| Server Components  | Padrão do Next.js 16                | Uso completo offline                           | Telas como Client Components                       |
| Rotas de API       | Exigem auth e rate limit            | Chamada de mapas                               | Sem rota própria no início (D24)                   |

CSP proposta (a validar com o app rodando, no teste S7):

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';
connect-src 'self' <domínio do serviço de mapas>; worker-src 'self' blob:;
frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'
```

Mantêm-se os demais headers do padrão: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.

### 10.3 Organização do código

```
despensa-web/
├─ src/
│  ├─ domain/      Regras puras em TypeScript, sem navegador: chave, parser da nota,
│  │               cobertura, lista, custo da ida (testadas com Vitest)
│  ├─ data/        Repositórios: interface + implementação IndexedDB
│  │               (no Perfil C entra a implementação Supabase)
│  ├─ lib/         Câmera, QR, OCR, rate limit (quando houver rotas)
│  ├─ schemas/     Schemas Zod
│  ├─ components/  Componentes de interface
│  └─ app/         Telas (App Router)
├─ public/         sw.js, ícones, vendor do OCR (worker, core e idioma)
├─ tests/          Vitest; e2e/ com Playwright
├─ Dockerfile      Perfis A e B
├─ docker-compose.yml
├─ .github/workflows/deploy.yml
├─ .env.example
└─ AGENTS.md       Projeto, dependências adicionais, exceções de segurança
```

### 10.4 Evolução pelos perfis

| Quando                  | Perfil                 | O que entra                                                                                                                      |
| ----------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Agora (E0.5 a E2)       | **A com dados locais** | O descrito acima                                                                                                                 |
| Sincronização e família | **C**                  | Supabase (auth e RLS), `proxy.ts`, `getUser()`, Zod em toda rota, rate limiting, `SUPABASE_SERVICE_ROLE_KEY` só no `.env` da VPS |
| Várias casas e cobrança | **D**                  | Casa como tenant, guards (`requireAdmin()`), `tenantId` sempre da sessão, RLS multi-tenant, e-mail transacional                  |

Preparação já na E0.5: **camada de repositório**, **IDs em UUID** e **`casa_id`** em todos os registros (uma casa padrão), para a migração não reescrever interface nem regras.

### 10.5 Infraestrutura (Perfil A, repositório privado)

- **Dockerfile:** modelo dos Perfis A e B (builder e runner, `standalone`, usuário `nextjs`), só com `NEXT_PUBLIC_SITE_URL` como argumento.
- **Compose:** modelo do Padrão B (imagem local carregada por `docker load`, `env_file: .env`, rede `web` externa, labels do Traefik, limites de memória e CPU).
- **Secrets do GitHub:** `NEXT_PUBLIC_SITE_URL`, `VPS_HOST`, `VPS_USER` (sempre `deploy`), `VPS_SSH_KEY`.
- **Na VPS:** `/opt/docker/despensa-web`, com ownership para `deploy`; `.env` com permissão 600.
- **Segurança (checklist do Perfil A):** headers HTTP, Cloudflare com proxy laranja, `.env.example` commitado, `npm audit` sem críticos.

### 10.6 Protótipo existente (E0) e destino na migração

O protótipo atual foi feito em JavaScript puro para validar a ideia. Ele será portado, não reaproveitado como produto.

| Arquivo atual                        | Função                                                                | Destino                                                                                |
| ------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `nfce.js`                            | Chave, dígito verificador, QR, parser da nota, reparo de chave de OCR | `src/domain/` em TypeScript, com Zod nas bordas                                        |
| `img.js`                             | Imagem, QR e OCR                                                      | `src/lib/`                                                                             |
| `db.js`                              | Armazenamento local e backup                                          | `src/data/` (repositório sobre IndexedDB)                                              |
| `app.js`, `index.html`, `styles.css` | Interface                                                             | Telas e componentes React com Tailwind                                                 |
| `sw.js`, `manifest.webmanifest`      | Offline e instalação                                                  | `public/sw.js` e `public/manifest.webmanifest` (estático, por causa do `share_target`) |
| `tests/nfce.test.mjs`                | 28 verificações do núcleo                                             | Vitest                                                                                 |
| `sample/nota-exemplo.txt`            | Nota real usada como teste                                            | `tests/fixtures/`                                                                      |

---

## 11. Validação técnica da NFC-e (resultado do discovery)

### 11.1 Estrutura da chave de 44 dígitos

| Posições | Conteúdo                  |
| -------- | ------------------------- |
| 1-2      | UF (26 = Pernambuco)      |
| 3-6      | Ano e mês (AAMM)          |
| 7-20     | CNPJ do emitente          |
| 21-22    | Modelo (65 = NFC-e)       |
| 23-25    | Série                     |
| 26-34    | Número                    |
| 35       | Tipo de emissão           |
| 36-43    | Código numérico aleatório |
| 44       | Dígito verificador        |

### 11.2 Conclusões

| Caminho                                                                 | Resultado                                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Consulta pública da SEFAZ-PE (`nfce.sefaz.pe.gov.br/nfce-web/consNfce`) | Funciona, mas com **reCAPTCHA**. Automação direta descartada.                                                                        |
| Download de XML pelo portal da SVRS                                     | **Exige certificado digital** ICP-Brasil. Descartado.                                                                                |
| Web services da SEFAZ-PE (NF-e)                                         | Para emissores, com certificado. Fora do alcance do consumidor.                                                                      |
| **Texto colado da página**                                              | **Viável e validado** com nota real (16 itens, total conferido).                                                                     |
| **Foto com leitura da chave (OCR)**                                     | **Validado** com foto real: o leitor errou 1 dígito e o reparo achou a chave certa, com uma única opção.                             |
| QR Code com abertura direta                                             | Pendente (a nota testada não tinha QR).                                                                                              |
| API paga de terceiros (ex.: Infosimples)                                | Opção futura. Cobertura de PE existe na lista deles, mas a página fala em "dados resumidos"; não está confirmado se trazem os itens. |

### 11.3 Decisão

Fluxo **semiautomático**: o usuário faz o captcha, o app faz o resto. A integração totalmente automática é melhoria futura, só se o atrito de cerca de 30 segundos por nota incomodar.

### 11.4 Formato da nota (exemplo real)

Mercado: Cia Santos Distribuidora e Importadora de Hortifruti, Olinda/PE. Cada item vem com descrição, **código interno do mercado** (não é código de barras), quantidade, unidade (KG ou UNID), valor unitário e total. A nota impressa traz EAN em itens embalados, mas o texto da SEFAZ não traz. "Consumidor não identificado" quando não há CPF.

---

## 12. Roadmap

| Etapa               | Entrega                                                                                                                                                                                                              | O que valida                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **E0 (feita)**      | Importador de nota (chave por digitar, QR, foto e imagem; conferência; histórico de compras e preços; backup; offline)                                                                                               | A nota é importável com pouco atrito                                  |
| **E0.5 (migração)** | Portar o protótipo para o padrão Raia Manta: Next.js 16, React 19, TypeScript, Tailwind 3.4, Zod, Vitest; camada de repositório; Dockerfile, compose, Traefik e GitHub Actions (Padrão B); primeiro deploy na VPS    | O padrão sustenta câmera, OCR, offline e Compartilhar com a CSP ativa |
| **E1 (próxima)**    | Catálogo automático, agenda das idas, estoque por nível, conferência rápida, lista por tipo de ida (cobertura), modo compra, fechamento com reconciliação, casa e estimativa de ida ao importar a nota (informativa) | A lista inteligente vale o esforço de conferir a despensa?            |
| **E2**              | Comparação entre mercados, economia líquida, custo da cesta, alertas de preço, gasto com deslocamento, painel do objetivo                                                                                            | Os dados de preço mudam o que e onde se compra?                       |
| **E3+**             | EAN, itens lidos da foto, ida com duas paradas, ida contra entrega, sincronização, multiusuário, cobrança, validade, cardápio                                                                                        | O que escala para mais pessoas                                        |

### 12.1 Testes de viabilidade pendentes (antes ou durante a E1)

| #   | Teste                                                                                                                                   | Por quê                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| S1  | Endereços de 4 ou 5 notas encontrados corretamente no mapa (o endereço da nota vem abreviado, ex.: "CAVALC")                            | Decide se a estimativa de ida é automática |
| S2  | Serviço de mapa com rota de bike, ou margem sobre a rota de carro                                                                       | Estimar distância da bike elétrica         |
| S3  | QR Code de uma nota abre sem captcha em Pernambuco?                                                                                     | Poderia eliminar o captcha                 |
| S4  | A SEFAZ-PE aceita a chave como parâmetro de URL?                                                                                        | Poderia preencher o campo da consulta      |
| S5  | Texto copiado de outros mercados tem o mesmo formato da Cia Santos?                                                                     | Robustez do leitor                         |
| S6  | OCR em mais fotos reais (papel amassado, reflexo)                                                                                       | Taxa de acerto real                        |
| S7  | Primeiro deploy na VPS da Raia Manta (HTTPS pelo Traefik) e uso no celular, **com a CSP do padrão ativa** (worker, WebAssembly, câmera) | Câmera, OCR, Compartilhar e instalação     |

---

## 13. Sucesso e hipóteses

### 13.1 Métricas de sucesso (uso pessoal)

| Métrica                                                   | Alvo inicial                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Idas por mês                                              | Reduzir em relação ao ponto de partida (medir nas primeiras 4 semanas) |
| Compras de emergência                                     | Em queda mês a mês                                                     |
| Rupturas (acabou antes da próxima ida)                    | Em queda mês a mês                                                     |
| Tempo de conferência por ida                              | Menos de 3 minutos                                                     |
| Itens da nota já casados com o catálogo                   | Mais de 90% depois de 4 ou 5 compras                                   |
| Lista gerada contra a lista que o usuário faria de cabeça | Diferença pequena                                                      |
| Abre o app antes de cada ida, sem lembrete                | Sim                                                                    |
| Gasto com deslocamento e minutos em idas por mês          | Acompanhados (informação)                                              |

### 13.2 Hipóteses a validar

1. O usuário aceita 2 a 3 minutos de conferência antes de cada ida.
2. A estimativa de consumo acerta o suficiente para reduzir rupturas.
3. O custo da ida muda decisões reais de compra.
4. O fluxo semiautomático da nota (captcha manual) é tolerável.
5. Comparar mercados traz economia que justifique o esforço.

---

## 14. Riscos e mitigação

| Risco                                                                                                | Mitigação                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Cansaço com a conferência da despensa                                                                | Níveis em vez de quantidades; estimativa automática; só conferir o que vence na próxima ida          |
| Poucos dados no começo (consumo e preço)                                                             | Começar com frequência e meta declaradas; melhorar com o uso; avisar que a estimativa ainda é fraca  |
| Captcha da SEFAZ continua obrigatório                                                                | Fluxo semiautomático; testar QR; API paga como opção futura                                          |
| Mudança no layout da página da SEFAZ                                                                 | Parser tolerante, conferências que bloqueiam leitura errada, textos de exemplo nos testes            |
| Endereço da nota abreviado dificulta o mapa                                                          | Teste S1; marcar o ponto no mapa uma vez; valores manuais como reserva                               |
| Serviços de mapa com limites e termos                                                                | Poucas consultas por mês; escolher e ler os termos; cache do resultado por mercado                   |
| OCR falha em foto ruim                                                                               | Reparo seguro por dígito verificador, opções para escolher, instrução para refazer a foto ou digitar |
| Feira livre sem nota fiscal                                                                          | Preço manual rápido para esses itens                                                                 |
| Comparação de preço aumenta o número de idas                                                         | Economia líquida que desconta o custo da ida                                                         |
| Dados só no aparelho (perda do celular)                                                              | Backup por arquivo; sincronização em etapa futura                                                    |
| Privacidade da localização                                                                           | Dados locais, arredondamento opcional, sem rastreamento                                              |
| O padrão Raia Manta bloqueia câmera e localização por padrão e não prevê worker e WebAssembly na CSP | Exceções explícitas e documentadas no `AGENTS.md` (seção 9.2); validar com a CSP ativa no teste S7  |
| Next.js com Server Components atrapalha o uso offline                                                | Telas como Client Components, dados no IndexedDB, service worker manual                              |

---

## 15. Registro de decisões

| #   | Decisão                                                                                                                                                         | Origem                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| D1  | MVP como PWA para uso pessoal; multiusuário e cobrança só após validação                                                                                        | Usuário                                                  |
| D2  | Frequência no produto, não na lista; tipos de ida em vez de listas marcadas                                                                                     | Recomendação aceita                                      |
| D3  | Estoque por **níveis** para quase tudo                                                                                                                          | Usuário                                                  |
| D4  | Preço opcional na hora da compra; a nota preenche depois                                                                                                        | Recomendação aceita                                      |
| D5  | Importação de nota **semiautomática** (captcha manual, texto colado)                                                                                            | Validação técnica                                        |
| D6  | Chave da nota por **digitar, QR e foto/imagem**                                                                                                                 | Usuário                                                  |
| D7  | Compra em **vários mercados por preço**                                                                                                                         | Usuário                                                  |
| D8  | Rotina: **feira mensal, ida semanal ao mercado, ida semanal ao hortifruti**                                                                                     | Usuário                                                  |
| D9  | Objetivo: **reduzir as idas semanais ao mercado**                                                                                                               | Usuário                                                  |
| D10 | Primeira prioridade: **lista inteligente + modo compra**                                                                                                        | Usuário                                                  |
| D11 | Cadastro da casa e **custo da ida**, só dinheiro (sem valor do tempo)                                                                                           | Usuário                                                  |
| D12 | Meios de transporte: **carro e bike elétrica**                                                                                                                  | Usuário                                                  |
| D13 | Estimativa de distância **automática**, ao importar a nota, com pouco atrito                                                                                    | Usuário                                                  |
| D14 | Mercados entre 1 e 10 km: ida com duas paradas considerada para a E2 ou depois                                                                                  | Usuário                                                  |
| D15 | Tempo e número de idas mostrados como informação, sem valorar                                                                                                   | Recomendação                                             |
| D16 | Não guardar CPF; localização só no aparelho                                                                                                                     | Recomendação                                             |
| D17 | Não contornar o captcha da SEFAZ                                                                                                                                | Posição de produto                                       |
| D18 | Começar no **Perfil A com dados locais** (sem Supabase e sem login), evoluindo para o Perfil C e depois o D                                                     | Usuário                                                  |
| D19 | Seguir o padrão **Raia Manta**: Next.js 16, React 19, TypeScript 5, Tailwind 3.4, Zod 4, Vitest 4, Node 22 LTS                                                  | Usuário                                                  |
| D20 | Repositório **`despensa-web`** (privado), deploy pelo **Padrão B revisado**, em `/opt/docker/despensa-web`                                                      | Usuário                                                  |
| D21 | Exceções documentadas à CSP e à Permissions-Policy padrão: câmera, localização, worker, WebAssembly e blob (seção 10.2)                                         | Recomendação, a validar no S7                            |
| D22 | Service worker escrito à mão em `public/sw.js`, sem plugin de PWA                                                                                               | Recomendação (padrão: sem dependência sem justificativa) |
| D23 | Dados atrás de uma **camada de repositório**, com `casa_id` desde o início, para trocar IndexedDB por Supabase e chegar ao multi-tenant sem refazer a interface | Recomendação                                             |
| D25 | Serviço de mapas: **Nominatim + OSRM (FOSSGIS)**, sem chave (recomendação do spike, aguardando confirmação Z-10) | Spike C-17 |
| D24 | Serviço de mapas chamado direto do navegador no início, sem rota de API própria (rota própria exigiria login, Perfil C)                                         | Recomendação                                             |

---

## 16. Questões em aberto

| #   | Pergunta                                                                                                          | Impacto                                             |
| --- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Q1  | Dias fixos: dia do mês da feira e dias da semana das duas idas semanais                                           | Agenda e cálculo de cobertura (configurável no app) |
| Q2  | A feira mensal é sempre no mesmo mercado?                                                                         | Mercado habitual do tipo de ida                     |
| Q3  | Quantas idas semanais ao mercado se quer eliminar (zero, uma a cada duas semanas, só quando algo acabar)?         | Folga aplicada à meta mensal                        |
| Q4  | O que mais pesa na vontade de reduzir idas: tempo, esforço ou também o gasto com o carro?                         | O que o painel destaca                              |
| Q5  | Valores padrão: consumo do carro, preço do combustível, desgaste por km, custo por km da bike                     | Custo da ida (todos editáveis)                      |
| Q6  | Valor padrão da folga em dias na regra de cobertura                                                               | Sensibilidade da lista                              |
| Q1/Q5/Q6 | **Resolvido com padrões editáveis em Ajustes** (feira dia 5, mercado sábado, hortifruti quarta, folga 2 dias, carro 10 km/L, R$ 6,00/L, R$ 0,30/km, bike R$ 0,05/km); a Zuma valida no uso | n/a |
| Q7  | ~~Onde hospedar~~ **Resolvido:** VPS da Raia Manta, em `/opt/docker/despensa-web`, com Traefik e Cloudflare (D20) | n/a                                                 |
| Q9  | Qual domínio ou subdomínio vai apontar para o app                                                                 | Traefik, certificado e Cloudflare                   |
| Q10 | Limite de memória do container (começar em 256 MB, já que o OCR roda no aparelho)                                 | Compose                                             |
| Q8  | Lista dos mercados usados e seus endereços como aparecem na nota                                                  | Teste S1                                            |

---

## 17. Fora do escopo por enquanto

Multiusuário e compartilhamento; cobrança e planos; sincronização entre aparelhos; validade dos produtos; cardápio e receitas; leitura dos itens direto da foto; uso do EAN; ida com duas paradas; ida contra entrega; integração paga com APIs de nota fiscal; rastreamento de localização; suporte a outros estados além de Pernambuco na consulta automática da SEFAZ.
