# Changelog

## 0.4.0 (cópia de segurança e persistência)

- **Cópia de segurança v2:** arquivo com cabeçalho (contagens, período, soma SHA-256) e opção de incluir a posição de casa (ligada por padrão); a v1 continua abrindo.
- **Guardar pelo menu de compartilhar** (Drive, Gmail, WhatsApp), com download de reserva; data da última cópia em Ajustes; lembrete no Início aos 30 dias ou 5 notas.
- **Restaurar ou verificar:** conferência antes de gravar (conteúdo, período, integridade, avisos e comparação com o aparelho); com dados no aparelho sempre pergunta entre mesclar e substituir, com confirmação dupla.
- **Restauração atômica:** tudo numa única transação do IndexedDB, entra tudo ou nada (corrige a gravação em partes que podia deixar o aparelho pela metade).
- **Armazenamento persistente** pedido ao navegador e estado mostrado em Ajustes.

## 0.3.0 (nomes de produto, chave da nota e tema)

- **Produtos iguais com descrição diferente:** nomes normalizados (caixa, acento, ordem das palavras, artigos e tamanho: `500g`, `500 g`, `500GR` viram `500g`); chave igual une sozinha; parecido só sugere na conferência; nova seção "Possíveis duplicados" no Catálogo, com mesclagem confirmada.
- **Chave da nota:** campo mantém o cursor ao editar no meio; sugestão de correção de 1 dígito quando o DV não confere; aviso quando a nota saiu com chave inválida (contingência); leitura aproximada quando o OCR falha; câmera do QR em alta resolução com foco e dica.
- **Tema:** a escolha Claro/Escuro/Sistema persiste mesmo quando um proxy altera o HTML (falha de hidratação).
- **Navegação:** menu Mais como folha inferior com ícones.
- Pós-MVP registrado em `docs/pos-mvp.md` (IA, análises, treino do OCR, compra sem nota).

## 0.2.0 (design, temas e mobile)

- **Identidade visual:** nova paleta azul-marinho com detalhes em dourado e vermelho só para erro, verde só para sucesso (`docs/design.md`).
- **Temas:** Claro, Escuro e Sistema (padrão), em Ajustes → Aparência; sem flash na abertura; preferência só neste aparelho.
- **Layout mobile:** cabeçalho com a marca, barra inferior com ícones, coluna única de até 640 px centralizada em telas largas, títulos em Michroma e texto em Inter.
- **Componentes:** tokens semânticos, `LinkBotao`, ícones de estado nos avisos, acordeões sem borda dupla, gráficos legíveis nos dois temas, modo compra com campos empilhados.
- **Acessibilidade:** teste automático de contraste dos tokens (AA) e e2e nos dois temas e em 360×640.

## 0.1.0 (E0.5 + E1 + E2)

Primeira versão completa, em ordem de construção.

- **Fundação (E0.5):** Next.js 16, TypeScript estrito, Tailwind 3.4, Zod; headers e CSP; PWA com service worker manual e funcionamento offline; Dockerfile, compose e GitHub Actions (CI e deploy por SSH).
- **Importação de nota:** chave por digitar, QR (câmera/imagem) e foto com OCR no aparelho; parser e conferências; apelidos por mercado; duplicidade; Compartilhar (Android); backup e restauração.
- **Lista inteligente (E1):** catálogo automático; agenda das idas; estoque por nível; conferência rápida; lista por cobertura com "puxar" da feira; modo compra offline; reconciliação ao fechar a compra; mercados, casa e estimativa da ida (Nominatim + OSRM); tela Início.
- **Preços e comparação (E2):** preço normalizado e gráficos; alertas de preço; comparação entre mercados e cesta; economia líquida e divisão da lista; gastos, deslocamento e inflação pessoal; painel do objetivo.
- **Qualidade:** testes de domínio em tabela, de repositório (fake-indexeddb) e e2e (Playwright com câmera simulada, offline e CSP); checklist de segurança e medições em `docs/`.
