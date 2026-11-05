import { Badge } from "@/components/ui";
import type { AlertaPreco } from "@/domain/precos";

/** Selo de preço: "X% acima da sua média" (aviso) ou "abaixo da média" (discreto). */
export function SeloPreco({ alerta }: { alerta?: AlertaPreco }) {
  if (!alerta) return null;
  const pct = Math.round(alerta.pct);
  return alerta.tipo === "acima" ? (
    <Badge tom="aviso">Preço {pct}% acima da sua média</Badge>
  ) : (
    <Badge tom="verde">Preço {pct}% abaixo da média</Badge>
  );
}
