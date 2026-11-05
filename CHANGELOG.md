# Changelog

## 0.1.0 (E0.5 + E1 + E2)

Primeira versão completa, em ordem de construção.

- **Fundação (E0.5):** Next.js 16, TypeScript estrito, Tailwind 3.4, Zod; headers e CSP; PWA com service worker manual e funcionamento offline; Dockerfile, compose e GitHub Actions (CI e deploy por SSH).
- **Importação de nota:** chave por digitar, QR (câmera/imagem) e foto com OCR no aparelho; parser e conferências; apelidos por mercado; duplicidade; Compartilhar (Android); backup e restauração.
- **Lista inteligente (E1):** catálogo automático; agenda das idas; estoque por nível; conferência rápida; lista por cobertura com "puxar" da feira; modo compra offline; reconciliação ao fechar a compra; mercados, casa e estimativa da ida (Nominatim + OSRM); tela Início.
- **Preços e comparação (E2):** preço normalizado e gráficos; alertas de preço; comparação entre mercados e cesta; economia líquida e divisão da lista; gastos, deslocamento e inflação pessoal; painel do objetivo.
- **Qualidade:** testes de domínio em tabela, de repositório (fake-indexeddb) e e2e (Playwright com câmera simulada, offline e CSP); checklist de segurança e medições em `docs/`.
