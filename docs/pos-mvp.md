# Backlog pós-MVP

Ideias avaliadas e **adiadas de propósito** (decisões de 05/11/2026). Nada aqui está implementado. Cada item diz o que precisa ser decidido antes de começar. A regra do projeto continua valendo: **nenhum backend, rota de API ou envio de dados a terceiros sem decisão registrada no `AGENTS.md`** (seção 13, regras 2 e 3).

## 1. IA para unir produtos iguais com descrição diferente

**Situação:** resolvido sem IA, por regras (`src/domain/normalizacao.ts`): normalização de caixa, acento, ordem das palavras, artigos e escrita do tamanho; chave igual une sozinha; parecido só sugere; tela "Possíveis duplicados" no Catálogo.

**Revisar depois de algumas semanas de uso:** se ainda sobrarem muitos itens que as regras não resolvem (ex.: `MAION LIZA TRAD` × `Maionese Liza Tradicional`), avaliar IA **só como sugestão** (nunca mescla sozinha), em lote por nota, com modelo pequeno.

**Custo estimado** (tabela de preços de 06/10/2026; estimativa, não medição; nota grande: ~3.600 tokens de entrada e ~900 de saída; o raciocínio interno soma à saída): Claude Haiku 5.5 ≈ US$ 0,0008 por nota; Sonnet 5.5 ≈ US$ 0,016; Opus 5.5 ≈ US$ 0,032. O custo financeiro é desprezível; o custo real é arquitetural:

- exige **backend mínimo** (chave de API não pode ficar no navegador), uma decisão a registrar no `AGENTS.md`;
- as descrições de produtos saem do aparelho (hábitos de compra): consentimento e envio só do texto do item, sem preço, data, CNPJ ou chave;
- o app é offline-first: a IA seria opcional e degradaria sem internet;
- o risco é unir produtos diferentes (ex.: versão *light*): por isso só sugestão com confirmação.

## 2. Análises, relatórios e otimizações com IA sobre o consumo (opcional para o usuário)

Gerar, **só se o usuário quiser**, relatórios e análises em cima dos dados de consumo, preços e idas: onde economizar, produtos que sobem mais que a inflação pessoal, sugestões de dividir ou espaçar as idas, resumo mensal em linguagem simples. Antes de refinar a abordagem, decidir:

- **onde roda:** backend próprio com a chave guardada no servidor, ou execução local; o app hoje não tem servidor;
- **o que sai do aparelho:** agregados anonimizados (por categoria e mês) em vez de notas e itens crus, com consentimento explícito e botão de apagar;
- **Perfil C** do blueprint (contas, sincronização) provavelmente entra junto;
- medir valor antes: os cálculos determinísticos que já existem (Preços, Gastos, Painel) cobrem boa parte.

## 3. Coleta de exemplos e treinamento do OCR da chave

Ideia: base de treinamento contínua e anonimizada, primeiro local (recorte da linha da chave + chave confirmada pelo DV, exportável) e depois compartilhada em servidor, para melhorar a leitura de notas com impressão pontilhada. Fases propostas: (0) coleta local, desligada por padrão; (1) medição offline; (2) envio voluntário pós-MVP, rejeitando par cuja chave não passe no DV; (3) retreino periódico com portão de qualidade em conjunto de teste fixo.

**Só avançar se** o Google Lens (copiar o texto e colar no campo) deixar de bastar. Medição de referência: na foto de `tests/fixtures/fotos/nota-pontilhada.png` o Tesseract erra de 4 a 6 dígitos por linha; o Lens leu a linha inteira.

## 4. Backup: senha no arquivo, Google Drive pela API e backup automático

Decisões de 05/11/2026 (`docs/backup.md`, seção 8): a cópia de segurança sai pelo menu de compartilhar do aparelho. Ficam para depois:

- **Senha no arquivo** (AES-GCM com chave derivada da senha pela Web Crypto): proteger a cópia onde quer que ela vá parar. Custo: esquecer a senha perde a cópia, então só com aviso muito claro.
- **Envio direto ao Google Drive pela API**: exige projeto no Google Cloud, tela de consentimento, política de privacidade, domínio verificado, mudança de CSP (`accounts.google.com`, `www.googleapis.com`), decisão registrada sobre a regra 2 do `AGENTS.md` e, sem servidor, o token expira em cerca de 1 hora (o botão pede autorização de novo). Equivale em durabilidade ao compartilhar, com um toque a menos.
- **Backup automático e sincronização entre aparelhos**: exigem servidor (token de renovação, conta do usuário): Perfil C do blueprint.

## 5. Registrar compra sem nota

Para notas que a SEFAZ recusa (ex.: chave impressa inválida em emissão em contingência) e para feira livre sem nota: lançar a compra à mão (data, mercado, itens e valores), marcada como "sem nota". O blueprint já prevê o preço manual da feira livre (seção 14, riscos). Decidir se vale antes de ver a frequência real do problema.
