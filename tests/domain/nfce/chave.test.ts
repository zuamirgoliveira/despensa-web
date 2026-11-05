import { describe, expect, it } from "vitest";
import {
  correcoesDeUmDigito,
  leituraAproximada,
  calcDV,
  chaveDoOCR,
  chavePlausivel,
  cnpjOk,
  decodeKey,
  formatCNPJ,
  keyFromQR,
  parseBR,
  round2,
} from "@/domain/nfce/chave";

const CHAVE = "26261108868231000638650020000689031020778720";
const IMP = "2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720";

describe("parseBR / round2 / formatCNPJ", () => {
  it.each([
    ["7,88", 7.88],
    ["1.234,56", 1234.56],
    ["12", 12],
  ])("parseBR(%s)", (entrada, esperado) => expect(parseBR(entrada)).toBe(esperado));

  it("round2", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0)).toBe(0);
  });

  it("formatCNPJ", () => expect(formatCNPJ("08868231000638")).toBe("08.868.231/0006-38"));
});

describe("decodeKey", () => {
  it("chave válida é decomposta", () => {
    const k = decodeKey(CHAVE);
    expect(k).toMatchObject({
      ok: true, uf: "PE", cnpj: "08868231000638", modelo: "65", serie: 2, numero: 68903, ehNFCe: true, ano: 2026, mes: 11, tpEmis: "1",
    });
  });

  it("aceita espaços, como impressa", () => expect(decodeKey(IMP).ok).toBe(true));

  it("rejeita dígito trocado", () => {
    const ruim = CHAVE.slice(0, 30) + "9" + CHAVE.slice(31);
    expect(decodeKey(ruim).ok).toBe(false);
  });

  it("rejeita chave curta com mensagem clara", () => {
    const r = decodeKey("123");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/3 dígitos/);
  });

  it("DV calculado confere", () => expect(calcDV(CHAVE.slice(0, 43))).toBe(0));

  it.each([
    ["0", 0], // soma 0 → resto 0 → DV 0
    ["6", 0], // 6×2=12 → resto 1 → DV 0
    ["5", 1], // 5×2=10 → resto 10 → DV 1
    ["1", 9], // 1×2=2 → DV 9
  ])("DV de %s", (corpo, dv) => expect(calcDV(corpo)).toBe(dv));
});

describe("keyFromQR", () => {
  it("v2 (?p=chave|2|1|1|hash)", () => {
    const url = `http://nfce.sefaz.pe.gov.br/nfce/consulta?p=${CHAVE}|2|1|1|A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2`;
    expect(keyFromQR(url)).toBe(CHAVE);
  });
  it("v1 (chNFe=)", () => expect(keyFromQR(`http://x/qr?chNFe=${CHAVE}&nVersao=100&tpAmb=1`)).toBe(CHAVE));
  it("chave com espaços no meio", () => expect(keyFromQR(IMP)).toBe(CHAVE));
  it("sem chave devolve null", () => expect(keyFromQR("https://exemplo.com/abc")).toBeNull());
  it("45 dígitos seguidos não é chave", () => expect(keyFromQR("1" + CHAVE + "1".repeat(0))).not.toBe(CHAVE));
});

describe("cnpjOk / chavePlausivel", () => {
  it("CNPJ válido e inválidos", () => {
    expect(cnpjOk("08868231000638")).toBe(true);
    expect(cnpjOk("08.868.231/0006-38")).toBe(true);
    expect(cnpjOk("08868231000639")).toBe(false);
    expect(cnpjOk("11111111111111")).toBe(false);
    expect(cnpjOk("123")).toBe(false);
  });

  it("chave plausível", () => {
    expect(chavePlausivel(CHAVE)).toBe(true);
    expect(chavePlausivel("123")).toBe(false);
  });

  it("rejeita modelo diferente de 65 mesmo com DV válido", () => {
    const corpo = CHAVE.slice(0, 20) + "55" + CHAVE.slice(22, 43);
    const chave55 = corpo + calcDV(corpo);
    expect(decodeKey(chave55).ok).toBe(true);
    expect(chavePlausivel(chave55)).toBe(false);
  });

  it("rejeita UF desconhecida, ano fora do intervalo, mês inválido e tpEmis diferente de 1 e 9", () => {
    const refaz = (corpo: string) => corpo + calcDV(corpo);
    const c = CHAVE.slice(0, 43);
    expect(chavePlausivel(refaz("99" + c.slice(2)))).toBe(false); // UF 99
    expect(chavePlausivel(refaz(c.slice(0, 2) + "1811" + c.slice(6)))).toBe(false); // ano 2018
    expect(chavePlausivel(refaz(c.slice(0, 2) + "4111" + c.slice(6)))).toBe(false); // ano 2041
    expect(chavePlausivel(refaz(c.slice(0, 2) + "2613" + c.slice(6)))).toBe(false); // mês 13
    expect(chavePlausivel(refaz(c.slice(0, 2) + "2600" + c.slice(6)))).toBe(false); // mês 0
    expect(chavePlausivel(refaz(c.slice(0, 34) + "5" + c.slice(35)))).toBe(false); // tpEmis 5
    expect(chavePlausivel(refaz(c.slice(0, 34) + "9" + c.slice(35)))).toBe(true); // tpEmis 9 (offline)
  });

  it("rejeita CNPJ inválido mesmo com DV da chave válido", () => {
    const c = CHAVE.slice(0, 6) + "08868231000639" + CHAVE.slice(20, 43);
    const chave = c + calcDV(c);
    expect(decodeKey(chave).ok).toBe(true);
    expect(chavePlausivel(chave)).toBe(false);
  });
});

describe("chaveDoOCR", () => {
  it("perfeito, em duas linhas, com ruído em volta", () => {
    const txt = `Consulte pela Chave de Acesso em\nhttp://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe\nChave de acesso:\n2626 1108 8682 3100 0638 6500\n2000 0689 0310 2077 8720\nConsumidor não identificado`;
    expect(chaveDoOCR(txt)).toEqual({ exata: CHAVE });
  });

  it("com o protocolo logo antes (números extras)", () => {
    const txt = `Protocolo de Autorização: 226261025408429 04/11/2026\nChave de acesso:\n${IMP}`;
    expect(chaveDoOCR(txt)).toEqual({ exata: CHAVE });
  });

  it("uma troca (8 virou 3): reparo acha a chave certa como candidata, nunca como exata", () => {
    const r = chaveDoOCR(`Chave de acesso:\n${IMP.replace("8682", "3682")}`);
    expect("exata" in r).toBe(false);
    expect(r).toMatchObject({ candidatas: [{ chave: CHAVE, trocas: 1 }] });
  });

  it("duas trocas: nunca devolve exata; ou acha entre poucas ou pede nova foto", () => {
    const ruim = IMP.replace("8682", "3682").replace("0689", "0688");
    for (const conhecidos of [[], ["08868231000638"]]) {
      const r = chaveDoOCR(ruim, conhecidos);
      expect("exata" in r).toBe(false);
      if ("candidatas" in r) {
        expect(r.candidatas.length).toBeLessThanOrEqual(3);
        expect(r.candidatas.some((c) => c.chave === CHAVE)).toBe(true);
      } else {
        expect("vazio" in r).toBe(true);
      }
    }
  });

  it("um dígito a mais", () => {
    const r = chaveDoOCR(IMP.replace("0689", "06189"));
    const achou = "exata" in r ? r.exata === CHAVE : "candidatas" in r && r.candidatas.some((c) => c.chave === CHAVE);
    expect(achou).toBe(true);
  });

  it("um dígito a menos: acha entre poucas ou pede nova foto, nunca chuta", () => {
    const r = chaveDoOCR(IMP.replace("0689", "068"));
    expect("exata" in r).toBe(false);
    if ("candidatas" in r) expect(r.candidatas.some((c) => c.chave === CHAVE)).toBe(true);
    else expect("vazio" in r).toBe(true);
  });

  it("texto sem chave devolve vazio", () => expect(chaveDoOCR("CUPOM\nTOTAL 12,50\nOBRIGADO")).toEqual({ vazio: true }));

  it("texto vazio devolve vazio", () => expect(chaveDoOCR("")).toEqual({ vazio: true }));

  it("CNPJ conhecido desempata candidatas", () => {
    const r = chaveDoOCR(IMP.replace("8682", "3682"), ["08868231000638"]);
    expect("candidatas" in r && r.candidatas[0].chave).toBe(CHAVE);
  });

  it("chave junto com outros números (bloco maior que 45) é achada", () => {
    const r = chaveDoOCR(`1234567890\n${IMP.replace("8682", "3682")}\n99999999`);
    // blocos consecutivos com >= 8 dígitos se juntam: precisa devolver a chave só como candidata ou vazio
    expect("exata" in r).toBe(false);
  });
});

describe("leituraAproximada", () => {
  it("devolve a linha de dígitos mais próxima de 44", () => {
    const t = "Consulte pela chave\n2626 1141 4923 3900 0163 8506 5000 1238 5490 9136 4469\nNFC-e 123854 5 05112026 092209";
    expect(leituraAproximada(t)).toBe("2626 1141 4923 3900 0163 8506 5000 1238 5490 9136 4469");
  });
  it("com duas linhas candidatas, escolhe a mais próxima de 44", () => {
    const a = "1".repeat(40);
    const b = "2".repeat(43);
    expect(leituraAproximada(`${a}\n${b}`)).toBe(b);
  });
  it("ignora linhas curtas demais, longas demais ou sem dígitos", () => {
    expect(leituraAproximada("")).toBeNull();
    expect(leituraAproximada("texto sem números")).toBeNull();
    expect(leituraAproximada("1".repeat(35))).toBeNull();
    expect(leituraAproximada("1".repeat(53))).toBeNull();
    expect(leituraAproximada("1".repeat(36))).toBe("1".repeat(36));
    expect(leituraAproximada("1".repeat(52))).toBe("1".repeat(52));
  });
  it("preserva os grupos como o OCR leu (grupo com ≠ 4 dígitos mostra o erro) e descarta letras", () => {
    expect(leituraAproximada("1626 1141 44983 3906 0161 b50 00 1238 5496 3136 4469")).toBe("1626 1141 44983 3906 0161 50 00 1238 5496 3136 4469");
  });
});

describe("correcoesDeUmDigito", () => {
  const VALIDA = "26261108868231000638650020000689031020778720"; // nota real (fixture Cia Santos)
  // erro de digitação típico: o último dígito (0) digitado como 8, confusão que a tabela de OCR conhece
  const DIGITADA = VALIDA.slice(0, 43) + "8";

  it("sugere trocas de 1 dígito que tornam a chave válida, com a posição, e inclui a correta", () => {
    const r = correcoesDeUmDigito(DIGITADA);
    expect(r.length).toBeGreaterThan(0);
    for (const c of r) {
      expect(chavePlausivel(c.chave)).toBe(true);
      expect(c.chave[c.posicao - 1]).toBe(c.para);
      expect(DIGITADA[c.posicao - 1]).toBe(c.de);
    }
    expect(r).toContainEqual({ chave: VALIDA, posicao: 44, de: "8", para: "0" });
  });
  it("chave já válida, tamanho errado ou lixo não geram sugestões", () => {
    expect(correcoesDeUmDigito(VALIDA)).toEqual([]);
    expect(correcoesDeUmDigito("123")).toEqual([]);
    expect(correcoesDeUmDigito("")).toEqual([]);
  });
  it("chave impressa inválida de fábrica (nota em contingência, recusada pela SEFAZ) não é 'corrigida' sozinha", () => {
    // a SEFAZ também responde "dígito verificador da chave inválido" para esta chave
    const impressa = "26261141499339000161650050001238549091364469";
    expect(chavePlausivel(impressa)).toBe(false);
  });
});
