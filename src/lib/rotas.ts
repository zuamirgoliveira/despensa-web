/** Rotas do app: usadas na navegação e (C-09) no pré-cache do service worker. */
export type Rota = { href: string; rotulo: string; naBarra: boolean };

export const ROTAS: readonly Rota[] = [
  { href: "/", rotulo: "Início", naBarra: false },
  { href: "/importar", rotulo: "Importar", naBarra: true },
  { href: "/compras", rotulo: "Compras", naBarra: true },
  { href: "/lista", rotulo: "Lista", naBarra: true },
  { href: "/conferencia", rotulo: "Conferir", naBarra: false },
  { href: "/catalogo", rotulo: "Catálogo", naBarra: true },
  { href: "/precos", rotulo: "Preços", naBarra: true },
  { href: "/ajustes", rotulo: "Ajustes", naBarra: true },
];
