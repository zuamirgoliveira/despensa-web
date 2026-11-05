// Spike de mapas (C-17). Só para uso manual: NÃO roda em teste nem em CI (testes usam serviço simulado).
// Uso:
//   node scripts/spike-mapas/spike.mjs geocodificar            # endereços das notas em tests/fixtures/notas
//   node scripts/spike-mapas/spike.mjs geocodificar "RUA X , 10 , CENTRO , RECIFE , PE"
//   node scripts/spike-mapas/spike.mjs rota LAT_ORIGEM LNG_ORIGEM LAT_DESTINO LNG_DESTINO
// Envia ao serviço só o endereço do mercado (que vem da nota) e coordenadas. Nunca o endereço de casa.
// Respeita a política do Nominatim: 1 consulta por segundo e User-Agent identificando o uso.
import { readdirSync, readFileSync } from "node:fs";
import { variantesDeEndereco } from "../../src/lib/endereco.ts";

const UA = "despensa-web-spike/0.1 (teste manual de geocodificacao)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = { carro: "https://routing.openstreetmap.de/routed-car", bike: "https://routing.openstreetmap.de/routed-bike" };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocodificar(consulta) {
  const url = `${NOMINATIM}?${new URLSearchParams({ q: consulta, format: "jsonv2", limit: "1", countrycodes: "br" })}`;
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const [achado] = await r.json();
  return achado ? { lat: Number(achado.lat), lng: Number(achado.lon), nome: achado.display_name } : null;
}

async function rota(meio, de, para) {
  const c = `${de.lng},${de.lat};${para.lng},${para.lat}`;
  const r = await fetch(`${OSRM[meio]}/route/v1/driving/${c}?overview=false`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j.code !== "Ok") throw new Error(j.code);
  return { km: j.routes[0].distance / 1000, min: j.routes[0].duration / 60 };
}

function enderecosDasNotas() {
  const dir = new URL("../../tests/fixtures/notas/", import.meta.url);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => {
      const linhas = readFileSync(new URL(f, dir), "utf8").split("\n").map((l) => l.trim());
      const i = linhas.findIndex((l) => /^CNPJ:/i.test(l));
      return { origem: f, bruto: i >= 0 ? linhas[i + 1] : "" };
    })
    .filter((e) => e.bruto);
}

const [, , cmd, ...args] = process.argv;
if (cmd === "geocodificar") {
  const lista = args.length ? args.map((a) => ({ origem: "argumento", bruto: a })) : enderecosDasNotas();
  for (const { origem, bruto } of lista) {
    console.log(`\n# ${origem}\nbruto: ${bruto}`);
    await esperar(1100);
    const sem = await geocodificar(bruto.replace(/\s+,/g, ",")).catch((e) => `erro ${e.message}`);
    console.log(`  sem normalizar -> ${typeof sem === "string" ? sem : sem ? `${sem.lat}, ${sem.lng}` : "nenhum resultado"}`);
    for (const v of variantesDeEndereco(bruto)) {
      await esperar(1100);
      const r = await geocodificar(v.consulta).catch((e) => `erro ${e.message}`);
      console.log(`  [${v.precisao}] ${v.consulta} -> ${typeof r === "string" ? r : r ? `${r.lat}, ${r.lng} (${r.nome.slice(0, 60)})` : "nenhum resultado"}`);
    }
  }
} else if (cmd === "rota") {
  const [a, b, c, d] = args.map(Number);
  const de = { lat: a, lng: b };
  const para = { lat: c, lng: d };
  const carro = await rota("carro", de, para);
  const bike = await rota("bike", de, para);
  console.log(`carro: ${carro.km.toFixed(1)} km, ${carro.min.toFixed(0)} min`);
  console.log(`bike : ${bike.km.toFixed(1)} km, ${bike.min.toFixed(0)} min (fator de distância sobre o carro: ${(bike.km / carro.km).toFixed(2)})`);
} else {
  console.error("Uso: geocodificar [endereco] | rota LAT LNG LAT LNG");
  process.exit(1);
}
