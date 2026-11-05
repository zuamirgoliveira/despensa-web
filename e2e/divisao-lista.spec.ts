import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { pularEstimativa, semViolacaoDeCsp, vigiarConsole } from "./util";

const NOTA_A = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");
const metade = (v: string): string => (Number(v.replace(",", ".")) / 2).toFixed(2).replace(".", ",");
/** Outro mercado (CNPJ válido 11.222.333/0001-81) com todos os preços pela metade. */
const NOTA_B = NOTA_A.replace("CIA SANTOS DISTRIBUIDORA E IMPORTADORA DE HORTIFRUTI LTDA", "SACOLAO DO B")
  .replace("CNPJ: 08.868.231/0006-38", "CNPJ: 11.222.333/0001-81")
  .replace("Número: 68903 Série: 2", "Número: 1 Série: 1")
  .replace("2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720", "2626 1111 2223 3300 0181 6500 1000 0000 0110 0000 0018")
  .replace(/Vl\. Unit\.: ([\d,]+)/g, (_m, v: string) => `Vl. Unit.: ${metade(v)}`);

async function salvar(page: Page, texto: string) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(texto);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: "Salvar compra" }).click();
  await pularEstimativa(page);
}

async function distancia(page: Page, nome: RegExp, km: string, meio: string) {
  await page.goto("/mercados");
  const cartao = page.getByRole("heading", { name: nome }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await cartao.getByLabel("Como você vai").selectOption(meio);
  await cartao.getByLabel("Distância de ida (km)").fill(km);
  await cartao.getByRole("button", { name: "Salvar mercado" }).click();
  await expect(page.getByText("Mercado salvo.").first()).toBeVisible();
}

async function prepararAmbosMercados(page: Page) {
  await salvar(page, NOTA_A);
  await salvar(page, NOTA_B);
  await distancia(page, /CIA SANTOS/, "3", "carro"); // habitual (o mais usado empata: o de menor id... definido na agenda abaixo)
}

async function habitual(page: Page, nome: string) {
  await page.goto("/ajustes");
  const cartao = page.getByRole("heading", { name: "Hortifruti semanal", exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await cartao.getByLabel("Mercado habitual").selectOption({ label: nome });
  await cartao.getByRole("button", { name: "Salvar agenda" }).click();
  await expect(page.getByText("Ajustes salvos.").first()).toBeVisible();
}

test("economia líquida positiva: propõe dividir e a divisão cria duas listas sem perder itens", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await prepararAmbosMercados(page);
  await distancia(page, /SACOLAO DO B/, "2", "bike_eletrica"); // ida extra quase de graça: R$ 0,20
  await habitual(page, "CIA SANTOS DISTRIBUIDORA E IMPORTADORA DE HORTIFRUTI LTDA");

  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  await expect(page.getByText(/Dividir a lista entre .* e SACOLAO DO B economiza R\$ \d+,\d{2} líquidos/)).toBeVisible();
  await page.getByRole("button", { name: "Dividir lista" }).click();
  await expect(page.getByText(/Lista dividida: 16 itens foram para SACOLAO DO B/)).toBeVisible();

  // a original ficou vazia; a outra tem os 16 itens; nenhum foi perdido
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(0);
  await page.getByRole("button", { name: /Ver a lista de SACOLAO DO B/ }).click();
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);

  // regerar a original não duplica os itens
  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(page.getByText("Nenhum item na lista")).toBeVisible();
  semViolacaoDeCsp(erros);
});

test("economia menor que a ida extra: não propõe dividir", async ({ page }) => {
  await prepararAmbosMercados(page);
  await distancia(page, /SACOLAO DO B/, "300", "carro"); // ida extra de R$ 540
  await habitual(page, "CIA SANTOS DISTRIBUIDORA E IMPORTADORA DE HORTIFRUTI LTDA");
  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  await expect(page.getByText(/Dividir a lista entre/)).toHaveCount(0);
});

test("aviso de ida pouco vantajosa: poucos itens e ida cara", async ({ page }) => {
  await salvar(page, NOTA_A);
  await distancia(page, /CIA SANTOS/, "20", "carro"); // R$ 36,00 de ida
  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  for (let i = 0; i < 12; i++) await page.getByRole("button", { name: /^Remover / }).first().click(); // sobram 4 itens
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(4);
  await expect(page.getByText(/Esta ida tem 4 itens, R\$ \d+,\d{2}, e custa R\$ 36,00 para ir e voltar\. Dá para esperar a feira mensal\?/)).toBeVisible();
});
