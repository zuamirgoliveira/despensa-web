import { Catalogo } from "@/components/catalogo/Catalogo";
import { Pagina } from "@/components/Pagina";

export default function Page() {
  return (
    <Pagina titulo="Catálogo">
      <Catalogo />
    </Pagina>
  );
}
