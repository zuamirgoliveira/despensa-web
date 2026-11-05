# Spike de mapas: endereço da nota → distância e tempo da ida

Tarefa C-17. Objetivo: transformar o **endereço do mercado que vem na nota** (às vezes abreviado ou cortado) em coordenadas e estimar distância e tempo desde a casa, para **carro** e **bike elétrica**, chamando o serviço **direto do navegador** (D24, sem rota de API própria). Só vão ao serviço o endereço do mercado e coordenadas; o endereço de casa nunca sai do aparelho.

**Recomendação em uma frase:** usar **Nominatim (geocodificação) + OSRM do FOSSGIS em `routing.openstreetmap.de` (rotas `routed-car` e `routed-bike`)**, sem chave e com CORS aberto, e tratar o resultado por bairro como **aproximado**, com confirmação do usuário e fallback manual (km e minutos).

> **Serviço escolhido (Z-10): aguardando decisão.** A recomendação acima é o que a C-28 implementa por padrão, atrás da interface `Mapas`; trocar de serviço muda um arquivo (`src/lib/mapas.ts`) e a origem em `connect-src`.

## 1. Comparação

Colunas de uso e termos refletem a documentação dos provedores conhecida na data do spike; **confirme os termos vigentes antes de depender deles**. As linhas de teste (CORS, respostas) foram verificadas de verdade em 05/11/2026.

| Serviço                                         | Geocodifica | Rota carro | Rota bicicleta                    | CORS no navegador          | Chave | Limites e termos                                                                                                                  | Custo        |
| ----------------------------------------------- | ----------- | ---------- | --------------------------------- | -------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Nominatim** (nominatim.openstreetmap.org)     | sim         | não        | não                               | sim (`*`, testado)         | não   | Política de uso: no máximo 1 consulta/s, identificação do aplicativo (o navegador envia `Referer`), cache obrigatório, sem uso pesado | grátis       |
| **OSRM FOSSGIS** (routing.openstreetmap.de)     | não         | sim (testado) | sim, perfil `routed-bike` (testado) | sim (`*`, testado)         | não   | Servidor público sem SLA, uso moderado                                                                                             | grátis       |
| **OSRM demo** (router.project-osrm.org)         | não         | sim (testado) | não (só carro)                  | sim (`*`, testado)         | não   | Demo, "sem garantias"                                                                                                              | grátis       |
| **OpenRouteService**                            | sim         | sim        | sim, inclui `cycling-electric`    | sim                        | sim   | Plano gratuito com cota diária; chave pública no navegador, restrinja por domínio                                                  | grátis (cota) |
| **Mapbox**                                      | sim         | sim        | sim                               | sim                        | sim   | Cota mensal gratuita; os termos do geocoding "temporário" limitam guardar resultados; conta com cartão                              | grátis (cota) |
| **Google Maps Platform**                        | sim         | sim        | sim                               | sim                        | sim   | Exige conta de faturamento; cota gratuita mensal; termos restringem cache de resultados                                            | pago além da cota |

Por que o par Nominatim + FOSSGIS: único conjunto **sem chave**, com **perfil de bicicleta real** e CORS liberado. Casa com a regra do projeto de poucas consultas por mês (uma por mercado novo, com cache). OpenRouteService é a melhor alternativa se o público do FOSSGIS ficar instável (perfil `cycling-electric` e cota previsível), ao custo de uma chave pública restrita por domínio.

## 2. Teste prático

Executado com `node scripts/spike-mapas/spike.mjs` (reproduzível; não roda em testes nem no CI).

### 2.1 Geocodificação do endereço da nota de exemplo (Cia Santos, Olinda)

Endereço na nota: `AVENIDA GOVERNADOR CARLOS DE LIMA CAVALC ,  1245 ,  CASA CAIADA ,  OLINDA ,  PE`

| Consulta                                                                      | Resultado                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------- |
| Texto bruto da nota (com espaços antes das vírgulas)                          | **nenhum resultado**                              |
| Normalizado, com a palavra cortada (`Cavalc`)                                 | nenhum resultado                                  |
| Sem a última palavra (`Avenida Governador Carlos de Lima, 1245, Casa Caiada…`) | nenhum resultado                                  |
| Rua sem número, com ou sem a palavra cortada                                  | nenhum resultado                                  |
| **Bairro** (`Casa Caiada, Olinda, PE, Brasil`)                                | **achou** (-7,9847; -34,8383)                     |
| Com o nome completo (`… Lima Cavalcanti, 1245, Casa Caiada, Olinda, PE`)      | achou a rua (-7,9871; -34,8398), sem o número exato |

**Conclusões:**

1. O texto bruto **nunca** acha nada: espaços antes da vírgula e abreviações atrapalham.
2. A nota **corta o logradouro em 40 caracteres** (`…LIMA CAVALC`). O OSM precisa do nome completo (`Cavalcanti`); sem ele só o **bairro** é achado.
3. A diferença entre o ponto do bairro e o da rua, neste caso, é de cerca de 0,3 km, o que é pouco para uma rota de ~10 km (cerca de 3%). Para a estimativa da ida o bairro serve, **desde que mostrado como aproximado**.
4. Taxa de acerto neste teste: **1 de 1 no nível de bairro; 0 de 1 no nível de rua** com o texto cortado. A amostra é de **uma única nota**: ela deve crescer quando houver mais fixtures (Z-03) e os endereços de `docs/parametros-iniciais.md` (Z-07); basta rodar o script de novo.

### 2.2 Rotas

Origem ilustrativa (Marco Zero, Recife, **não** é um endereço de casa) para o ponto da rua em Olinda:

| Perfil                                 | Distância | Tempo   |
| -------------------------------------- | --------- | ------- |
| Carro (`routed-car`)                   | 10,7 km   | 12 min  |
| Bicicleta (`routed-bike`)              | 12,0 km   | 51 min  |
| Fator de distância bike ÷ carro        | **1,12**  |         |

Os dois serviços (demo e FOSSGIS) devolveram o mesmo resultado para o carro. O perfil de bike do FOSSGIS assume velocidade de bicicleta comum (cerca de 14 km/h), mais lenta que uma bike elétrica; o **tempo é só informativo** (o custo da ida não depende dele), então a estimativa é aceitável e deve ser rotulada como "estimativa de bicicleta".

## 3. Normalização do endereço (implementada)

`src/lib/endereco.ts` (testada em `tests/lib/endereco.test.ts`), usada pela C-28:

1. Divide `logradouro , número , bairro , cidade , UF` (aceita sem número e `S/N`) e remove espaços antes das vírgulas.
2. Expande abreviações (`AV`, `R`, `TRAV`/`TV`, `ESTR`, `ROD`, `AL`, `PC`/`PÇA`, `LGO`) e usa maiúsculas e minúsculas de título (`de`, `da`, `do`… em minúsculas).
3. Gera **consultas em ordem de precisão**, e a C-28 para na primeira que achar:
   1. endereço completo;
   2. se o logradouro tem 38 caracteres ou mais (provavelmente cortado): sem a última palavra, com e sem número;
   3. rua sem número;
   4. **bairro + cidade + UF** (aproximado).
4. Nunca consulta só a cidade (impreciso demais para estimar distância).

## 4. Recomendações para a C-28

1. **Fluxo:** tentar as variantes em ordem (1 consulta por segundo, com timeout de 10 s). Resultado de rua ou endereço: mostrar "Cia Santos, 4,2 km, cerca de 12 min. Você foi de carro ou de bike elétrica?". Resultado de **bairro**: mostrar o mesmo texto com o rótulo **"aproximado"** e botão para ajustar km e minutos.
2. **Fallback** quando nada for achado, sem internet ou o serviço falhar: pedir **uma única vez** o ponto (latitude e longitude, ou colar coordenadas) **ou** km e minutos manuais, e guardar no `Mercado`. Nunca bloquear a importação da nota.
3. **Cache por mercado:** guardar coordenadas e distâncias no `Mercado` e não repetir a chamada (respeita a política do Nominatim e funciona offline depois).
4. **Bike sem perfil de bicicleta** (se o serviço mudar): distância de carro × **1,12** (fator medido; margem a ajustar com mais testes) e tempo = distância ÷ 15 km/h.
5. **Privacidade:** ao Nominatim vai o texto do endereço do mercado; às rotas, apenas coordenadas. O ponto de casa é enviado ao serviço de rotas como coordenada (necessário para a rota); a posição pode ser arredondada a 3 casas (≈ 100 m) antes (`Perfil.arredondarLocalizacao`). O endereço de casa em texto não é digitado nem enviado.
6. **CSP:** `connect-src` ganha `https://nominatim.openstreetmap.org` e `https://routing.openstreetmap.de` (e a linha da tabela 9.2 do `AGENTS.md`).
7. **Chave:** nenhuma (`NEXT_PUBLIC_MAPS_KEY` fica sem uso com este par).

## 5. Riscos

| Risco                                                                | Mitigação                                                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Serviço público sem SLA ou fora do ar                                | Timeout, fallback manual, cache; trocar por OpenRouteService muda só `mapas.ts` e o `connect-src`    |
| Nominatim limita uso pesado                                          | 1 consulta/s, cache por mercado, poucas consultas por mês                                             |
| Texto da nota cortado impede achar a rua                             | Cadeia de variantes até o bairro; rótulo "aproximado"; ajuste manual                                  |
| Mercado em endereço de rodovia ou sem número                         | O ponto aproximado ainda dá ordem de grandeza; ajuste manual                                          |
| Amostra pequena (1 nota)                                             | Rodar `spike.mjs` com as notas da Z-03 e os endereços da Z-07 e atualizar a tabela da seção 2.1       |

## 6. Como repetir o teste

```bash
node scripts/spike-mapas/spike.mjs geocodificar                       # endereços das notas em tests/fixtures/notas
node scripts/spike-mapas/spike.mjs geocodificar "RUA X , 10 , CENTRO , RECIFE , PE"
node scripts/spike-mapas/spike.mjs rota LAT_ORIGEM LNG_ORIGEM LAT_DESTINO LNG_DESTINO
```

O script respeita 1 consulta por segundo e se identifica com `User-Agent`. Ele imprime um aviso do Node sobre o módulo TypeScript importado; é inofensivo.
