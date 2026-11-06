import { fracaoDoNivel } from "@/domain/estoque";
import { describe, expect, it } from "vitest";
import { arredondarParaCima, estimarCusto, gerarLista, mesclarRegeracao, passoDaUnidade, ultimoPrecoUnitario, type EntradaLista, type ItemListaSugerido } from "@/domain/lista";
import type { AgendaIda, Compra, Estoque, ItemLista, Produto } from "@/domain/types";

const casaId = crypto.randomUUID();
const id = () => crypto.randomUUID();

const AGENDAS: AgendaIda[] = [
  { id: id(), casaId, tipo: "feira_mensal", diaDoMes: 30 },
  { id: id(), casaId, tipo: "mercado_semanal", diaDaSemana: 6 }, // sábado
  { id: id(), casaId, tipo: "hortifruti_semanal", diaDaSemana: 3 }, // quarta
];
// hoje = domingo 08/11/2026: mercado 14/11 (e 21, 28); hortifruti 11/11 (e 18); feira 30/11

const produto = (extra: Partial<Produto> = {}): Produto => ({
  id: id(), casaId, nome: "Produto", categoria: "mercearia", unidade: "kg", meta: 1, metaManual: false, recorrente: true,
  frequencia: "semanal", tipoIda: "mercado_semanal", vidaUtilDias: 180, contavel: false, ativo: true, ...extra,
});
const estoque = (p: Produto, nivel: Estoque["nivel"], confirmadoEm = "2026-11-08T10:00:00Z"): Estoque => ({
  id: id(), casaId, produtoId: p.id, quantidade: fracaoDoNivel(nivel), nivel, confirmadoEm,
});
const entrada = (tipo: EntradaLista["tipo"], produtos: Produto[], estoques: Estoque[], extra: Partial<EntradaLista> = {}): EntradaLista => ({
  tipo, hoje: "2026-11-08", produtos, estoques, compras: [], agendas: AGENDAS, folgaDias: 2, ...extra,
});
const compra = (data: string, itens: [string, number, number][]): Compra => ({
  casaId, chave: String(Math.random()).slice(2).padEnd(44, "0").slice(0, 44), mercadoId: id(), emissao: `${data}T10:00:00`,
  valorTotalCentavos: 0, pagamento: "", importadoEm: "2026-11-05T10:00:00Z",
  itens: itens.map(([produtoId, quantidade, preco], i) => ({
    codigo: String(i), descricao: "X", produtoId, quantidade, unidade: "KG" as const, valorUnitarioCentavos: preco, valorTotalCentavos: Math.round(preco * quantidade),
  })),
});
const doProduto = (lista: ReturnType<typeof gerarLista>, p: Produto) => lista?.itens.find((i) => i.produtoId === p.id);

describe("arredondarParaCima", () => {
  it.each([
    [1.6000000000000003, 0.1, 1.6],
    [0.30000000000000004, 0.1, 0.3],
    [3.857, 1, 4],
    [3.857, 0.5, 4],
    [3.01, 0.5, 3.5],
    [0, 1, 0],
    [2, 1, 2],
  ])("%s com passo %s → %s", (v, passo, esperado) => expect(arredondarParaCima(v, passo)).toBe(esperado));
});

describe("gerarLista: básico", () => {
  it("sem agenda do tipo devolve undefined", () => {
    expect(gerarLista(entrada("mercado_semanal", [], [], { agendas: [] }))).toBeUndefined();
  });

  it("devolve a ida alvo (tipo e data) e resumo vazio sem produtos", () => {
    const r = gerarLista(entrada("mercado_semanal", [], []))!;
    expect(r.ida).toMatchObject({ tipo: "mercado_semanal", data: "2026-11-14" });
    expect(r.itens).toEqual([]);
    expect(r.resumo).toEqual({ totalEstimadoCentavos: 0, semPreco: [], avisos: [] });
  });

  it("produto arquivado nunca entra, nem acabado", () => {
    const p = produto({ ativo: false });
    expect(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "acabou")]))!.itens).toEqual([]);
  });

  it("produto de outro tipo de ida não entra", () => {
    const p = produto({ tipoIda: "hortifruti_semanal" });
    expect(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "acabando")]))!.itens).toEqual([]);
  });
});

describe("regra de cobertura", () => {
  it("(3) hortifruti: tomate pela metade entra com a quantidade esperada", () => {
    const tomate = produto({ nome: "Tomate", categoria: "hortifruti", tipoIda: "hortifruti_semanal", meta: 1, vidaUtilDias: 14 });
    const r = gerarLista(entrada("hortifruti_semanal", [tomate], [estoque(tomate, "metade")]))!;
    expect(r.ida.data).toBe("2026-11-11");
    // consumo 1/7; estoque em T = 0,5 − 3/7 = 0,0714; quantidade = 1/7 × 9 − 0,0714 = 1,214 → 1,3 kg
    expect(doProduto(r, tomate)).toMatchObject({ quantidade: 1.3, motivo: "cobertura", urgente: false });
  });

  it("produto bem abastecido não entra (cobertura ≥ ciclo + folga)", () => {
    const p = produto({ meta: 30, frequencia: "mensal", unidade: "un" }); // 1/dia, cheio = 30 dias
    expect(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "cheio")]))!.itens).toEqual([]);
  });

  it("produto de consumo semanal comprado hoje já entra na ida da semana (meta cobre só 7 dias)", () => {
    const p = produto({ meta: 1, frequencia: "semanal" });
    expect(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "cheio")]))!.itens).toHaveLength(1);
  });

  it("limite exato: cobertura igual ao ciclo + folga não entra; abaixo entra", () => {
    // consumo 1/dia (meta 7 semanal); ciclo = 7 + 2 = 9; estoque em T (6 dias adiante) deve ser 9 → hoje 15
    const p = produto({ meta: 7, unidade: "un" });
    const comEstoque = (q: number) => ({ ...estoque(p, "cheio"), nivel: "cheio" as const, quantidadeExata: q });
    // usa meta variável para controlar o estoque cheio: meta 15 e consumo 1/dia via histórico
    const compras = [compra("2026-10-01", [[p.id, 7, 100]]), compra("2026-10-08", [[p.id, 7, 100]])]; // 1/dia
    const p15 = { ...p, meta: 15 };
    const r = gerarLista(entrada("mercado_semanal", [p15], [estoque(p15, "cheio")], { compras }))!;
    expect(r.itens).toEqual([]); // 15 − 6 = 9 → 9/1 = 9, não é < 9
    const p14 = { ...p, meta: 14 };
    expect(gerarLista(entrada("mercado_semanal", [p14], [estoque(p14, "cheio")], { compras }))!.itens).toHaveLength(1); // 8 < 9
    void comEstoque;
  });

  it("(5) acabou entra mesmo com meta zero, com 1 unidade mínima", () => {
    const p = produto({ meta: 0, unidade: "un" });
    const item = doProduto(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "acabou")]))!, p);
    expect(item).toMatchObject({ quantidade: 1, motivo: "acabou" });
  });

  it("acabou: é urgente quando a ida é daqui a mais de 1 dia, e não quando é amanhã", () => {
    const p = produto({ meta: 2, unidade: "un" });
    expect(doProduto(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "acabou")]))!, p)?.urgente).toBe(true); // 6 dias
    const h = produto({ categoria: "hortifruti", tipoIda: "hortifruti_semanal", unidade: "un", meta: 2 });
    const amanha = entrada("hortifruti_semanal", [h], [estoque(h, "acabou", "2026-11-10T10:00:00Z")], { hoje: "2026-11-10" });
    expect(doProduto(gerarLista(amanha)!, h)).toMatchObject({ motivo: "acabou", urgente: false }); // ida 11/11
  });

  it("(9) sem histórico usa a meta e a frequência declarada", () => {
    const p = produto({ unidade: "un", meta: 3, frequencia: "semanal" });
    // consumo 3/7, acabando = 0,6; em T (6 dias) = 0; ciclo 9 → 3/7 × 9 = 3,857 → 4 un
    expect(doProduto(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "acabando")]))!, p)?.quantidade).toBe(4);
  });

  it("usa o consumo do histórico de compras", () => {
    const p = produto({ unidade: "un", meta: 10 });
    const compras = [compra("2026-10-01", [[p.id, 14, 100]]), compra("2026-10-08", [[p.id, 14, 100]])]; // 2/dia
    const r = gerarLista(entrada("mercado_semanal", [p], [estoque(p, "acabando")], { compras }))!;
    expect(doProduto(r, p)?.quantidade).toBe(18); // 2 × 9 − 0
  });

  it("sem registro de estoque assume cheio desde a última compra", () => {
    const p = produto({ unidade: "un", meta: 30, frequencia: "mensal" }); // 1/dia; cheio = 30
    const antiga = [compra("2026-10-01", [[p.id, 30, 100]])]; // cheio há 38 dias → 0 hoje → entra
    expect(doProduto(gerarLista(entrada("mercado_semanal", [p], [], { compras: antiga }))!, p)).toMatchObject({ motivo: "cobertura" });
    const recente = [compra("2026-11-08", [[p.id, 30, 100]])]; // cheio hoje → 24 em T → não entra
    expect(doProduto(gerarLista(entrada("mercado_semanal", [p], [], { compras: recente }))!, p)).toBeUndefined();
  });

  it("sem registro e sem compra assume cheio desde hoje", () => {
    const p = produto({ unidade: "un", meta: 30, frequencia: "mensal" });
    expect(gerarLista(entrada("mercado_semanal", [p], []))!.itens).toEqual([]);
  });

  it("(6) arredondamento para cima por unidade de compra", () => {
    const base = { meta: 3, frequencia: "semanal" as const }; // consumo 3/7; bruta 3,857
    const casos: [Produto["unidade"], number][] = [["kg", 3.9], ["un", 4], ["pacote", 4], ["l", 4]];
    for (const [unidade, esperado] of casos) {
      const p = produto({ ...base, unidade });
      expect(doProduto(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "acabando")]))!, p)?.quantidade).toBe(esperado);
    }
  });

  it("quantidade mínima de uma unidade (0,1 kg)", () => {
    // pouquíssimo consumo: bruta < 0,1
    const p = produto({ meta: 0.01, frequencia: "semanal", unidade: "kg" });
    expect(doProduto(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "acabou")]))!, p)?.quantidade).toBe(0.1);
  });

  it("(7) limite pela vida útil: nunca mais que consumo × vida útil", () => {
    const tomate = produto({ categoria: "hortifruti", tipoIda: "hortifruti_semanal", meta: 1, vidaUtilDias: 7 });
    // bruta 1,214 → 1,3, mas o teto é 1/7 × 7 = 1,0
    expect(doProduto(gerarLista(entrada("hortifruti_semanal", [tomate], [estoque(tomate, "metade")]))!, tomate)?.quantidade).toBe(1);
    // teto não múltiplo da unidade: consumo 2/7 × 5 = 1,43 → 1 un
    const p = produto({ unidade: "un", meta: 2, vidaUtilDias: 5 });
    expect(doProduto(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "acabando")]))!, p)?.quantidade).toBe(1);
    // teto abaixo da unidade mínima: vale a unidade mínima
    const q = produto({ unidade: "un", meta: 2, vidaUtilDias: 1 });
    expect(doProduto(gerarLista(entrada("mercado_semanal", [q], [estoque(q, "acabando")]))!, q)?.quantidade).toBe(1);
  });
});

describe("sob demanda", () => {
  const p = produto({ frequencia: "sob_demanda", unidade: "un", meta: 2 });
  it("cheio ou metade não entra", () => {
    expect(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "cheio")]))!.itens).toEqual([]);
    expect(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "metade")]))!.itens).toEqual([]);
    expect(gerarLista(entrada("mercado_semanal", [p], []))!.itens).toEqual([]);
  });
  it("acabando e acabou entram, com a meta como quantidade", () => {
    expect(doProduto(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "acabando")]))!, p)).toMatchObject({ quantidade: 2, motivo: "cobertura" });
    expect(doProduto(gerarLista(entrada("mercado_semanal", [p], [estoque(p, "acabou")]))!, p)).toMatchObject({ quantidade: 2, motivo: "acabou" });
  });
  it("acabando de outro tipo de ida não entra", () => {
    const h = produto({ ...p, id: id(), tipoIda: "hortifruti_semanal" });
    expect(gerarLista(entrada("mercado_semanal", [h], [estoque(h, "acabando")]))!.itens).toEqual([]);
  });
});

describe("puxar da feira mensal para a ida semanal anterior", () => {
  // café: meta 3 kg, mensal → 0,1 kg/dia. Feira em 30/11.
  const cafe = (extra: Partial<Produto> = {}) =>
    produto({ nome: "Café", tipoIda: "feira_mensal", frequencia: "mensal", meta: 3, ...extra });

  it("(1) café acaba antes da feira: entra na ida semanal que antecede o fim do estoque", () => {
    const p = cafe();
    // metade (1,5) confirmado em 01/11 → em 08/11 resta 0,8 (8 dias, acaba ≈ 16/11); feira só em 30/11
    const est = estoque(p, "metade", "2026-11-01T10:00:00Z");
    const r = gerarLista(entrada("mercado_semanal", [p], [est]))!; // ida 14/11
    expect(doProduto(r, p)).toMatchObject({ motivo: "puxado", urgente: false });
    // quantidade calculada contra a feira seguinte: 0,1 × (16 dias de 14/11 a 30/11 + 2) − 0,2 = 1,6
    expect(doProduto(r, p)?.quantidade).toBe(1.6);
  });

  it("o café puxado não aparece também na lista da feira", () => {
    const p = cafe();
    const est = estoque(p, "metade", "2026-11-01T10:00:00Z");
    expect(gerarLista(entrada("feira_mensal", [p], [est]))!.itens).toEqual([]);
  });

  it("ainda não é hora: estoque dura além da ida semanal + folga", () => {
    const p = cafe();
    const est = estoque(p, "metade", "2026-11-01T10:00:00Z");
    // hoje 01/11, ida 07/11: em T sobram 0,9 → cobertura 9, ciclo 7 + 2 = 9 → não entra
    expect(gerarLista(entrada("mercado_semanal", [p], [est], { hoje: "2026-11-01" }))!.itens).toEqual([]);
  });

  it("(2) arroz que dura além da feira não entra na lista semanal", () => {
    const arroz = produto({ nome: "Arroz", tipoIda: "feira_mensal", frequencia: "mensal", meta: 5 });
    const est = estoque(arroz, "cheio");
    expect(gerarLista(entrada("mercado_semanal", [arroz], [est]))!.itens).toEqual([]);
    // mas entra na feira, perto do fim
    const feira = gerarLista(entrada("feira_mensal", [arroz], [est]))!;
    expect(doProduto(feira, arroz)).toMatchObject({ motivo: "cobertura", urgente: false });
  });

  it("sem ida compatível até o fim do estoque entra na próxima compatível, urgente", () => {
    const p = cafe({ frequencia: "quinzenal", meta: 1 }); // 1/15 por dia
    const est = estoque(p, "acabando", "2026-11-08T10:00:00Z"); // 0,2 → cobertura 3 dias → acaba 11/11
    const r = gerarLista(entrada("mercado_semanal", [p], [est]))!; // ida 14/11 > 11/11
    expect(doProduto(r, p)).toMatchObject({ motivo: "puxado", urgente: true });
  });

  it("acabou de produto da feira vai para a primeira ida compatível (a semanal), não para a feira", () => {
    const p = cafe();
    const est = estoque(p, "acabou");
    const semanal = gerarLista(entrada("mercado_semanal", [p], [est]))!;
    expect(doProduto(semanal, p)).toMatchObject({ motivo: "acabou", urgente: true });
    // quantidade contra a feira seguinte: 0,1 × (16 + 2) = 1,8
    expect(doProduto(semanal, p)?.quantidade).toBe(1.8);
    expect(gerarLista(entrada("feira_mensal", [p], [est]))!.itens).toEqual([]);
  });

  it("acabou com a feira amanhã fica na feira", () => {
    const p = cafe();
    const est = estoque(p, "acabou", "2026-11-29T10:00:00Z");
    const r = gerarLista(entrada("feira_mensal", [p], [est], { hoje: "2026-11-29" }))!;
    expect(doProduto(r, p)).toMatchObject({ motivo: "acabou", urgente: false });
  });

  it("sem agenda do mercado semanal, o produto de feira continua na feira", () => {
    const sem = AGENDAS.filter((a) => a.tipo !== "mercado_semanal");
    const p = cafe();
    const est = estoque(p, "metade", "2026-11-01T10:00:00Z");
    expect(doProduto(gerarLista(entrada("feira_mensal", [p], [est], { agendas: sem }))!, p)).toBeDefined();
  });

  it("feira mensal com acabou e sem nenhuma outra agenda usa a própria feira", () => {
    const so = AGENDAS.filter((a) => a.tipo === "feira_mensal");
    const p = cafe();
    expect(doProduto(gerarLista(entrada("feira_mensal", [p], [estoque(p, "acabou")], { agendas: so }))!, p)).toMatchObject({ motivo: "acabou" });
  });

  it("(4) perecível nunca vai para a feira: é tratado como semanal e gera aviso", () => {
    const leite = produto({ nome: "Iogurte", categoria: "laticinios", tipoIda: "feira_mensal", frequencia: "semanal", meta: 7, unidade: "un", vidaUtilDias: 10 });
    const est = estoque(leite, "acabando");
    expect(gerarLista(entrada("feira_mensal", [leite], [est]))!.itens).toEqual([]);
    const semanal = gerarLista(entrada("mercado_semanal", [leite], [est]))!;
    expect(doProduto(semanal, leite)).toBeDefined();
    expect(semanal.resumo.avisos).toEqual([expect.stringContaining("Iogurte é perecível")]);
  });

  it("hortifruti de feira (categoria hortifruti) é puxado para o hortifruti semanal", () => {
    const p = produto({ categoria: "hortifruti", tipoIda: "feira_mensal", frequencia: "mensal", meta: 3, vidaUtilDias: 30 });
    const est = estoque(p, "metade", "2026-11-01T10:00:00Z");
    expect(doProduto(gerarLista(entrada("hortifruti_semanal", [p], [est]))!, p)).toMatchObject({ motivo: "puxado" });
    expect(gerarLista(entrada("mercado_semanal", [p], [est]))!.itens).toEqual([]);
  });

  it("estoque que só acaba depois que a ida semanal passa da feira não é puxado", () => {
    // hoje 28/11: próxima semanal 05/12 > feira 30/11 → a feira cobre
    const p = cafe();
    const est = estoque(p, "acabando", "2026-11-28T10:00:00Z");
    expect(gerarLista(entrada("mercado_semanal", [p], [est], { hoje: "2026-11-28" }))!.itens).toEqual([]);
  });
});

describe("estimativa de custo", () => {
  it("soma quantidade × último preço; sem preço fica fora e é listado", () => {
    const a = produto({ unidade: "un", meta: 7, nome: "A" });
    const b = produto({ unidade: "un", meta: 7, nome: "B" });
    const compras = [
      compra("2026-10-01", [[a.id, 1, 200]]),
      compra("2026-10-20", [[a.id, 1, 250]]), // o último preço vale
    ];
    const r = gerarLista(entrada("mercado_semanal", [a, b], [estoque(a, "acabou"), estoque(b, "acabou")], { compras }))!;
    const ia = doProduto(r, a)!;
    expect(ia.precoEstimadoCentavos).toBe(Math.round(ia.quantidade * 250));
    expect(doProduto(r, b)?.precoEstimadoCentavos).toBeUndefined();
    expect(r.resumo.totalEstimadoCentavos).toBe(ia.precoEstimadoCentavos);
    expect(r.resumo.semPreco).toEqual([b.id]);
  });

  it("ultimoPrecoUnitario", () => {
    const p = id();
    expect(ultimoPrecoUnitario(p, [])).toBeUndefined();
    expect(ultimoPrecoUnitario(p, [compra("2026-10-20", [[p, 1, 250]]), compra("2026-10-01", [[p, 1, 200]])])).toBe(250);
  });
});

describe("mesclarRegeracao", () => {
  const sug = (produtoId: string, quantidade: number): ItemListaSugerido => ({ produtoId, quantidade, motivo: "cobertura", urgente: false });
  const item = (produtoId: string | undefined, extra: Partial<ItemLista> = {}): ItemLista => ({
    id: id(), casaId, listaId: id(), produtoId, nomeAvulso: produtoId ? undefined : "Pilha", quantidadeSugerida: 1, status: "pendente",
    urgente: false, removido: false, quantidadeEditada: false, motivo: produtoId ? "cobertura" : "manual", ...extra,
  });

  it("acrescenta o que é novo", () => {
    const a = id();
    expect(mesclarRegeracao([sug(a, 2)], [])).toEqual({ adicionar: [sug(a, 2)], atualizar: [], remover: [] });
  });

  it("atualiza a quantidade do que o usuário não tocou", () => {
    const a = id();
    const existente = item(a);
    const r = mesclarRegeracao([sug(a, 5)], [existente]);
    expect(r.atualizar).toEqual([{ id: existente.id, quantidadeSugerida: 5, motivo: "cobertura", urgente: false }]);
    expect(r.adicionar).toEqual([]);
  });

  it("quantidade editada permanece", () => {
    const a = id();
    expect(mesclarRegeracao([sug(a, 5)], [item(a, { quantidadeEditada: true })])).toEqual({ adicionar: [], atualizar: [], remover: [] });
  });

  it("removido continua removido (não reaparece)", () => {
    const a = id();
    expect(mesclarRegeracao([sug(a, 5)], [item(a, { removido: true })])).toEqual({ adicionar: [], atualizar: [], remover: [] });
  });

  it("itens já pegos não são alterados", () => {
    const a = id();
    expect(mesclarRegeracao([sug(a, 5)], [item(a, { status: "pego" })]).atualizar).toEqual([]);
  });

  it("automáticos intocados que deixaram de ser sugeridos saem; avulsos, extras e editados ficam", () => {
    const velho = item(id());
    const editado = item(id(), { quantidadeEditada: true });
    const avulso = item(undefined);
    const extra = item(id(), { status: "extra", motivo: "manual" });
    const r = mesclarRegeracao([], [velho, editado, avulso, extra]);
    expect(r.remover).toEqual([velho.id]);
  });
});

describe("acabou: escolha da ida", () => {
  it("a ida própria mais cedo que a compatível vence; em empate, a própria", () => {
    // produto de feira, acabou hoje 27/11: feira dia 30 (3 dias > 1), semanal sábado 28/11 (1 dia): vai para a semanal
    const p = produto({ tipoIda: "feira_mensal", frequencia: "mensal", meta: 3 });
    const est = estoque(p, "acabou", "2026-11-27T10:00:00Z");
    const semanal = gerarLista(entrada("mercado_semanal", [p], [est], { hoje: "2026-11-27" }))!;
    expect(doProduto(semanal, p)).toMatchObject({ motivo: "acabou" });
    // feira só sem a agenda semanal: a própria feira é a única opção
    const so = AGENTS_SO_FEIRA();
    expect(doProduto(gerarLista(entrada("feira_mensal", [p], [est], { hoje: "2026-11-27", agendas: so }))!, p)).toMatchObject({ motivo: "acabou" });
  });

  it("feira no mesmo dia que a semanal (empate): fica na feira, a própria", () => {
    const agendas: AgendaIda[] = [
      { id: id(), casaId, tipo: "feira_mensal", diaDoMes: 14 },
      { id: id(), casaId, tipo: "mercado_semanal", diaDaSemana: 6 }, // 14/11/2026 é sábado
    ];
    const p = produto({ tipoIda: "feira_mensal", frequencia: "mensal", meta: 3 });
    const est = estoque(p, "acabou");
    expect(doProduto(gerarLista(entrada("feira_mensal", [p], [est], { agendas }))!, p)).toMatchObject({ motivo: "acabou" });
    expect(gerarLista(entrada("mercado_semanal", [p], [est], { agendas }))!.itens).toEqual([]);
  });
});

function AGENTS_SO_FEIRA(): AgendaIda[] {
  return AGENDAS.filter((a) => a.tipo === "feira_mensal");
}

describe("estimarCusto", () => {
  const item = (extra: Partial<ItemLista>): ItemLista => ({
    id: id(), casaId, listaId: id(), quantidadeSugerida: 1, status: "pendente", urgente: false, removido: false, quantidadeEditada: false, ...extra,
  });
  const p1 = id();
  const compras = [compra("2026-10-01", [[p1, 1, 500]])];

  it("soma quantidade × último preço, ignora removidos e lista os sem preço", () => {
    const a = item({ produtoId: p1, quantidadeSugerida: 2.5 });
    const semHistorico = item({ produtoId: id() });
    const avulso = item({ nomeAvulso: "Pilha" });
    const removido = item({ produtoId: p1, removido: true, quantidadeSugerida: 9 });
    expect(estimarCusto([a, semHistorico, avulso, removido], compras)).toEqual({ totalCentavos: 1250, semPreco: [semHistorico.id, avulso.id] });
  });

  it("lista vazia", () => expect(estimarCusto([], compras)).toEqual({ totalCentavos: 0, semPreco: [] }));
});

describe("passoDaUnidade", () => {
  it.each([["kg", 0.1], ["un", 1], ["pacote", 1], ["l", 0.5]] as const)("%s → %s", (u, p) => expect(passoDaUnidade(u)).toBe(p));
});
