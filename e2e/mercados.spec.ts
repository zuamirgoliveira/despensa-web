import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole, pularEstimativa } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

async function importarNota(page: Page) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
}

test("sem notas, Mercados orienta a importar", async ({ page }) => {
  await page.goto("/mercados");
  await expect(page.getByText("Nenhum mercado ainda")).toBeVisible();
});

test("importar a nota cria o mercado; distância, transporte, custo fixo e custo da ida", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await importarNota(page);
  await page.goto("/mercados");
  await expect(page.getByRole("heading", { name: /CIA SANTOS/ })).toBeVisible();
  await expect(page.getByLabel("Tipo")).toHaveValue("hortifruti"); // sugerido pelo nome
  await expect(page.getByLabel("Como você vai")).toHaveValue("carro");
  await expect(page.getByLabel(/^Custo da ida a/)).toHaveText("Custo da ida: informe a distância.");
  await expect(page.getByLabel("Idas do mês")).toContainText("1 ida ao mercado");
  await expect(page.getByLabel("Idas do mês")).toContainText("sem tempo estimado");

  // carro: 4,2 km de ida → 8,4 km × R$ 0,90 = R$ 7,56
  await page.getByLabel("Distância de ida (km)").fill("4,2");
  await page.getByLabel("Tempo de ida (min)").fill("12");
  await expect(page.getByLabel(/^Custo da ida a/)).toHaveText("Custo da ida e volta: R$ 7,56");
  // com estacionamento de R$ 5,00
  await page.getByLabel(/Custo fixo da ida/).fill("5,00");
  await expect(page.getByLabel(/^Custo da ida a/)).toHaveText("Custo da ida e volta: R$ 12,56");
  // bike elétrica: 8,4 km × R$ 0,05 = R$ 0,42 (sem custo fixo)
  await page.getByLabel("Como você vai").selectOption("bike_eletrica");
  await expect(page.getByLabel(/^Custo da ida a/)).toHaveText("Custo da ida e volta: R$ 0,42");
  await page.getByLabel("Apelido").fill("Cia Santos Olinda");
  await page.getByRole("button", { name: "Salvar mercado" }).click();
  await expect(page.getByText("Mercado salvo.")).toBeVisible();

  // persistiu; o apelido vira o título e o resumo do mês usa o tempo (12 × 2 = 24 min)
  await page.reload();
  await expect(page.getByRole("heading", { name: "Cia Santos Olinda" })).toBeVisible();
  await expect(page.getByLabel("Como você vai")).toHaveValue("bike_eletrica");
  await expect(page.getByLabel("Distância de ida (km)")).toHaveValue("4,2");
  await expect(page.getByLabel("Idas do mês")).toContainText("24 min de deslocamento");
  await expect(page.getByLabel("Idas do mês")).not.toContainText("sem tempo estimado");
  semViolacaoDeCsp(erros);
});

test("números inválidos não salvam", async ({ page }) => {
  await importarNota(page);
  await page.goto("/mercados");
  await page.getByLabel("Distância de ida (km)").fill("abc");
  await page.getByRole("button", { name: "Salvar mercado" }).click();
  await expect(page.getByText(/Informe números válidos/)).toBeVisible();
});

test.describe("localização da casa", () => {
  test("Estou em casa agora: captura uma vez e arredonda a 3 casas; sem arredondar guarda o valor cheio", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: -8.063149, longitude: -34.871139 });
    await page.goto("/ajustes");
    await expect(page.getByLabel("Localização atual")).toHaveText("Ainda não definida.");
    await page.getByRole("button", { name: "Estou em casa agora" }).click();
    await expect(page.getByLabel("Localização atual")).toHaveText("Definida: -8.063, -34.871");

    await expect(page.getByRole("button", { name: "Estou em casa agora" })).toBeHidden(); // o card fechou sozinho
    await page.getByRole("button", { name: "Alterar", exact: true }).click();
    await page.getByLabel(/Arredondar a posição/).click(); // grava no banco e só depois reflete na tela
    await expect(page.getByLabel(/Arredondar a posição/)).not.toBeChecked();
    await page.getByRole("button", { name: "Estou em casa agora" }).click();
    await expect(page.getByLabel("Localização atual")).toHaveText("Definida: -8.0631, -34.8711");

    await page.reload();
    await expect(page.getByLabel("Localização atual")).toHaveText("Definida: -8.0631, -34.8711");
    await page.getByRole("button", { name: "Remover", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remover", exact: true }).click();
    await expect(page.getByLabel("Localização atual")).toHaveText("Ainda não definida.");
  });

  test("permissão negada mostra a alternativa manual", async ({ page }) => {
    await page.goto("/ajustes");
    await page.getByRole("button", { name: "Estou em casa agora" }).click();
    await expect(page.getByText(/Sem permissão de localização\. Digite ou cole as coordenadas abaixo\./)).toBeVisible();
    await page.getByLabel("Ou digite/cole as coordenadas").fill("-8.0631, -34.8711");
    await page.getByRole("button", { name: "Salvar coordenadas" }).click();
    await expect(page.getByLabel("Localização atual")).toHaveText("Definida: -8.063, -34.871");
  });

  test("coordenadas inválidas são recusadas", async ({ page }) => {
    await page.goto("/ajustes");
    await page.getByLabel("Ou digite/cole as coordenadas").fill("91, 0");
    await page.getByRole("button", { name: "Salvar coordenadas" }).click();
    await expect(page.getByText(/Coordenadas inválidas/)).toBeVisible();
    await expect(page.getByLabel("Localização atual")).toHaveText("Ainda não definida.");
  });
});
