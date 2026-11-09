import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { consultaDoQR } from "@/domain/nfce/sefaz";
import { parseNotaXml } from "@/domain/nfce/xml";

const XML = readFileSync(new URL("../fixtures/xml/nfce-sintetica.xml", import.meta.url), "utf8");
const P = "26261120300157005613651290000538591088539888|2|1|1|A889BEB8C3F7BD9C6FBCD31ABE7502218F4123B1";

describe("parseNotaXml", () => {
  const r = parseNotaXml(XML);
  it("lê mercado, itens, totais e chave sem erros", () => {
    expect(r.erros).toEqual([]);
    expect(r.nota.loja).toEqual({
      nome: "MERCADO TESTE & CIA",
      cnpj: "20300157005613",
      endereco: "AVENIDA GOVERNADOR CARLOS DE LIMA CAVALCANTI, 1245, CASA CAIADA, OLINDA, PE",
    });
    expect(r.nota.chave).toBe("26261120300157005613651290000538591088539888");
    expect(r.nota.emissao).toBe("2026-11-07T19:43:53");
    expect(r.nota.numero).toBe(53859);
    expect(r.nota.valorPagarCentavos).toBe(1245);
    expect(r.nota.somaItensCentavos).toBe(1245);
    expect(r.nota.pagamento).toBe("Cartão de Crédito");
    expect(r.nota.protocolo).toBe("126260000000001");
    expect(r.nota.itens).toEqual([
      { descricao: "REFRI COCA COLA ZERO 2L PET", codigo: "11976", quantidade: 1, unidade: "UNID", valorUnitarioCentavos: 1098, valorTotalCentavos: 1098 },
      { descricao: "CENOURA", codigo: "52", quantidade: 0.42, unidade: "KG", valorUnitarioCentavos: 350, valorTotalCentavos: 147 },
    ]);
  });
  it("sinaliza CPF mas nunca o devolve", () => {
    expect(r.nota.cpfNaNota).toBe(true);
    expect(JSON.stringify(r)).not.toContain("00000000000");
  });
  it("XML sem itens vira erro", () => {
    expect(parseNotaXml("<nfeProc></nfeProc>").erros.length).toBeGreaterThan(0);
  });
  it("soma diferente do total gera aviso", () => {
    expect(parseNotaXml(XML.replace("<vNF>12.45</vNF>", "<vNF>20.00</vNF>")).avisos.join(" ")).toMatch(/difere/);
  });
});

describe("consultaDoQR (só aceita a consulta pública de PE)", () => {
  it("aceita a URL do QR e a reconstrói", () => {
    const r = consultaDoQR(`https://nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe?p=${P}`);
    expect(r).toEqual({ url: `https://nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe?p=${P}`, chave: "26261120300157005613651290000538591088539888" });
  });
  it.each(
    [
      "http://nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe?p=" + P,
      "https://evil.example.com/nfce-web/consultarNFCe?p=" + P,
      "https://nfce.sefaz.pe.gov.br.evil.com/nfce-web/consultarNFCe?p=" + P,
      "https://nfce.sefaz.pe.gov.br:8080/nfce-web/consultarNFCe?p=" + P,
      "https://nfce.sefaz.pe.gov.br:444/outro/caminho?p=" + P,
      "https://nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe?p=abc",
      "https://nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe",
      "https://user:senha@nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe?p=" + P + "&x=http://a",
      "texto qualquer",
      "",
    ].map((u) => [u]),
  )("recusa %s", (u) => {
    // a URL com credenciais ou parâmetros extras é reconstruída sem eles; as demais são recusadas
    const r = consultaDoQR(u);
    if (u.includes("user:senha")) expect(r?.url).toBe(`https://nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe?p=${P}`);
    else expect(r).toBeNull();
  });
});
