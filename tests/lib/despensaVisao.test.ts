import { describe, expect, it } from "vitest";
import { agruparLinhas, filtrarLinhas, montarLinhas, resumirDespensa } from "@/lib/despensaVisao";
import type { Estoque, Produto } from "@/domain/types";

const prod = (id: string, extra: Partial<Produto> = {}): Produto => ({
  id, casaId: "c", nome: id, categoria: "mercearia", unidade: "un", meta: 4, metaManual: true, recorrente: true,
  frequencia: "semanal", tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
});
const est = (produtoId: string, quantidade: number): Estoque => ({ id: `e${produtoId}`, casaId: "c", produtoId, quantidade, nivel: "cheio", confirmadoEm: "2026-11-01T10:00:00Z" });

const produtos = [
  prod("Arroz", { localCasa: "Armário" }), prod("Leite", { categoria: "laticinios", localCasa: "Geladeira" }), prod("Sal", { meta: 0 }),
  prod("Tempero", { recorrente: false }), prod("Velho", { ativo: false }), prod("Novo"),
];
const estoques = [est("Arroz", 0), est("Leite", 1), est("Sal", 2), est("Tempero", 0), est("Velho", 0)];
const linhas = montarLinhas(produtos, estoques, [], "2026-11-06");
const nomes = (ls: { produto: Produto }[]) => ls.map((l) => l.produto.nome);

describe("filtrarLinhas", () => {
  it("todos esconde arquivados; com arquivados mostra", () => {
    expect(nomes(filtrarLinhas(linhas, "todos", "", false))).toEqual(["Arroz", "Leite", "Sal", "Tempero", "Novo"]);
    expect(nomes(filtrarLinhas(linhas, "todos", "", true))).toContain("Velho");
  });
  it("faltando = recorrentes zerados ou abaixo do padrão", () => {
    expect(nomes(filtrarLinhas(linhas, "faltando", "", false))).toEqual(["Arroz", "Leite"]);
  });
  it("zerados inclui não recorrentes", () => expect(nomes(filtrarLinhas(linhas, "zerados", "", false))).toEqual(["Arroz", "Tempero"]));
  it("não recorrentes e sem padrão", () => {
    expect(nomes(filtrarLinhas(linhas, "nao_recorrentes", "", false))).toEqual(["Tempero"]);
    expect(nomes(filtrarLinhas(linhas, "sem_padrao", "", false))).toEqual(["Sal"]);
  });
  it("busca ignora caixa e acento", () => expect(nomes(filtrarLinhas(linhas, "todos", "ÁRR", false))).toEqual(["Arroz"]));
});

describe("agruparLinhas", () => {
  it("por categoria, na ordem fixa", () => {
    expect(agruparLinhas(filtrarLinhas(linhas, "todos", "", false), "categoria").map((g) => g.titulo)).toEqual(["Mercearia", "Laticínios"]);
  });
  it("por local, 'Sem local' por último", () => {
    const g = agruparLinhas(filtrarLinhas(linhas, "todos", "", false), "local");
    expect(g.map((x) => x.titulo)).toEqual(["Armário", "Geladeira", "Sem local"]);
    expect(nomes(g[2].linhas)).toEqual(["Novo", "Sal", "Tempero"]);
  });
});

describe("resumirDespensa", () => {
  it("conta só ativos; não recorrentes zerados à parte", () => {
    expect(resumirDespensa(linhas)).toEqual({ itens: 5, zerados: 1, abaixo: 1, naoRecorrentesZerados: 1 });
  });
});

import { lerQuantidade } from "@/lib/despensaVisao";
describe("lerQuantidade", () => {
  it.each([["2", 2], ["1,5", 1.5], [" 0,25 ", 0.25], ["0", 0], ["", undefined], ["-1", undefined], ["abc", undefined], ["1,2345", 1.235]] as const)("%j → %s", (t, n) => {
    expect(lerQuantidade(t)).toBe(n);
  });
});
