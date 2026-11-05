import Link from "next/link";

/** Cabeçalho da marca: navy nos dois temas, rola junto com a página. O ponto dourado é o detalhe de identidade. */
export function Cabecalho() {
  return (
    <header className="flex min-h-12 items-center bg-cabecalho px-4 pt-[env(safe-area-inset-top)] text-cabecalho-fg">
      <Link
        href="/"
        aria-label="Despensa, ir para o início"
        className="inline-flex min-h-11 items-center gap-2 font-titulo text-[15px] tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cabecalho-fg"
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-destaque" />
        Despensa
      </Link>
    </header>
  );
}
