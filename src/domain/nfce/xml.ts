// Leitura do XML da NFC-e devolvido pela consulta do QR Code (SEFAZ-PE). Sem biblioteca de XML: o layout
// da NFe 4.00 é fixo e só as tags abaixo importam. Nunca devolve CPF: só sinaliza `cpfNaNota`.
import { conferirNota, UNIDADES_ALIAS, type ItemNota, type NotaParseada, type ResultadoParser } from "./parser";

const PAGAMENTOS: Readonly<Record<string, string>> = {
  "01": "Dinheiro",
  "02": "Cheque",
  "03": "Cartão de Crédito",
  "04": "Cartão de Débito",
  "05": "Crédito Loja",
  "10": "Vale Alimentação",
  "11": "Vale Refeição",
  "12": "Vale Presente",
  "13": "Vale Combustível",
  "15": "Boleto Bancário",
  "17": "PIX",
  "99": "Outros",
};

const entidades: Readonly<Record<string, string>> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const texto = (s: string): string => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => entidades[m]).trim();

/** Conteúdo da primeira tag `<nome>` dentro de `trecho`. */
function tag(trecho: string, nome: string): string | null {
  const m = trecho.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`));
  return m ? texto(m[1]) : null;
}

const numero = (s: string | null): number => (s == null ? 0 : Number(s));
const centavos = (s: string | null): number => Math.round(numero(s) * 100);

/** Converte o XML (nfeProc) na mesma estrutura do texto colado, com as mesmas conferências. */
export function parseNotaXml(xml: unknown): ResultadoParser {
  const avisos: string[] = [];
  const erros: string[] = [];
  const x = String(xml ?? "");

  const infNFe = x.match(/<infNFe\b[^>]*\bId="NFe(\d{44})"/);
  const emit = tag(x, "emit") ?? "";
  const ender = tag(emit, "enderEmit") ?? "";
  const ide = tag(x, "ide") ?? "";
  const total = tag(x, "ICMSTot") ?? "";
  const dh = tag(ide, "dhEmi")?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);

  const itens: ItemNota[] = [];
  for (const m of x.matchAll(/<det\b[^>]*>([\s\S]*?)<\/det>/g)) {
    const prod = tag(m[1], "prod") ?? "";
    const bruta = (tag(prod, "uCom") ?? "UN").toUpperCase();
    const descricao = tag(prod, "xProd") ?? "";
    const unidade = UNIDADES_ALIAS[bruta];
    if (!unidade) avisos.push(`${descricao}: unidade "${bruta}" desconhecida; tratada como unidade.`);
    const desconto = centavos(tag(prod, "vDesc"));
    itens.push({
      descricao,
      codigo: tag(prod, "cProd") ?? "",
      quantidade: numero(tag(prod, "qCom")),
      unidade: unidade ?? "UNID",
      valorUnitarioCentavos: centavos(tag(prod, "vUnCom")),
      valorTotalCentavos: centavos(tag(prod, "vProd")) - desconto,
    });
  }
  if (!itens.length) erros.push("Não encontrei nenhum item na nota.");

  const endereco = [tag(ender, "xLgr"), tag(ender, "nro"), tag(ender, "xBairro"), tag(ender, "xMun"), tag(ender, "UF")].filter(Boolean).join(", ");
  const tPag = tag(tag(x, "pag") ?? "", "tPag");
  const vNF = tag(total, "vNF");

  const nota: NotaParseada = {
    loja: { nome: tag(emit, "xNome") ?? "", cnpj: (tag(emit, "CNPJ") ?? "").replace(/\D/g, ""), endereco },
    itens,
    numero: tag(ide, "nNF") ? Number(tag(ide, "nNF")) : null,
    serie: tag(ide, "serie") ? Number(tag(ide, "serie")) : null,
    emissao: dh ? `${dh[1]}T${dh[2]}` : null,
    protocolo: tag(x, "nProt"),
    chave: infNFe ? infNFe[1] : null,
    totalItens: itens.length || null,
    valorPagarCentavos: vNF == null ? null : centavos(vNF),
    somaItensCentavos: itens.reduce((s, i) => s + i.valorTotalCentavos, 0),
    pagamento: tPag ? (PAGAMENTOS[tPag] ?? "Outros") : null,
    // o CPF do consumidor vem em <dest>; só a existência é registrada, o número nunca sai daqui
    cpfNaNota: /<dest\b[\s\S]*?<CPF>/.test(x) || /<CPF>\d{11}<\/CPF>/.test(x),
  };
  if (!nota.loja.cnpj) erros.push("Não encontrei o CNPJ do mercado na nota.");
  conferirNota(nota, avisos, erros);
  return { nota, avisos, erros };
}
