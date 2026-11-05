import { EmptyState } from "@/components/ui";
import { Pagina } from "@/components/Pagina";

export default function Page() {
  return (
    <Pagina titulo="Compras">
      <EmptyState titulo="Em breve" />
    </Pagina>
  );
}
