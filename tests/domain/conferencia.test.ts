import { describe, expect, it } from "vitest";
import { agruparPorLocal, nivelEstimado, selecionarParaConferir, SEM_LOCAL, type ProdutoParaConferir } from "@/domain/conferencia";
import type { EntradaLista } from "@/domain/lista";
import type { AgendaIda, Estoque, Produto } from "@/domain/types";

const casaId = crypto.randomUUID();
const id = () => crypto.randomUUID();
const AGENDAS: AgendaIda[] = [
  { id: id(), casaId, tipo: "feira_mensal", diaDoMes: 30 },
  { id: id(), casaId, tipo: "mercado_semanal", diaDaSemana: 6 },
  { id: id(), casaId, tipo: "hortifruti_semanal", diaDaSemana: 3 },
];
const produto = (extra: Partial<Produto> = {}): Produto => ({
  id: id(), casaId, nome: "P", categoria: "mercearia", unidade: "un", meta: 30, metaManual: false, frequencia: "mensal",
  tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
});
const estoque = (p: Produto, nivel: Estoque["nivel"], confirmadoEm: string): Estoque => ({ id: id(), casaId, produtoId: p.id, nivel, confirmadoEm });
const entrada = (produtos: Produto[], estoques: Estoque[], extra: Partial<EntradaLista> = {}): EntradaLista => ({
  tipo: "mercado_semanal", hoje: "2026-11-08", produtos, estoques, compras: [], agendas: AGENDAS, folgaDias: 2, ...extra,
});
const motivos = (r: ReturnType<typeof selecionarParaConferir>) => Object.fromEntries((r ?? []).map((i) => [i.produto.nome, i.motivo]));

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

describe("selecionarParaConferir", () => {
  it("sem agenda do tipo devolve undefined", () => expect(selecionarParaConferir(entrada([], [], { agendas: [] }))).toBeUndefined());

  it("inclui o que a lista incluiria, o provavelmente acabando e o desatualizado; ignora o resto", () => {
    const naLista = produto({ nome: "NaLista" }); // acabou → entra na lista
    const quase = produto({ nome: "Quase", meta: 30 }); // cheio há 28 dias: sobra ~2 → mas confirmado há muito (desatualizado ou acabando)
    const fresco = produto({ nome: "Fresco" }); // cheio e confirmado hoje: fora
    const antigo = produto({ nome: "Antigo" }); // cheio há 10 dias (> ciclo 7), mas ainda sobra bastante: fora da lista
    const arquivado = produto({ nome: "Arquivado", ativo: false });
    const outroTipo = produto({ nome: "OutroTipo", tipoIda: "hortifruti_semanal" });
    const r = selecionarParaConferir(
      entrada(
        [naLista, quase, fresco, antigo, arquivado, outroTipo],
        [
          estoque(naLista, "acabou", "2026-11-08T10:00:00Z"),
          estoque(quase, "cheio", "2026-10-11T10:00:00Z"),
          estoque(fresco, "cheio", "2026-11-08T10:00:00Z"),
          estoque(antigo, "cheio", "2026-10-29T10:00:00Z"),
          estoque(arquivado, "acabou", "2026-11-08T10:00:00Z"),
          estoque(outroTipo, "acabou", "2026-11-08T10:00:00Z"),
        ],
      ),
    );
    expect(motivos(r)).toEqual({ NaLista: "na_lista", Quase: "na_lista", Antigo: "desatualizado" });
  });

  it("registrado como cheio, mas a estimativa já diz que acabou: pergunta e mostra a estimativa", () => {
    // consumo 1/dia (meta 30 mensal); cheio confirmado há 29 dias → resta 1 de 30 (3%)
    const p = produto({ nome: "Quase", meta: 30 });
    const r = selecionarParaConferir(entrada([p], [estoque(p, "cheio", "2026-10-10T10:00:00Z")]));
    expect(r?.[0]).toMatchObject({ motivo: "na_lista", nivelAtual: "cheio", nivelEstimado: "acabou" });
  });

  it("produto sem registro de estoque pergunta", () => {
    const p = produto({ nome: "Novo" });
    const r = selecionarParaConferir(entrada([p], [], { compras: [] }));
    expect(motivos(r)).toEqual({ Novo: "sem_registro" });
    expect(r?.[0].nivelAtual).toBeUndefined();
  });

  it("limite do desatualizado: exatamente o ciclo não pergunta; um dia a mais sim", () => {
    const p = produto({ meta: 300, frequencia: "sob_demanda" }); // sem consumo: nunca entra na lista
    // ida 14/11, seguinte 21/11 → ciclo 7. Confirmado há 7 dias (01/11) não; há 8 dias (31/10) sim.
    expect(selecionarParaConferir(entrada([p], [estoque(p, "cheio", "2026-11-01T10:00:00Z")]))).toEqual([]);
    expect(selecionarParaConferir(entrada([p], [estoque(p, "cheio", "2026-10-31T10:00:00Z")]))).toHaveLength(1);
  });

  it("produtos de feira puxados para a lista semanal também são conferidos", () => {
    const cafe = produto({ nome: "Café", tipoIda: "feira_mensal", frequencia: "mensal", meta: 3, unidade: "kg" });
    const r = selecionarParaConferir(entrada([cafe], [estoque(cafe, "metade", "2026-11-01T10:00:00Z")]));
    expect(motivos(r)).toEqual({ Café: "na_lista" });
  });

  it("carrega o local (ou 'Sem local') e o nível atual", () => {
    const a = produto({ nome: "A", localCasa: " Geladeira " });
    const b = produto({ nome: "B" });
    const r = selecionarParaConferir(entrada([a, b], [estoque(a, "acabou", "2026-11-08T10:00:00Z"), estoque(b, "acabou", "2026-11-08T10:00:00Z")]))!;
    expect(r.map((i) => [i.produto.nome, i.local, i.nivelAtual])).toEqual([["A", "Geladeira", "acabou"], ["B", SEM_LOCAL, "acabou"]]);
  });
});

describe("agruparPorLocal", () => {
  const item = (nome: string, local: string): ProdutoParaConferir => ({ produto: produto({ nome }), motivo: "na_lista", local });
  it("agrupa, ordena os locais e deixa 'Sem local' por último; nomes em ordem", () => {
    const g = agruparPorLocal([item("Zebra", "Geladeira"), item("Sal", SEM_LOCAL), item("Arroz", "Armário"), item("Alface", "Geladeira")]);
    expect(g.map((x) => x.local)).toEqual(["Armário", "Geladeira", SEM_LOCAL]);
    expect(g[1].itens.map((i) => i.produto.nome)).toEqual(["Alface", "Zebra"]);
  });
  it("lista vazia", () => expect(agruparPorLocal([])).toEqual([]));
  it("só 'Sem local'", () => expect(agruparPorLocal([item("A", SEM_LOCAL)]).map((x) => x.local)).toEqual([SEM_LOCAL]));
});
