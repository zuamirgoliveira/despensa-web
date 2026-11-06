import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole, pularEstimativa, prepararDespensa } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

async function prepararLista(page: Page) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra|Substituir compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
  await prepararDespensa(page);
  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  await page.getByRole("link", { name: "Iniciar compra" }).click();
  await expect(page).toHaveURL(/\/compra\?lista=/);
  await expect(page.getByRole("heading", { name: "Modo compra" })).toBeVisible();
}

const linha = (page: Page, nome: string) => page.getByRole("listitem").filter({ hasText: nome }).first();

test("lista inexistente mostra aviso", async ({ page }) => {
  await page.goto("/compra?lista=nao-existe");
  await expect(page.getByText("Lista não encontrada")).toBeVisible();
  await page.goto("/compra");
  await expect(page.getByText("Lista não encontrada")).toBeVisible();
});

test("modo compra offline: marcar, preço, extra, não encontrei, orçamento e recarregar preservam o estado", async ({ page, context }) => {
  const { erros } = vigiarConsole(page);
  await prepararLista(page);
  await expect(page.getByText("0 de 16 itens")).toBeVisible();

  // garante o service worker no controle e vai para offline (a lista foi gerada online)
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.goto(page.url()); // recarrega já sob o SW para entrar no cache
  await expect(page.getByRole("heading", { name: "Modo compra" })).toBeVisible();
  await context.setOffline(true);

  // pegar + preço
  await linha(page, "Melao Japones").getByRole("button", { name: "Peguei", exact: true }).click();
  await expect(linha(page, "Melao Japones").getByRole("button", { name: /Peguei ✓/ })).toBeVisible();
  const preco = linha(page, "Melao Japones").getByLabel(/Preço unitário de Melao Japones/);
  await preco.fill("8,00");
  await preco.blur();
  await expect(page.getByLabel("Total corrente")).not.toContainText("R$ 0,00");

  // extra já entra como pego, com preço, e soma no total
  const totalAntes = await page.getByLabel("Total corrente").textContent();
  await page.getByLabel("Nome do extra").fill("Chiclete");
  await page.getByLabel("Quantidade do extra").fill("2");
  await page.getByLabel(/Preço unitário do extra/).fill("1,50");
  await page.getByRole("button", { name: "Adicionar extra" }).click();
  await expect(linha(page, "Chiclete").getByText("Extra", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Total corrente")).not.toHaveText(totalAntes ?? "");
  await expect(page.getByText("2 de 17 itens")).toBeVisible();

  // não encontrei e adiar
  await linha(page, "Banana Prata").getByRole("button", { name: "Não encontrei Banana Prata" }).click();
  await expect(linha(page, "Banana Prata").getByText(/Não encontrei: volta na próxima ida/)).toBeVisible();
  await linha(page, "Cenoura").getByRole("button", { name: "Adiar Cenoura" }).click();
  await expect(linha(page, "Cenoura").getByText("Adiado", { exact: true })).toBeVisible();

  // orçamento baixo: alerta ao passar
  const orc = page.getByLabel("Orçamento da compra (opcional)");
  await orc.fill("1,00");
  await orc.blur();
  await expect(page.getByText(/Passou do orçamento de R\$ 1,00/)).toBeVisible();

  // recarregar offline: tudo preservado
  await page.reload();
  await expect(page.getByRole("heading", { name: "Modo compra" })).toBeVisible();
  await expect(linha(page, "Melao Japones").getByRole("button", { name: /Peguei ✓/ })).toBeVisible();
  await expect(linha(page, "Melao Japones").getByLabel(/Preço unitário de Melao Japones/)).toHaveValue("8,00");
  await expect(linha(page, "Chiclete").getByText("Extra", { exact: true })).toBeVisible();
  await expect(linha(page, "Banana Prata").getByText(/Não encontrei: volta na próxima ida/)).toBeVisible();
  await expect(page.getByText("2 de 17 itens")).toBeVisible();
  await expect(page.getByText(/Passou do orçamento/)).toBeVisible();

  // pegos vão para o fim do grupo: o primeiro item do grupo não é o Melão
  const primeiro = page.getByRole("list").nth(0).getByRole("listitem").first();
  await expect(primeiro).not.toContainText("Melao Japones");

  // desfazer o peguei
  await linha(page, "Melao Japones").getByRole("button", { name: /Peguei ✓/ }).click();
  await expect(page.getByText("1 de 17 itens")).toBeVisible();

  await expect(page.getByRole("link", { name: "Terminar compra" })).toHaveAttribute("href", /^\/importar\?lista=/);
  semViolacaoDeCsp(erros);
});
