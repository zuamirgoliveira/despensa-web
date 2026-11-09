import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/nfce/route";

const XML = readFileSync(new URL("../fixtures/xml/nfce-sintetica.xml", import.meta.url), "utf8");
const URL_QR =
  "https://nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe?p=26261120300157005613651290000538591088539888|2|1|1|A889BEB8C3F7BD9C6FBCD31ABE7502218F4123B1";
let n = 0;

const pedido = (corpo: unknown, cab: Record<string, string> = { origin: "https://app.exemplo.com", host: "app.exemplo.com" }) =>
  new Request("https://app.exemplo.com/api/nfce", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": `10.0.0.${++n}`, ...cab },
    body: JSON.stringify(corpo),
  });

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/nfce", () => {
  it("busca a nota, devolve itens e valores e nunca o CPF", async () => {
    const f = vi.fn(async () => new Response(XML));
    vi.stubGlobal("fetch", f);
    const r = await POST(pedido({ url: URL_QR }));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.nota.itens).toHaveLength(2);
    expect(JSON.stringify(corpo)).not.toContain("00000000000");
    expect(f).toHaveBeenCalledWith(URL_QR, expect.objectContaining({ redirect: "error" }));
  });

  it("recusa outra origem, URL fora da SEFAZ-PE e corpo inválido, sem chamar a rede", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect((await POST(pedido({ url: URL_QR }, { origin: "https://evil.com", host: "app.exemplo.com" }))).status).toBe(403);
    expect((await POST(pedido({ url: URL_QR }, { host: "app.exemplo.com" }))).status).toBe(403);
    expect((await POST(pedido({ url: "https://evil.com/x?p=1" }))).status).toBe(400);
    expect((await POST(pedido({}))).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("SEFAZ fora do ar ou lenta vira erro claro, sem vazar detalhes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x", { status: 500 })),
    );
    expect((await POST(pedido({ url: URL_QR }))).status).toBe(502);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("timeout"))),
    );
    const r = await POST(pedido({ url: URL_QR }));
    expect(r.status).toBe(504);
    expect(await r.json()).toEqual({ erro: "sefaz_demorou" });
  });

  it("limita consultas por minuto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(XML)),
    );
    const cab = { origin: "https://app.exemplo.com", host: "app.exemplo.com", "cf-connecting-ip": "9.9.9.9" };
    const mk = () =>
      new Request("https://app.exemplo.com/api/nfce", {
        method: "POST",
        headers: { ...cab, "content-type": "application/json" },
        body: JSON.stringify({ url: URL_QR }),
      });
    const status: number[] = [];
    for (let i = 0; i < 22; i++) status.push((await POST(mk())).status);
    expect(status.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(status[21]).toBe(429);
  });
});
