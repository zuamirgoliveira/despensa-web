import { readFileSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import { pularEstimativa, semViolacaoDeCsp, vigiarConsole } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");
const OUTRA_NOTA = NOTA.replace("Número: 68903", "Número: 68904")
  .replace("04/11/2026 10:33:31", "11/11/2026 10:33:31")
  .replace("2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720", "2626 1108 8682 3100 0638 6500 2000 0689 0410 2077 8728");
const CORS = { "access-control-allow-origin": "*" };

type Pedido = { origem: "nominatim" | "rotas"; url: URL };

/** Serviço de mapas SIMULADO: os testes nunca chamam o serviço real. */
async function simularMapas(page: Page, opcoes: { achaBairro?: boolean; status?: number } = {}): Promise<Pedido[]> {
  const pedidos: Pedido[] = [];
  const responder = (route: Route, corpo: unknown) =>
    opcoes.status && opcoes.status !== 200
      ? route.fulfill({ status: opcoes.status, headers: CORS, body: "erro" })
      : route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify(corpo) });
  await page.route("https://nominatim.openstreetmap.org/**", (route) => {
    const url = new URL(route.request().url());
    pedidos.push({ origem: "nominatim", url });
    const achou = opcoes.achaBairro !== false && url.searchParams.get("q") === "Casa Caiada, Olinda, PE, Brasil";
    return responder(route, achou ? [{ lat: "-7.9847", lon: "-34.8383", display_name: "Casa Caiada, Olinda" }] : []);
  });
  await page.route("https://routing.openstreetmap.de/**", (route) => {
    const url = new URL(route.request().url());
    pedidos.push({ origem: "rotas", url });
    const bike = url.pathname.includes("routed-bike");
    return responder(route, { code: "Ok", routes: [bike ? { distance: 12009.6, duration: 3031.4 } : { distance: 10703.3, duration: 721.2 }] });
  });
  return pedidos;
}

async function definirCasa(page: Page) {
  await page.goto("/ajustes");
  await page.getByLabel("Ou digite/cole as coordenadas").fill("-8.0631, -34.8711");
  await page.getByRole("button", { name: "Salvar coordenadas" }).click();
  await expect(page.getByLabel("Localização atual")).toHaveText("Definida: -8.063, -34.871");
}

async function lerESalvar(page: Page, texto: string) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(texto);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra|Substituir compra/ }).click();
}

test("estimativa automática: confirma de bike com um toque, grava o custo e só envia coordenadas e o endereço do mercado", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  const pedidos = await simularMapas(page);
  await definirCasa(page);
  await lerESalvar(page, NOTA);

  const cartao = page.getByLabel("Estimativa da ida");
  await expect(cartao).toContainText("10,7 km, cerca de 12 min", { timeout: 20_000 });
  await expect(cartao).toContainText("(aproximado: só achei o bairro)"); // o endereço da nota vem cortado
  await expect(cartao).toContainText("Como você foi?");

  await cartao.getByRole("button", { name: "De bike elétrica" }).click();
  // bike: 12 km de ida → 24 km × R$ 0,05 = R$ 1,20
  await expect(page.getByLabel("Custo da ida registrado")).toHaveText("Custo da ida e volta: R$ 1,20. Já está na compra.");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/compras$/);

  // custo da ida e custo real aparecem na compra (RN-10)
  await page.getByText(/CIA SANTOS/).click();
  await expect(page.getByLabel(/^Custo real da compra de/)).toHaveText("Custo da ida R$ 1,20 · custo real R$ 78,44");
  await page.goto("/mercados");
  await expect(page.getByLabel("Como você vai")).toHaveValue("bike_eletrica");
  await expect(page.getByLabel("Distância de ida (km)")).toHaveValue("12");
  await expect(page.getByLabel("Tempo de ida (min)")).toHaveValue("51");

  // privacidade: ao geocodificador vai só o endereço do mercado; às rotas, só coordenadas
  const geo = pedidos.filter((p) => p.origem === "nominatim");
  expect(geo.length).toBeGreaterThan(1); // tentou variantes até achar o bairro
  for (const p of geo) {
    expect([...p.url.searchParams.keys()].sort()).toEqual(["countrycodes", "format", "limit", "q"]);
    expect(p.url.searchParams.get("q")).toMatch(/Olinda/);
    expect(p.url.search).not.toMatch(/68903|0638|CPF/i);
  }
  for (const p of pedidos.filter((x) => x.origem === "rotas")) {
    expect(p.url.pathname).toMatch(/^\/routed-(car|bike)\/route\/v1\/driving\/-?\d+\.\d+,-?\d+\.\d+;-?\d+\.\d+,-?\d+\.\d+$/);
  }
  semViolacaoDeCsp(erros);
});

test("mercado conhecido: a nota seguinte pergunta só o meio (sem chamar o serviço) e calcula o custo por ele", async ({ page }) => {
  const pedidos = await simularMapas(page);
  await definirCasa(page);
  await lerESalvar(page, NOTA);
  await page.getByLabel("Estimativa da ida").getByRole("button", { name: "De carro" }).click({ timeout: 20_000 });
  await expect(page.getByLabel("Custo da ida registrado")).toHaveText("Custo da ida e volta: R$ 19,26. Já está na compra."); // 10,7 × 2 × R$ 0,90
  await page.getByRole("button", { name: "Continuar" }).click();
  const antes = pedidos.length;

  await lerESalvar(page, OUTRA_NOTA);
  // a distância já é conhecida: pergunta só como foi desta vez, sem consultar o serviço
  const cartao = page.getByLabel("Estimativa da ida");
  await expect(cartao).toContainText("Como você foi desta vez?");
  await expect(cartao).toContainText("Última vez: Carro");
  await cartao.getByRole("button", { name: "A pé" }).click();
  await expect(page.getByLabel("Custo da ida registrado")).toHaveText("Custo da ida e volta: R$ 0,00. Já está na compra.");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/compras$/);
  expect(pedidos.length).toBe(antes);
  await page.getByText("11/11/2026").first().click();
  await expect(page.getByLabel(/^Custo real da compra de 11\/11\/2026/)).toContainText("Custo da ida R$ 0,00");
});

test("endereço não encontrado: pede km e minutos uma vez, à mão", async ({ page }) => {
  await simularMapas(page, { achaBairro: false });
  await definirCasa(page);
  await lerESalvar(page, NOTA);
  await expect(page.getByText(/Não achei o endereço da nota no mapa/)).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Distância de ida (km)").fill("4,2");
  await page.getByLabel("Tempo de ida (min)").fill("12");
  await page.getByRole("button", { name: "Guardar distância" }).click();
  await expect(page.getByLabel("Custo da ida registrado")).toHaveText("Custo da ida e volta: R$ 7,56. Já está na compra.");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/compras$/);
});

test("serviço fora do ar (HTTP 500): não bloqueia; permite informar à mão ou decidir depois", async ({ page }) => {
  await simularMapas(page, { status: 500 });
  await definirCasa(page);
  await lerESalvar(page, NOTA);
  await expect(page.getByText(/O serviço de mapas não respondeu/)).toBeVisible({ timeout: 20_000 });
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
  await expect(page.getByText(/CIA SANTOS/)).toBeVisible(); // a nota foi salva mesmo assim
});

test("sem casa cadastrada: orienta a ir em Ajustes e não chama o serviço", async ({ page }) => {
  const pedidos = await simularMapas(page);
  await lerESalvar(page, NOTA);
  await expect(page.getByText(/Cadastre a localização da casa em Ajustes/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para Ajustes" })).toBeVisible();
  expect(pedidos).toEqual([]);
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
});

test("sem internet: a estimativa fica pendente e a importação funciona", async ({ page, context }) => {
  const pedidos = await simularMapas(page);
  await definirCasa(page);
  await page.goto("/importar");
  await context.setOffline(true);
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra/ }).click();
  await expect(page.getByText(/Sem internet agora, então a estimativa automática fica pendente/)).toBeVisible();
  expect(pedidos).toEqual([]);
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
});

test("Mercados: 'Estimar pelo endereço' preenche km e minutos para conferir e salvar", async ({ page }) => {
  await simularMapas(page);
  await definirCasa(page);
  await lerESalvar(page, NOTA);
  await pularEstimativa(page);
  await page.goto("/mercados");
  await page.getByRole("button", { name: "Estimar pelo endereço" }).click();
  await expect(page.getByText(/Estimativa preenchida \(aproximada: só achei o bairro\)/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Distância de ida (km)")).toHaveValue("10,7");
  await expect(page.getByLabel("Tempo de ida (min)")).toHaveValue("12");
  await expect(page.getByLabel(/^Custo da ida a/)).toHaveText("Custo da ida e volta: R$ 19,26");
});
