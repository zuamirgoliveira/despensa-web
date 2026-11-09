// Proxy mínimo da consulta pública da NFC-e pelo QR Code (decisão registrada no AGENTS.md, seção 5.5).
// O navegador não consegue ler essa resposta (a SEFAZ não envia CORS). Aqui só repassamos a consulta que o
// próprio QR do cupom já autoriza (a URL traz a assinatura do emitente): sem captcha para contornar.
// Não guarda nada, não registra a URL e devolve só itens e valores (nunca o CPF).
import { decodeKey } from "@/domain/nfce/chave";
import { consultaDoQR } from "@/domain/nfce/sefaz";
import { parseNotaXml } from "@/domain/nfce/xml";

export const dynamic = "force-dynamic";

const TEMPO_MS = 10_000;
const MAX_BYTES = 1_000_000;
const LIMITE_POR_MINUTO = 20;
const acessos = new Map<string, number[]>();

function limitado(ip: string, agora: number): boolean {
  const recentes = (acessos.get(ip) ?? []).filter((t) => agora - t < 60_000);
  recentes.push(agora);
  acessos.set(ip, recentes);
  if (acessos.size > 1000) for (const [k, v] of acessos) if (!v.some((t) => agora - t < 60_000)) acessos.delete(k);
  return recentes.length > LIMITE_POR_MINUTO;
}

const erro = (status: number, codigo: string): Response => Response.json({ erro: codigo }, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request): Promise<Response> {
  // só o próprio app: exige a mesma origem
  const origem = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origem || !host || new URL(origem).host !== host) return erro(403, "origem");

  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (limitado(ip, Date.now())) return erro(429, "muitas_consultas");

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return erro(400, "corpo");
  }
  const consulta = consultaDoQR((corpo as { url?: unknown } | null)?.url);
  if (!consulta) return erro(400, "url_invalida");
  const k = decodeKey(consulta.chave);
  if (!k.ok || !k.ehNFCe || k.uf !== "PE") return erro(400, "chave_invalida");

  try {
    const r = await fetch(consulta.url, {
      redirect: "error",
      signal: AbortSignal.timeout(TEMPO_MS),
      cache: "no-store",
      headers: { accept: "text/xml,application/xml" },
    });
    if (!r.ok) return erro(502, "sefaz_indisponivel");
    const xml = await r.text();
    if (xml.length > MAX_BYTES) return erro(502, "resposta_grande");
    const resultado = parseNotaXml(xml);
    if (!resultado.nota.itens.length) return erro(404, "nota_nao_encontrada");
    return Response.json(resultado, { headers: { "cache-control": "no-store" } });
  } catch {
    return erro(504, "sefaz_demorou");
  }
}
