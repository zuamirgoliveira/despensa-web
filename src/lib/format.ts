// Formatação só para a interface. Dinheiro chega em centavos inteiros.

const agrupaMilhar = (n: string): string => n.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** 123456 → "R$ 1.234,56". Negativos: "-R$ 1,00". */
export function brl(centavos: number): string {
  const c = Math.round(centavos);
  const abs = Math.abs(c);
  const reais = agrupaMilhar(String(Math.trunc(abs / 100)));
  const cent = String(abs % 100).padStart(2, "0");
  return `${c < 0 ? "-" : ""}R$ ${reais},${cent}`;
}

/** "2026-11-04" ou "2026-11-04T10:33:31" → "04/11/2026". Entrada inválida devolve "". */
export function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** "2026-11-04T10:33:31" → "10:33". Sem hora, devolve "". */
export function horaBR(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : "";
}

/** Instante ISO (com fuso) → "05/11/2026 14:30" no horário de Recife. Entrada inválida devolve "". */
export function instanteBR(instante: string): string {
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string): string => p.find((x) => x.type === t)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} ${v("hour")}:${v("minute")}`;
}

/** Quantidade em kg com vírgula, sem zeros à direita: 1.26 → "1,26 kg"; 2 → "2 kg". */
export function kg(n: number): string {
  const t = String(Math.round(n * 1000) / 1000).replace(".", ",");
  return `${t} kg`;
}

/** Número com vírgula, sem zeros à direita (quantidades de unidade ou litro). */
export function numeroBR(n: number, casas = 3): string {
  const f = 10 ** casas;
  return String(Math.round(n * f) / f).replace(".", ",");
}

/** Mostra a chave de 44 dígitos em grupos de 4 (aceita digitação parcial). */
export function agruparChave(digitos: string): string {
  return digitos.replace(/\D/g, "").slice(0, 44).replace(/(\d{4})(?=\d)/g, "$1 ");
}
