import { fracaoDoNivel } from "@/domain/estoque";
import { describe, expect, it } from "vitest";
import { agruparPorLocal, DIAS_PARA_REVISAR, nivelEstimado, selecionarParaRevisar, SEM_LOCAL, type ProdutoParaConferir } from "@/domain/conferencia";
import type { Compra, Estoque, Produto } from "@/domain/types";

const casaId = crypto.randomUUID();
const id = () => crypto.randomUUID();
const produto = (extra: Partial<Produto> = {}): Produto => ({
  id: id(), casaId, nome: "P", categoria: "mercearia", unidade: "un", meta: 30, metaManual: false, recorrente: true, frequencia: "mensal",
  tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
});
const estoque = (p: Produto, nivel: Estoque["nivel"], confirmadoEm: string): Estoque => ({ id: id(), casaId, produtoId: p.id, quantidade: fracaoDoNivel(nivel), nivel, confirmadoEm });
const revisar = (produtos: Produto[], estoques: Estoque[], extra: { compras?: Compra[]; hoje?: string } = {}) =>
  selecionarParaRevisar({ hoje: "2026-11-08", produtos, estoques, compras: [], ...extra });
const motivos = (r: ProdutoParaConferir[]) => Object.fromEntries(r.map((i) => [i.produto.nome, i.motivo]));

describe("nivelEstimado", () => {
  it.each([
    [10, 10, "cheio"],
    [7.5, 10, "cheio"],
    [7.4, 10, "metade"],
    [3.5, 10, "metade"],
    [3.4, 10, "acabando"],
    [0.6, 10, "acabando"],
    [0.5, 10, "acabou"],
    [0, 10, "acabou"],
  ])("estoque %s de %s → %s", (e, ref, nivel) => expect(nivelEstimado(e, ref)).toBe(nivel));
  it("referência zero: sem estimativa", () => expect(nivelEstimado(0, 0)).toBeUndefined());
});

describe("selecionarParaRevisar", () => {
  it("sem registro, provavelmente acabando e desatualizado entram; fresco, arquivado e acabado recente ficam de fora", () => {
    const semRegistro = produto({ nome: "Novo" });
    const quase = produto({ nome: "Quase", meta: 30 }); // consumo 1/dia; cheio há 29 dias → resta 1 de 30
    const fresco = produto({ nome: "Fresco" });
    const antigo = produto({ nome: "Antigo", frequencia: "sob_demanda", meta: 300 }); // sem consumo: só o tempo conta
    const arquivado = produto({ nome: "Arquivado", ativo: false });
    const acabou = produto({ nome: "Acabou" });
    const r = revisar(
      [semRegistro, quase, fresco, antigo, arquivado, acabou],
      [
        estoque(quase, "cheio", "2026-10-10T10:00:00Z"),
        estoque(fresco, "cheio", "2026-11-08T10:00:00Z"),
        estoque(antigo, "cheio", "2026-10-01T10:00:00Z"),
        estoque(arquivado, "acabou", "2026-11-08T10:00:00Z"),
        estoque(acabou, "acabou", "2026-11-08T10:00:00Z"),
      ],
    );
    expect(motivos(r)).toEqual({ Novo: "sem_registro", Quase: "provavelmente_acabando", Antigo: "desatualizado" });
  });

  it("registrado como cheio, mas a estimativa já diz que acabou: mostra a estimativa", () => {
    const p = produto({ nome: "Quase", meta: 30 });
    expect(revisar([p], [estoque(p, "cheio", "2026-10-10T10:00:00Z")])[0]).toMatchObject({ motivo: "provavelmente_acabando", nivelAtual: "cheio", nivelEstimado: "acabou" });
  });

  it(`limite do desatualizado: ${DIAS_PARA_REVISAR} dias não pergunta; um dia a mais sim`, () => {
    const p = produto({ meta: 300, frequencia: "sob_demanda" });
    expect(revisar([p], [estoque(p, "cheio", "2026-10-25T10:00:00Z")])).toEqual([]); // 14 dias
    expect(revisar([p], [estoque(p, "cheio", "2026-10-24T10:00:00Z")])).toHaveLength(1); // 15 dias
  });

  it("não depende de agenda nem de tipo de ida e carrega o local", () => {
    const a = produto({ nome: "A", localCasa: " Geladeira ", tipoIda: "feira_mensal" });
    const b = produto({ nome: "B", tipoIda: "hortifruti_semanal" });
    expect(revisar([a, b], []).map((i) => [i.produto.nome, i.local, i.nivelAtual])).toEqual([["A", "Geladeira", undefined], ["B", SEM_LOCAL, undefined]]);
  });
});

describe("agruparPorLocal", () => {
  const item = (nome: string, local: string): ProdutoParaConferir => ({ produto: produto({ nome }), motivo: "sem_registro", local });
  it("agrupa, ordena os locais e deixa 'Sem local' por último; nomes em ordem", () => {
    const g = agruparPorLocal([item("Zebra", "Geladeira"), item("Sal", SEM_LOCAL), item("Arroz", "Armário"), item("Alface", "Geladeira")]);
    expect(g.map((x) => x.local)).toEqual(["Armário", "Geladeira", SEM_LOCAL]);
    expect(g[1].itens.map((i) => i.produto.nome)).toEqual(["Alface", "Zebra"]);
  });
  it("lista vazia", () => expect(agruparPorLocal([])).toEqual([]));
  it("só 'Sem local'", () => expect(agruparPorLocal([item("A", SEM_LOCAL)]).map((x) => x.local)).toEqual([SEM_LOCAL]));
});
