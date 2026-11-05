import type { Config } from "tailwindcss";

// Tokens semânticos: os valores vêm de variáveis CSS (src/app/globals.css) que mudam por tema.
// Formato "R G B" nas variáveis, para aceitar opacidade (bg-primario/10). Ver docs/design.md.
const token = (nome: string): string => `rgb(var(--${nome}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fundo: token("fundo"),
        externo: token("externo"),
        superficie: token("superficie"),
        borda: token("borda"),
        "borda-forte": token("borda-forte"),
        texto: token("texto"),
        suave: token("suave"),
        primario: token("primario"),
        "primario-fg": token("primario-fg"),
        destaque: token("destaque"),
        sucesso: token("sucesso"),
        aviso: token("aviso"),
        erro: token("erro"),
        "erro-fg": token("erro-fg"),
        cabecalho: token("cabecalho"),
        "cabecalho-fg": token("cabecalho-fg"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        titulo: ["var(--font-michroma)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      maxWidth: { coluna: "40rem" },
    },
  },
  plugins: [],
};

export default config;
