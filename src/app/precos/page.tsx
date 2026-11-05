import { EmptyState } from "@/components/ui";
import { Pagina } from "@/components/Pagina";

export default function Page() {
  return (
    <Pagina titulo="Preços">
      <EmptyState titulo="Em breve" />
    </Pagina>
  );
}
