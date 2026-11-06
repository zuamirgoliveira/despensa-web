/** Rotas do app: navegação e (C-09) pré-cache do service worker. */
export type Rota = {
  href: string;
  rotulo: string;
  /** Aparece na barra inferior. */
  naBarra: boolean;
  /** Aparece no menu "Mais" (o que não cabe na barra). */
  noMais?: boolean;
};

export const ROTAS: readonly Rota[] = [
  { href: "/", rotulo: "Início", naBarra: true },
  { href: "/despensa", rotulo: "Despensa", naBarra: true },
  { href: "/lista", rotulo: "Lista", naBarra: true },
  { href: "/importar", rotulo: "Importar", naBarra: true },
  { href: "/compras", rotulo: "Compras", naBarra: false, noMais: true },
  { href: "/conferencia", rotulo: "Conferir despensa", naBarra: false, noMais: true },
  { href: "/precos", rotulo: "Preços", naBarra: false, noMais: true },
  { href: "/painel", rotulo: "Painel", naBarra: false, noMais: true },
  { href: "/gastos", rotulo: "Gastos", naBarra: false, noMais: true },
  { href: "/mercados", rotulo: "Mercados", naBarra: false, noMais: true },
  { href: "/ajustes", rotulo: "Ajustes", naBarra: false, noMais: true },
  { href: "/compra", rotulo: "Modo compra", naBarra: false },
  { href: "/resumo", rotulo: "Resumo", naBarra: false },
];

/** `true` se `caminho` é a rota ou uma subrota dela ("/" só casa com ele mesmo). */
export function rotaAtiva(caminho: string, href: string): boolean {
  return href === "/" ? caminho === "/" : caminho === href || caminho.startsWith(`${href}/`);
}
