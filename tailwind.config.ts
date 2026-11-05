import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        verde: "#1f6f4a",
        fundo: "#f6f8f7",
        borda: "#d6ddd9",
        texto: "#1d2420",
        erro: "#9b1c1c",
        aviso: "#8a5a00",
      },
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};

export default config;
