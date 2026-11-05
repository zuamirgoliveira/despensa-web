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

/** Dia da semana de uma data: 0 = domingo ... 6 = sábado. */
export function diaDaSemana(data: string): number {
  return new Date(diaCivil(data) * 86_400_000).getUTCDay();
}

/** Último dia do mês (28 a 31). `mes` de 1 a 12. */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** AAAA-MM-DD a partir das partes (sem validar o dia). */
export function montarData(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Número da semana civil (segunda a domingo): datas da mesma semana têm o mesmo número, semanas seguidas diferem em 1. */
export function semanaCivil(data: string): number {
  return Math.floor((diaCivil(data) + 3) / 7); // 01/01/1970 foi quinta-feira
}

/** Segundos inteiros desde `inicio` até agora (relógio do sistema; só para a interface). */
export function segundosDesde(inicio: Date): number {
  return Math.round((Date.now() - inicio.getTime()) / 1000);
}
