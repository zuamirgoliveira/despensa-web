import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole, pularEstimativa } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

async function importarNota(page: Page) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra|Substituir compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
}

const item = (page: Page, nome: string) => page.getByRole("listitem").filter({ hasText: nome }).first();

test("sem dados, a lista fica vazia e oferece conferir a despensa", async ({ page }) => {
  await page.goto("/lista?ida=mercado_semanal");
  await expect(page.getByText("Nenhum item na lista")).toBeVisible();
  await expect(page.getByRole("link", { name: "Conferir despensa" })).toHaveAttribute("href", "/conferencia?ida=mercado_semanal");
});

test("lista gerada do catálogo: itens, estimativa, edição, remoção, avulso e regerar preservam as edições", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await importarNota(page);
  await page.goto("/lista?ida=hortifruti_semanal");

  await expect(page.getByRole("heading", { name: "Hortifruti", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  await expect(page.getByLabel("Estimativa de custo")).not.toHaveText("R$ 0,00");
  await expect(page.getByRole("link", { name: "Iniciar compra" })).toHaveAttribute("href", /^\/compra\?lista=[0-9a-f-]{36}$/);

  // editar quantidade (+) e persistir ao recarregar
  const melao = item(page, "Melao Japones");
  const antes = await melao.locator("[aria-live=polite]").textContent();
  await melao.getByRole("button", { name: "Aumentar Melao Japones" }).click();
  await expect(melao.locator("[aria-live=polite]")).not.toHaveText(antes ?? "");
  const editada = await melao.locator("[aria-live=polite]").textContent();
  await page.reload();
  await expect(item(page, "Melao Japones").locator("[aria-live=polite]")).toHaveText(editada ?? "");

  // remover; aparece em "Removidos" e não volta ao regerar
  await item(page, "Banana Prata").getByRole("button", { name: "Remover Banana Prata" }).click();
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(15);
  await expect(page.getByText("Removidos (1)")).toBeVisible();
  await page.getByRole("button", { name: "Regerar lista" }).click();
  await expect(page.getByText("Lista atualizada. Suas edições foram mantidas.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(15);
  await expect(item(page, "Melao Japones").locator("[aria-live=polite]")).toHaveText(editada ?? ""); // edição mantida

  // avulso
  await page.getByLabel("Nome do item").fill("Pilha AA");
  await page.getByLabel("Quantidade", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Avulsos" })).toBeVisible();
  await expect(item(page, "Pilha AA")).toContainText("2");
  await expect(page.getByText("Sem preço (1)")).toBeVisible();

  // restaurar
  await page.getByText("Removidos (1)").click();
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(17); // 16 + avulso

  // trocar de tipo de ida: os produtos são de hortifruti, então o mercado semanal fica vazio
  await page.getByRole("button", { name: /Mercado semanal/ }).click();
  await expect(page.getByText("Nenhum item na lista")).toBeVisible();
  semViolacaoDeCsp(erros);
});

test("quantidade nunca fica negativa", async ({ page }) => {
  await importarNota(page);
  await page.goto("/lista?ida=hortifruti_semanal");
  const quase = item(page, "Coentro"); // unidade: passo 1
  for (let i = 0; i < 4; i++) {
    const menos = quase.getByRole("button", { name: "Diminuir Coentro" });
    if (await menos.isEnabled()) await menos.click();
  }
  await expect(quase.getByRole("button", { name: "Diminuir Coentro" })).toBeDisabled();
  await expect(quase.locator("[aria-live=polite]")).toHaveText(/^0 /);
});
