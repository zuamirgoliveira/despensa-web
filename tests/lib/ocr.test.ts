import { describe, expect, it, vi } from "vitest";
import { lerChaveDaFoto, type DependenciasOCR, type WorkerOCR } from "@/lib/ocr";

const CHAVE = "26261108868231000638650020000689031020778720";
const IMP = "2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720";
const canvas = {} as HTMLCanvasElement;

function montar(textos: (string | Error)[]) {
  const terminate = vi.fn(async () => undefined);
  const recognize = vi.fn(async () => {
    const t = textos.shift() ?? "";
    if (t instanceof Error) throw t;
    return { data: { text: t } };
  });
  const setParameters = vi.fn(async () => undefined);
  const worker: WorkerOCR = { setParameters, recognize, terminate };
  const preparar = vi.fn<DependenciasOCR["preparar"]>((c) => c);
  const deps: DependenciasOCR = { criarWorker: async () => worker, preparar };
  return { deps, terminate, recognize, setParameters, preparar };
}

describe("lerChaveDaFoto", () => {
  it("configura whitelist de dígitos e PSM 6", async () => {
    const m = montar([IMP]);
    await lerChaveDaFoto(canvas, {}, m.deps);
    expect(m.setParameters).toHaveBeenCalledWith(
      expect.objectContaining({ tessedit_char_whitelist: "0123456789 ", tessedit_pageseg_mode: "6" }),
    );
  });

  it("para na primeira chave exata e encerra o worker", async () => {
    const m = montar([`Chave:\n${IMP}`, "não deve ser lido"]);
    expect(await lerChaveDaFoto(canvas, {}, m.deps)).toEqual({ exata: CHAVE });
    expect(m.recognize).toHaveBeenCalledTimes(1);
    expect(m.terminate).toHaveBeenCalledTimes(1);
  });

  it("tenta as 3 pré-processamentos na ordem e devolve a melhor candidata", async () => {
    const m = montar(["nada", IMP.replace("8682", "3682"), "nada"]);
    const r = await lerChaveDaFoto(canvas, {}, m.deps);
    expect(r).toMatchObject({ candidatas: [{ chave: CHAVE, trocas: 1 }] });
    expect(m.recognize).toHaveBeenCalledTimes(3);
    expect(m.preparar.mock.calls.map((c) => c[1])).toEqual([
      { larguraAlvo: 1800, binarizar: false },
      { larguraAlvo: 1800, binarizar: true },
      { larguraAlvo: 2600, binarizar: false },
    ]);
    expect(m.terminate).toHaveBeenCalledTimes(1);
  });

  it("uma exata em tentativa posterior vence candidatas anteriores", async () => {
    const m = montar([IMP.replace("8682", "3682"), IMP]);
    expect(await lerChaveDaFoto(canvas, {}, m.deps)).toEqual({ exata: CHAVE });
  });

  it("nunca devolve exata para chave inválida", async () => {
    const m = montar([IMP.replace("8720", "8721"), IMP.replace("8720", "8721"), IMP.replace("8720", "8721")]);
    const r = await lerChaveDaFoto(canvas, {}, m.deps);
    expect("exata" in r).toBe(false);
  });

  it("sem nada legível devolve vazio", async () => {
    const m = montar(["", "CUPOM 12,50", ""]);
    expect(await lerChaveDaFoto(canvas, {}, m.deps)).toEqual({ vazio: true });
  });

  it("sem chave certa devolve a leitura aproximada (nunca como chave)", async () => {
    // leitura real de uma nota de impressão pontilhada: 42 dígitos, com erros
    const ruim = "CONSULTE\n1626 1141 44983 3906 0161 050 00 1238 5496 3136 4469\n123854 5 85112026";
    const m = montar([ruim, "", ruim]);
    const r = await lerChaveDaFoto(canvas, {}, m.deps);
    expect(r).toEqual({ vazio: true, aproximada: "1626 1141 44983 3906 0161 050 00 1238 5496 3136 4469" });
    expect("exata" in r).toBe(false);
  });

  it("encerra o worker mesmo quando o reconhecimento falha", async () => {
    const m = montar([new Error("falhou")]);
    await expect(lerChaveDaFoto(canvas, {}, m.deps)).rejects.toThrow("falhou");
    expect(m.terminate).toHaveBeenCalledTimes(1);
  });

  it("usa os CNPJs conhecidos para desempatar", async () => {
    const m = montar([IMP.replace("8682", "3682")]);
    const r = await lerChaveDaFoto(canvas, { cnpjsConhecidos: ["08868231000638"] }, m.deps);
    expect("candidatas" in r && r.candidatas[0].chave).toBe(CHAVE);
  });
});
