import Link from "next/link";
import { Card } from "@/components/ui";
import { Pagina } from "@/components/Pagina";

export default function Inicio() {
  return (
    <Pagina titulo="Despensa">
      <Card>
        <p>Importe a nota de uma compra para começar.</p>
        <Link href="/importar" className="mt-3 inline-flex min-h-11 items-center font-medium text-verde underline">
          Importar nota
        </Link>
      </Card>
    </Pagina>
  );
}
