// Datas sem hora (YYYY-MM-DD) e relógio. Nas regras de negócio, `hoje` é sempre parâmetro.

const FUSO = "America/Recife";

/** Data de hoje no fuso de Recife, como YYYY-MM-DD. `agora` é injetável nos testes. */
export function hojeRecife(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}
