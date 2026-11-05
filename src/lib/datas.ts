// Datas sem hora (YYYY-MM-DD) e relógio. Nas regras de negócio, `hoje` é sempre parâmetro.

const FUSO = "America/Recife";

/** Data de hoje no fuso de Recife, como YYYY-MM-DD. `agora` é injetável nos testes. */
export function hojeRecife(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Dias desde 1970-01-01 (calendário civil, sem fuso). Lança erro para data inválida. */
function diaCivil(data: string): number {
  const m = RE_DATA.exec(data);
  if (!m) throw new Error(`Data inválida: "${data}" (esperado AAAA-MM-DD)`);
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(a, mes - 1, d);
  const conferido = new Date(t);
  if (conferido.getUTCFullYear() !== a || conferido.getUTCMonth() !== mes - 1 || conferido.getUTCDate() !== d) {
    throw new Error(`Data inexistente: "${data}"`);
  }
  return t / 86_400_000;
}

/** Quantidade de dias civis de `a` até `b` (negativo se `b` for anterior). Não usa fuso nem horário de verão. */
export function diasEntre(a: string, b: string): number {
  return diaCivil(b) - diaCivil(a);
}

/** Soma `n` dias (pode ser negativo) a uma data AAAA-MM-DD. */
export function adicionarDias(data: string, n: number): string {
  return new Date((diaCivil(data) + n) * 86_400_000).toISOString().slice(0, 10);
}

/** Parte de data de um instante ou de uma data/hora local (AAAA-MM-DD...). */
export function soData(valor: string): string {
  return valor.slice(0, 10);
}
