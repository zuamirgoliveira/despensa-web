# Design: identidade visual, temas, layout mobile e acessibilidade

Tarefa D-01. Fonte das decisões visuais do Despensa. A referência técnica de implementação fica no [AGENTS.md](../AGENTS.md) (seção 11.1); este documento explica **o porquê** e traz a paleta com os contrastes calculados.

## 1. Princípios

1. **Mobile primeiro, retrato primeiro.** Alvo: Android em retrato, 390×844 (mínimo suportado 360×640). Uma mão, polegar.
2. **Minimalista.** Fundo calmo, uma cor de ação, um detalhe de identidade. Sem preenchimentos dominantes de cor de marca.
3. **Pernambuco com discrição.** Azul (celeste/marinho) como base, **dourado** como detalhe e **vermelho** só como erro/perigo. Dourado e vermelho **nunca no mesmo componente** (evita remeter à bandeira). O branco é a superfície do tema claro.
4. **Três temas:** Claro, Escuro e **Sistema** (padrão). O escuro usa os azuis-marinho da identidade Raia Manta.
5. **Acessível por padrão.** Contraste AA medido por teste automatizado nos dois temas; cor nunca é o único sinal; alvos ≥ 44 px; foco visível; respeita `prefers-reduced-motion`.
6. **Tokens semânticos.** Componentes usam nomes de função (`primario`, `superficie`), nunca hex nem `dark:`. O tema só troca os valores das variáveis.

## 2. Paleta

Valores em hexadecimal; no CSS ficam como variáveis de canais RGB (`--primario: 30 63 154`) para aceitar opacidade (`bg-primario/10`). Razões de contraste (WCAG 2.x) calculadas contra o fundo da página e a superfície.

### 2.1 Tokens

| Token | Papel | Claro | Escuro |
| ----- | ----- | ----- | ------ |
| `fundo` | fundo da coluna | `#F4F6FA` | `#060F26` (navy-dark) |
| `externo` | fundo ao redor da coluna (telas largas) | `#E3E8F1` | `#030A1A` (navy-deeper) |
| `superficie` | cards, barra, campos | `#FFFFFF` | `#0B1A3D` (navy) |
| `borda` | divisórias decorativas | `#D5DBE6` | `#22345E` |
| `borda-forte` | contorno de campos e controles | `#7C8799` | `#6F82AB` |
| `texto` | texto principal | `#0B1A3D` | `#E5E7EB` |
| `suave` | texto auxiliar | `#4B5563` | `#A8B0C0` |
| `primario` | ação, link, item ativo | `#1E3F9A` (azul sóbrio) | `#6CB4F0` (azul celeste) |
| `primario-fg` | texto sobre `primario` | `#FFFFFF` | `#060F26` |
| `destaque` | detalhe de identidade (dourado) | `#9A6B00` | `#D9A62E` |
| `sucesso` | confirmação (verde discreto) | `#17653A` | `#5FD08A` |
| `aviso` | atenção | `#7A4F00` | `#F0B84A` |
| `erro` | erro e ação destrutiva | `#B3122E` | `#FF8DA0` |

Cabeçalho do app: sempre `#0B1A3D` (claro) / `#060F26` (escuro), com texto branco; é também a cor da barra de status (`theme-color`).

### 2.2 Contrastes calculados

| Par | Claro | Escuro | Mínimo |
| --- | ----- | ------ | ------ |
| `texto` sobre `fundo` / `superficie` | 15,8 / 17,1 | 15,4 / 13,8 | 4,5 |
| `suave` sobre `fundo` / `superficie` | 7,0 / 7,6 | 8,7 / 7,8 | 4,5 |
| `primario` sobre `fundo` / `superficie` (texto de link) | 8,7 / 9,4 | 8,5 / 7,7 | 4,5 |
| `primario-fg` sobre `primario` (botão) | 9,4 | 8,5 | 4,5 |
| `sucesso`, `aviso`, `erro` sobre `superficie` | 7,1 / 7,1 / 6,9 | 8,9 / 9,5 / 7,8 | 4,5 |
| `sucesso`/`aviso`/`erro` sobre o próprio tom a 12% | ≥ 5,6 | ≥ 6,4 | 4,5 |
| `borda-forte` sobre `fundo` / `superficie` (controles) | 3,4 / 3,6 | 4,9 / 4,4 | 3,0 |
| `destaque` sobre `fundo` / `superficie` (detalhe, não texto corrido) | 4,3 / 4,7 | 8,6 / 7,7 | 3,0 |

`borda` (decorativa) tem contraste baixo de propósito; nunca delimita um controle sozinha. Esses pares são verificados por `tests/lib/contraste.test.ts`, que lê as variáveis de `globals.css`: mudar uma cor para abaixo do mínimo quebra o teste.

### 2.3 Regras de uso das cores de apoio

- **Dourado (`destaque`)**: indicador da aba ativa (barra curta sob o rótulo), ponto da marca no cabeçalho, contorno de selos de identidade. Nunca como fundo grande, nunca como texto corrido.
- **Vermelho (`erro`)**: mensagens de erro, ação destrutiva (apagar), campo inválido. Nunca em decoração. Um componente com vermelho **não** leva dourado.
- **Verde (`sucesso`)**: só confirmação ("Salvo", item pego, nota importada). Não é cor de marca nem de botão primário. Sempre com ícone ou texto além da cor.
- **Aviso (`aviso`)**: atenção não crítica (preço acima da média, estimativa pendente). Âmbar escuro; não combina com vermelho no mesmo componente.
- **Primário**: único preenchimento de botão de ação. Um botão primário por região.

## 3. Temas

- Opções: **Sistema** (padrão), **Claro**, **Escuro**, em **Ajustes → Aparência**.
- **Sistema** segue `prefers-color-scheme` em tempo real (mudar o tema do aparelho com o app aberto atualiza sem recarregar).
- A escolha fica em `localStorage` (chave `despensa-tema`: `claro` | `escuro`; ausente = Sistema). Não entra no backup (é preferência do aparelho).
- Sem *flash*: o tema padrão já vale por CSS puro (`@media (prefers-color-scheme: dark)`); a escolha explícita é aplicada por `public/theme-init.js`, carregado no `<head>` antes da pintura (arquivo estático, sem `dangerouslySetInnerHTML`; a CSP `script-src 'self'` o aceita).
- A variável `color-scheme` acompanha o tema, para controles nativos (rolagem, `<select>`, `<dialog>`).
- `theme-color` (barra de status): navy do cabeçalho em ambos os temas, com o tom escuro quando o sistema está no escuro (`media` no `viewport`).

## 4. Tipografia

| Uso | Fonte | Tamanho | Observação |
| --- | ----- | ------- | ---------- |
| Marca "Despensa" (cabeçalho) | Michroma | 15 px | só aqui e nos títulos |
| `h1` (título da tela) | Michroma | 18 px (`text-lg`) | curto; cabe em 2 linhas a 360 px |
| `h2` (seção) | Michroma | 14 px (`text-sm`) | apenas o título da seção |
| Texto, rótulos, botões, números | Inter | 16 px base; 14 px auxiliar | nunca abaixo de 12 px |

Michroma é larga e só tem peso regular: **nunca** em botões, tabelas, números, selos ou parágrafos. Títulos longos quebram em duas linhas (`text-wrap: balance`). Fontes entram por `next/font` (hospedadas no build, `font-src 'self'`) e são pré-cacheadas para funcionar offline. Números monetários usam `tabular-nums`.

## 5. Layout e responsividade

- **Coluna única** centralizada, largura máxima `40rem` (640 px) — token `max-w-coluna`. Em telas maiores a coluna **não** estica: as laterais crescem e mostram `externo`, com uma borda fina nas laterais da coluna.
- Margem interna da coluna: 16 px (`px-4`); espaço vertical entre blocos: 16 px (`gap-4`).
- **Cabeçalho** de 48 px (navy), rola junto com a página. **Barra inferior** fixa, dentro da coluna (mesma largura), com `safe-area-inset-bottom`; conteúdo ganha `padding-bottom` para não ficar escondido.
- Alvo de toque ≥ 44×44 px; ações principais na metade inferior da tela; modo compra com alvos de 56 px.
- Sem rolagem horizontal em 360 px. Tabelas largas viram listas de cartões ou rolam dentro de um contêiner próprio.
- Pontos de quebra (Tailwind): `sm` 640 (coluna atinge o máximo), sem layout de duas colunas. Tablet e desktop só ganham respiro.
- `100dvh` (não `100vh`), para a barra do navegador móvel.
- Movimento: transições curtas (≤ 150 ms) e desligadas com `prefers-reduced-motion`.

## 6. Componentes (estados)

Todos mostram foco visível (contorno de 2 px `primario`, deslocamento de 2 px), `disabled` (opacidade 50% e cursor bloqueado) e, onde couber, `aria-invalid`.

| Componente | Claro / Escuro |
| ---------- | -------------- |
| Botão primário | `primario` com `primario-fg`; hover escurece 10% |
| Botão secundário | `superficie`, borda `borda-forte`, `texto` |
| Botão perigo | `erro` com texto branco (claro) / `#060F26` (escuro) |
| Campo | `superficie`, borda `borda-forte`, foco com contorno `primario` |
| Card | `superficie`, borda `borda`, sem sombra no escuro |
| Alert | tom a 12% + borda a 40% + ícone/texto (nunca só cor) |
| Selo (Badge) | tom a 12%, texto do tom, borda a 30% |
| Barra de progresso | trilho `borda`, preenchimento `primario` |
| Aba ativa | texto `primario` + barra curta `destaque` sob o rótulo |
| Toast | `texto` invertido (fundo `texto`, letra `fundo`); erro em `erro` |

## 7. Revisão por tela (retrato, 390×844)

| Tela | Ação principal | Pontos de revisão |
| ---- | -------------- | ----------------- |
| Início | Conferir despensa | próxima ida em destaque; atalhos empilhados; lembretes como Alert |
| Importar | Salvar compra | passos numerados e compactos; botões largos; textarea alta |
| Conferência | nível do produto | quatro botões grandes (≥ 56 px) em grade 2×2 |
| Lista | Iniciar compra | grupos por categoria; +/− com 44 px; custo no topo |
| Modo compra | Peguei | alvos de 56 px; total fixo no topo; pegos esmaecidos no fim |
| Resumo | Compras | três blocos (comprado, faltou, fora da lista) |
| Compras / Preços / Gastos / Painel | leitura | cartões; gráficos legíveis em 360 px; sem rolagem lateral |
| Catálogo / Mercados / Ajustes | editar | formulários em coluna única; seções recolhíveis; Aparência em Ajustes |

## 8. Acessibilidade (checklist verificado por teste)

- Contraste AA nos dois temas (teste unitário sobre os tokens + e2e nas telas).
- Cor nunca é o único sinal (ícone/texto em sucesso, aviso, erro, tendência ▲▼).
- Um `h1` por tela; rótulo acessível em todo controle; foco visível; ordem de tabulação lógica; menu Mais por teclado.
- Alvos ≥ 44 px; zoom do texto a 200% sem perder conteúdo; sem rolagem horizontal.
- `prefers-reduced-motion` e `prefers-color-scheme` respeitados.
- Gráficos SVG têm `role="img"` e `aria-label` descrevendo a série.
