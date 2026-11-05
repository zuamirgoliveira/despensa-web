import { Backup } from "@/components/compras/Backup";
import { ListaCompras } from "@/components/compras/ListaCompras";
import { Pagina } from "@/components/Pagina";

export default function Page() {
  return (
    <Pagina titulo="Compras">
      <ListaCompras />
      <Backup />
    </Pagina>
  );
}
