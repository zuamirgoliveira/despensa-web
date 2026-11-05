# Arquitetura

Detalhes técnicos e fórmulas completas ficam no [AGENTS.md](../AGENTS.md) (fonte única). Aqui está o mapa para entender o conjunto.

## Camadas

```
app/ (telas, Client Components) → components/ → data/ (repositórios, serviços) → schemas/ (Zod)
            ↓                          ↓
         domain/ (regras puras)  ←─────┘            lib/ (QR, OCR, mapas, formatação, datas)
```

- **domain/**: regras puras, sem React nem IndexedDB, com `hoje` sempre por parâmetro. Testadas em tabela (`tests/domain`).
- **data/**: interfaces dos repositórios, implementação IndexedDB com migrações numeradas, eventos de mudança, backup e **serviços** que combinam domínio e repositórios (`importarNota`, `lista`, `compra`, `reconciliacao`, `conferencia`, `estimativaIda`, `catalogo`).
- **components/ e app/**: só interface. Telas são Client Components porque leem o IndexedDB e funcionam offline.
- **lib/**: integrações com o navegador (câmera, OCR, geolocalização, mapas) e utilitários.

## Fluxo de dados

1. Uma tela chama `criarRepositorios()` (instância única sobre o IndexedDB `despensa`).
2. Cada escrita valida com Zod, grava e **emite um evento** da coleção.
3. `useRepositorio(consulta, colecoes, deps?)` reexecuta a consulta quando a coleção muda: nenhuma store global.
4. Regras de negócio recebem dados já carregados e devolvem resultados; serviços em `data/` gravam o resultado.

## Ciclo do produto

```
Importar nota ──► catálogo, mercados, apelidos, preços
      ▲                          │
      │                          ▼
Fechar compra ◄── Modo compra ◄── Lista (por tipo de ida) ◄── Conferência da despensa
(reconciliação,        (offline)      ▲
 estoque cheio,                       └── agenda, consumo, cobertura (domínio)
 custo da ida)
```

Preços e deslocamento alimentam comparação entre mercados, economia líquida, gastos, inflação pessoal e o painel do objetivo.

## Regras de negócio (mapa para as fórmulas do AGENTS.md)

| Tema | Arquivo | Seção do AGENTS.md |
| ---- | ------- | ------------------ |
| Estoque, consumo, cobertura | `domain/estoque.ts` | 6.1 |
| Agenda das idas | `domain/agenda.ts` | 6.2 |
| Geração da lista | `domain/lista.ts` | 6.3 |
| Início, modo compra | `domain/inicio.ts`, `domain/compra.ts` | 6.3.0, 6.3.1 |
| Reconciliação | `domain/reconciliacao.ts` | 6.4 |
| Custo da ida | `domain/ida.ts` | 6.5 |
| Preços, comparação, economia, gastos, painel | `precos`, `comparacao`, `economia`, `gastos`, `painel` | 6.6, 6.6.1 |
| Catálogo | `domain/catalogo.ts`, `categorias.ts` | 6.7 |
| NFC-e (chave, QR, parser) | `domain/nfce/*` | 7 |

## Decisões (D-xx do blueprint) refletidas no código

D5 texto colado (captcha manual) · D6 chave por digitar/QR/foto · D11 custo da ida só em dinheiro · D13 estimativa automática pelo endereço da nota · D18 Perfil A com dados locais · D22 service worker manual · D23 repositórios e `casaId` · D24 mapas direto do navegador (Nominatim + OSRM, sem rota própria).
