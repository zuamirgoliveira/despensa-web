# Backup, restauração e persistência dos dados

> **Status:** implementado (tarefas B-01 a B-06). Testes: `tests/data/backupV2.test.ts`, `restauracao.test.ts`, `backupArquivo.test.ts`, `tests/domain/backup.test.ts`, `tests/lib/armazenamento.test.ts`, `arquivos.test.ts` e `e2e/backup.spec.ts`.

Especificação (versão 2 do formato) e guia de uso. Decisões de 05/11/2026. O app não tem servidor: **os dados ficam só no aparelho** (IndexedDB do navegador). A segurança vem de ter uma cópia **fora do celular**, feita com facilidade e lembrada com frequência.

## 1. Por que os dados podem se perder

| Situação | Risco |
| -------- | ----- |
| Limpar os dados do site/Chrome, desinstalar o app ou o navegador | alto |
| Trocar de aparelho, perder ou quebrar o celular | alto |
| Mudar o endereço do app (o armazenamento é por origem: outro domínio = banco vazio) | alto |
| Pouco espaço no celular (o navegador pode despejar o armazenamento de sites) | médio, **reduzido** pelo armazenamento persistente |
| iPhone/Safari fora do app instalado (pode apagar dados sem uso em ~7 dias) | alto |
| Navegação anônima | total |

## 2. Camadas de proteção

1. **Armazenamento persistente** (`navigator.storage.persist()`): o app pede ao abrir. Impede o despejo por falta de espaço quando o navegador concede (no Chrome Android, para app instalado e usado com frequência, costuma conceder). **Não** protege contra o usuário limpar tudo nem contra perder o aparelho. Ajustes → Backup mostra "Armazenamento protegido: sim/não".
2. **Cópia de segurança fora do aparelho** (seção 3): é a proteção de verdade.
3. **Lembrete** (seção 5): sem hábito não há backup.
4. **Verificar antes de precisar** (seção 7): abrir a cópia e ver o resumo, sem aplicar.

Sem servidor, **backup automático** (que acontece sozinho, sem abrir o app) e **sincronização entre aparelhos** não são possíveis. Ficam no pós-MVP (`docs/pos-mvp.md`).

## 3. Guardar uma cópia

**Mais → Ajustes → Backup → Guardar uma cópia de segurança.**

- Abre o menu de compartilhar do Android (Drive, Gmail, WhatsApp para si...). A pessoa escolhe o destino; o app não fala com nenhum serviço.
- Sem suporte a compartilhar arquivos (computador, alguns navegadores), baixa o arquivo (**Baixar o arquivo** também fica sempre disponível).
- O app só sabe que a pessoa **escolheu um destino**, não que o envio terminou. O texto é "Cópia compartilhada em dd/mm/aaaa. Confira se chegou no destino." Cancelar o menu não conta como cópia feita.
- Opção **Incluir a posição de casa**: ligada por padrão. Se desligar, o arquivo sai sem as coordenadas; ao restaurar, é preciso tocar em "Estou em casa agora" de novo.
- A data da última cópia fica em `Perfil.ultimoBackupEm` (no banco, não em `localStorage`).

### Formato do arquivo (versão 2)

`despensa-backup-AAAA-MM-DD.json` (JSON, UTF-8):

```json
{
  "versao": 2,
  "exportadoEm": "2026-11-05T17:30:00.000Z",
  "meta": {
    "app": "despensa-web",
    "incluiPosicaoDeCasa": true,
    "contagens": { "casas": 1, "perfis": 1, "agendas": 3, "mercados": 3, "produtos": 340, "apelidos": 410, "estoques": 340, "compras": 120, "listas": 40, "itensLista": 600, "conferencias": 30 },
    "periodo": { "de": "2026-01-03", "ate": "2026-11-05" },
    "integridade": { "algoritmo": "SHA-256", "valor": "…64 hex…" }
  },
  "colecoes": { "casas": [], "perfis": [], "agendas": [], "mercados": [], "produtos": [], "apelidos": [], "estoques": [], "compras": [], "listas": [], "itensLista": [], "conferencias": [] }
}
```

- `integridade.valor` é o SHA-256 de `JSON.stringify(colecoes)` (compacto). Detecta arquivo cortado ou alterado; **não** é assinatura nem proteção contra quem edita de propósito.
- `periodo` vem das datas de emissão das compras (ausente sem compras).
- **Não entram:** CPF, texto bruto das notas, fotos, preferência de tema.
- **Entram:** casa, perfil (parâmetros de custo e, se marcado, a posição de casa), agenda, mercados (nome e endereço), produtos, apelidos, estoque, compras e itens, listas, conferências.
- Tamanho: dezenas de KB por trimestre de uso (o seed de desenvolvimento, 12 compras, tem ~30 KB).
- **Compatibilidade:** o app lê todas as versões anteriores (a versão 1 não tem `meta`: lê sem verificar integridade). Versão **mais nova** que a suportada é recusada com a mensagem "atualize o app". Cada mudança de formato aumenta `versao`; uma cópia de 2026 tem de abrir em 2028 (fixture de teste da v1).

## 4. Restaurar uma cópia

**Ajustes → Backup → Restaurar ou verificar uma cópia** e escolher o arquivo (o seletor do Android lista o Drive).

### Passo 1: conferência (nada é gravado)

A tela mostra:
- "Cópia de dd/mm/aaaa hh:mm: 120 compras (jan a nov), 340 produtos, 3 mercados...";
- arquivo **íntegro** (soma de verificação confere), versão compatível;
- se a cópia **não tem a posição de casa** (precisará informá-la de novo);
- **comparação com o aparelho**: "Neste aparelho agora: 8 compras. Na cópia: 120";
- avisos: cópia **mais antiga** que a última compra deste aparelho; cópia de **outra casa**.

Arquivo inválido (JSON quebrado, formato desconhecido, cortado, soma de verificação diferente, versão nova) mostra erro claro e **bloqueia** a restauração.

Aqui a pessoa pode apenas **fechar**: é a forma de **verificar** uma cópia sem aplicar.

### Passo 2: o que fazer com o que já existe

- **Aparelho vazio** (só a casa padrão recém-criada): botão **Restaurar**, sem perguntas.
- **Aparelho com dados**: o app **sempre pergunta**, com dois cartões que explicam o efeito:
  - **Mesclar**: junta a cópia com o que há aqui. Registros iguais (mesmo identificador) ficam **como na cópia**; o que só existe neste aparelho é **mantido**. (Estoque: o registro da cópia substitui o do mesmo produto.)
  - **Substituir tudo**: apaga **tudo** deste aparelho e deixa exatamente como a cópia.

### Passo 3: confirmação dupla

- **Mesclar:** diálogo "O que vai acontecer" com números ("serão copiados 120 compras; as 8 que só existem aqui ficam") → **Mesclar**.
- **Substituir tudo:** o mesmo diálogo e, em seguida, uma **segunda confirmação** em vermelho: "Isto apaga as 8 compras... deste aparelho e não tem volta", com a caixa **"Entendi que isto apaga os dados deste aparelho"** e o botão **Guardar uma cópia do que está aqui agora** (recomendado antes). O botão **Apagar e restaurar** só habilita depois de marcar a caixa.

### Passo 4: aplicação atômica

A restauração roda numa **única transação** do IndexedDB (todas as coleções): **entra tudo ou não entra nada**. Antes de abrir a transação, todo registro é validado (Zod) e as chaves duplicadas dentro do arquivo são recusadas. Falha no meio (espaço, navegador fechado, erro) desfaz tudo e o aparelho fica como estava. No fim, mostra "Restaurado: 120 compras, 340 produtos..." e leva ao Início.

Depois de restaurar, `Perfil.ultimoBackupEm` passa a ser a data da cópia restaurada.

Regras do estoque na mesclagem: o índice de estoque por produto é **único**; se o estoque local do produto tem outro identificador que o da cópia, o da cópia substitui o local (dentro da mesma transação). Em "Substituir tudo" isso não ocorre (tudo é apagado antes).

## 5. Lembrete

No **Início**, um cartão discreto quando:
- **nunca** houve cópia e já existe pelo menos uma compra; **ou**
- passaram **30 dias** da última cópia; **ou**
- foram importadas **5 notas** ou mais desde a última cópia.

(Vale o que ocorrer primeiro; sem nenhuma compra não há lembrete.) O botão do cartão abre o compartilhar na hora.

## 6. Trocar de aparelho

1. No aparelho **antigo**: Guardar uma cópia de segurança (Drive).
2. No aparelho **novo**: instalar o app pelo mesmo endereço, abrir e **Restaurar** a cópia (o aparelho novo está vazio: restaura direto).
3. Informar a posição de casa se a cópia não a trazia.

Importante: o endereço do app deve ser o mesmo (`despensa.raiamantasi.com.br`). Outro domínio é outro armazenamento, vazio. Se um dia o endereço mudar, guarde a cópia no endereço antigo e restaure no novo.

## 7. Verificar sem aplicar

Em **Restaurar ou verificar uma cópia**, escolher o arquivo e **fechar** no passo 1 confere o arquivo (resumo, integridade, compatibilidade) sem alterar nada. Vale fazer uma vez depois da primeira cópia, para ter confiança de que ela abre.

## 8. Fora do escopo (pós-MVP)

Registrados em `docs/pos-mvp.md`: **senha no arquivo** (criptografia AES-GCM; esquecer a senha perde a cópia), **envio direto ao Google Drive pela API** (exige projeto no Google Cloud, política de privacidade, mudança de CSP e decisão sobre a regra 2 do `AGENTS.md`) e **sincronização/backup automático** (exige servidor, Perfil C).

## 9. Dados de desenvolvimento

`npm run seed:dev` gera `dev-data/despensa-seed.json` (formato v1, sem `meta`), que se restaura pelo mesmo caminho.
