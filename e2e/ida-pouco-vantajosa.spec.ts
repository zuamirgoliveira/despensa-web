import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { pularEstimativa, prepararDespensa } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

async function salvar(page: Page, texto: string) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(texto);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: "Salvar compra" }).click();
  await pularEstimativa(page);
  await prepararDespensa(page);
}

async function distancia(page: Page, nome: RegExp, km: string, meio: string) {
  await page.goto("/mercados");
  const cartao = page.getByRole("heading", { name: nome }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await cartao.getByLabel("Como você vai").selectOption(meio);
  await cartao.getByLabel("Distância de ida (km)").fill(km);
  await cartao.getByRole("button", { name: "Salvar mercado" }).click();
  await expect(page.getByText("Mercado salvo.").first()).toBeVisible();
}

test("aviso de ida pouco vantajosa: poucos itens e ida cara", async ({ page }) => {
  await salvar(page, NOTA);
  await distancia(page, /CIA SANTOS/, "20", "carro"); // R$ 36,00 de ida
  await page.goto("/lista");
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  for (let i = 0; i < 12; i++) await page.getByRole("button", { name: /^Remover / }).first().click(); // sobram 4 itens
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(4);
  await expect(page.getByText(/Esta ida tem 4 itens, R\$ \d+,\d{2}, e custa R\$ 36,00 para ir e voltar\. Vale esperar e juntar com outra compra\?/)).toBeVisible();
});

test("a lista é uma só: não há botão para outras listas nem divisão entre mercados", async ({ page }) => {
  await salvar(page, NOTA);
  await page.goto("/lista");
  await expect(page.getByRole("button", { name: /Ver a lista de/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dividir lista" })).toHaveCount(0);
});
