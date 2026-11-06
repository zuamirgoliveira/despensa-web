import { describe, expect, it } from "vitest";
import { textoDaLista } from "@/lib/textoDaLista";
import { brl } from "@/lib/format";
import type { GrupoLista } from "@/lib/agruparLista";
import type { ItemLista, Produto } from "@/domain/types";

const produto = (nome: string, unidade: Produto["unidade"]): Produto => ({
  id: nome, casaId: "c", nome, categoria: "mercearia", unidade, meta: 1, metaManual: false, recorrente: true,
  frequencia: "semanal", tipoIda: "mercado_semanal", vidaUtilDias: 90, contavel: false, ativo: true,
});
const item = (extra: Partial<ItemLista> = {}): ItemLista => ({
  id: crypto.randomUUID(), casaId: "c", listaId: "l", quantidadeSugerida: 2, status: "pendente", urgente: false, removido: false, quantidadeEditada: false, ...extra,
});
const grupos = (...g: GrupoLista[]): GrupoLista[] => g;

describe("textoDaLista", () => {
  it("título com a data, seções e uma linha por item com quantidade e unidade", () => {
    const t = textoDaLista(
      grupos(
        { titulo: "Hortifruti", itens: [{ item: item({ quantidadeSugerida: 1.5 }), produto: produto("Alho", "kg") }, { item: item(), produto: produto("Coentro", "un") }] },
        { titulo: "Avulsos", itens: [{ item: item({ nomeAvulso: "Pilha AA" }) }] },
      ),
      "06/11/2026",
    );
    expect(t).toBe("Lista de compras (06/11/2026)\n\nHortifruti\n• 1,5 kg Alho\n• 2 un Coentro\n\nAvulsos\n• 2 Pilha AA");
  });

  it("deixa de fora removidos, pegos e extras; seção sem itens some", () => {
    const t = textoDaLista(
      grupos(
        { titulo: "A", itens: [{ item: item({ removido: true }), produto: produto("X", "un") }, { item: item({ status: "pego" }), produto: produto("Y", "un") }] },
        { titulo: "B", itens: [{ item: item({ status: "extra", nomeAvulso: "Z" }) }, { item: item({ status: "nao_encontrado" }), produto: produto("W", "pacote") }] },
      ),
      "01/01/2027",
    );
    expect(t).toBe("Lista de compras (01/01/2027)\n\nB\n• 2 pct W");
  });

  it("com preço conhecido: valor estimado por item e total; sem preço, só a quantidade", () => {
    const alho = produto("Alho", "kg");
    const t = textoDaLista(
      grupos({ titulo: "A", itens: [{ item: item({ produtoId: alho.id, quantidadeSugerida: 1.5 }), produto: alho }, { item: item({ nomeAvulso: "Pilha" }) }] }),
      "06/11/2026",
      (id) => (id === "Alho" ? 1000 : undefined),
    );
    expect(t).toBe(`Lista de compras (06/11/2026)\n\nA\n• 1,5 kg Alho (~${brl(1500)})\n• 2 Pilha`);
  });

  it("linha de estimativa só quando todos os itens têm preço", () => {
    const alho = produto("Alho", "kg");
    const t = textoDaLista(grupos({ titulo: "A", itens: [{ item: item({ produtoId: alho.id }), produto: alho }] }), "06/11/2026", () => 1000);
    expect(t).toContain(`Estimativa: ~${brl(2000)}`);
  });

  it("sem nada para comprar: undefined", () => {
    expect(textoDaLista([], "06/11/2026")).toBeUndefined();
    expect(textoDaLista(grupos({ titulo: "A", itens: [{ item: item({ status: "pego" }), produto: produto("Y", "un") }] }), "06/11/2026")).toBeUndefined();
  });
});
