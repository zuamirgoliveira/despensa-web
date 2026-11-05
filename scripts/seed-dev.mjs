// Gera um arquivo de backup com dados de desenvolvimento (3 meses, 2 mercados, ~12 produtos).
// Uso: npm run seed:dev  → escreve dev-data/despensa-seed.json; importe em Ajustes → Importar backup.
// Só para desenvolvimento: dados inventados, sem CPF.
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const casaId = randomUUID();
const id = () => randomUUID();
const dv = (k) => { let s = 0, w = 2; for (let i = k.length - 1; i >= 0; i--) { s += +k[i] * w; w = w === 9 ? 2 : w + 1; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
const chave = (cnpj, numero) => { const c = `2626${"1108".slice(0, 0)}`; void c; const corpo = `26261108${cnpj}65002${String(numero).padStart(9, "0")}1${String(numero).padStart(8, "0")}`.slice(0, 43); return corpo + dv(corpo); };

export function gerarSeed(agora = new Date()) {
  const mercados = [
    { id: id(), casaId, cnpj: "08868231000638", nome: "CIA SANTOS (seed)", endereco: "AV EXEMPLO , 100 , CASA CAIADA , OLINDA , PE", tipo: "hortifruti", transporte: "bike_eletrica", distanciaKm: 4.2, tempoMinIda: 12 },
    { id: id(), casaId, cnpj: "11222333000181", nome: "SUPERMERCADO EXEMPLO (seed)", endereco: "RUA TESTE , 50 , CENTRO , RECIFE , PE", tipo: "supermercado", transporte: "carro", distanciaKm: 6, tempoMinIda: 15 },
  ];
  const base = [
    ["Tomate", "hortifruti", "kg", 1, 0], ["Banana Prata", "hortifruti", "kg", 1.2, 0], ["Cebola", "hortifruti", "kg", 0.8, 0],
    ["Arroz", "mercearia", "pacote", 2, 1], ["Feijão", "mercearia", "pacote", 1, 1], ["Café", "mercearia", "pacote", 1, 1],
    ["Leite", "laticinios", "un", 6, 1], ["Detergente", "limpeza", "un", 2, 1],
  ];
  const produtos = base.map(([nome, categoria, unidade, meta, m]) => ({
    id: id(), casaId, nome, categoria, unidade, meta, metaManual: false, frequencia: m ? "mensal" : "semanal",
    tipoIda: m ? "mercado_semanal" : "hortifruti_semanal", vidaUtilDias: categoria === "hortifruti" ? 7 : categoria === "laticinios" ? 10 : 180, contavel: false, ativo: true,
  }));
  const compras = [];
  for (let sem = 0; sem < 12; sem++) {
    const d = new Date(agora.getTime() - (11 - sem) * 7 * 86400000);
    const data = d.toISOString().slice(0, 10);
    const m = mercados[sem % 2];
    const itens = produtos.filter((p, i) => (m.tipo === "hortifruti" ? p.categoria === "hortifruti" : i % 2 === sem % 3 || p.categoria !== "hortifruti")).map((p, i) => {
      const preco = Math.round(300 + i * 150 + sem * 5);
      const q = p.meta;
      return { codigo: String(i + 1), descricao: p.nome.toUpperCase(), produtoId: p.id, quantidade: q, unidade: p.unidade === "kg" ? "KG" : "UNID", valorUnitarioCentavos: preco, valorTotalCentavos: Math.round(preco * q) };
    });
    compras.push({
      casaId, chave: chave(m.cnpj, 1000 + sem), mercadoId: m.id, emissao: `${data}T10:00:00`, valorTotalCentavos: itens.reduce((s, i) => s + i.valorTotalCentavos, 0),
      pagamento: "Cartão (seed)", itens, custoIdaCentavos: m.transporte === "carro" ? 1080 : 42, importadoEm: d.toISOString(),
    });
  }
  const apelidos = mercados.flatMap((m) => produtos.map((p, i) => ({ casaId, cnpj: m.cnpj, codigo: String(i + 1), produtoId: p.id })));
  const perfil = { id: id(), casaId, arredondarLocalizacao: true, folgaDias: 2, limiarAlertaPrecoPct: 20, economiaMinimaDivisaoCentavos: 500, janelaPrecoDias: 60, carro: { consumoKmPorLitro: 10, precoCombustivelCentavos: 600, desgasteCentavosPorKm: 30 }, bikeCentavosPorKm: 5 };
  const agendas = [
    { id: id(), casaId, tipo: "feira_mensal", diaDoMes: 5 }, { id: id(), casaId, tipo: "mercado_semanal", diaDaSemana: 6 }, { id: id(), casaId, tipo: "hortifruti_semanal", diaDaSemana: 3 },
  ];
  return {
    versao: 1, exportadoEm: agora.toISOString(),
    colecoes: { casas: [{ id: casaId, nome: "Casa (seed)" }], perfis: [perfil], agendas, mercados, produtos, apelidos, estoques: [], compras, listas: [], itensLista: [], conferencias: [] },
  };
}

if (process.argv[1] && process.argv[1].endsWith("seed-dev.mjs")) {
  mkdirSync("dev-data", { recursive: true });
  writeFileSync("dev-data/despensa-seed.json", JSON.stringify(gerarSeed(), null, 2));
  console.log("dev-data/despensa-seed.json gerado. Importe em Ajustes → Importar backup.");
}
