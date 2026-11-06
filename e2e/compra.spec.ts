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

  // pegar: o card vira uma linha com ✓; o preço se edita ao abrir a linha
  await linha(page, "Melao Japones").getByRole("button", { name: "Peguei Melao Japones", exact: true }).click();
  await expect(linha(page, "Melao Japones").getByRole("button", { name: "Desfazer peguei: Melao Japones" })).toBeVisible();
  await expect(linha(page, "Melao Japones").getByLabel(/Preço unitário de Melao Japones/)).toHaveCount(0); // linha recolhida
  await linha(page, "Melao Japones").getByRole("button", { name: "Editar Melao Japones" }).click();
  const preco = linha(page, "Melao Japones").getByLabel(/Preço unitário de Melao Japones/);
  await preco.fill("8,00");
  await preco.blur();
  await expect(page.getByLabel("Total corrente")).not.toContainText("R$ 0,00");
  await expect(linha(page, "Melao Japones")).toContainText("R$ 8,00");

  // preço informado antes de pegar (no próprio card pendente) aparece na linha
  await linha(page, "Goiaba").getByLabel(/Preço unitário de Goiaba/).fill("5,00");
  await linha(page, "Goiaba").getByRole("button", { name: "Peguei Goiaba", exact: true }).click();
  await expect(linha(page, "Goiaba")).toContainText("R$ 5,00");

  // extra já entra como pego, com preço, e soma no total
  const totalAntes = await page.getByLabel("Total corrente").textContent();
  await page.getByLabel("Nome do extra").fill("Chiclete");
  await page.getByLabel("Quantidade do extra").fill("2");
  await page.getByLabel(/Preço unitário do extra/).fill("1,50");
  await page.getByRole("button", { name: "Adicionar extra" }).click();
  await expect(linha(page, "Chiclete").getByText("Extra", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Total corrente")).not.toHaveText(totalAntes ?? "");
  await expect(page.getByText("3 de 17 itens")).toBeVisible();

  // não peguei: linha amarela, no fim da lista
  await linha(page, "Banana Prata").getByRole("button", { name: "Não peguei Banana Prata" }).click();
  await expect(linha(page, "Banana Prata").getByRole("button", { name: "Desfazer não peguei: Banana Prata" })).toContainText("Não peguei");

  // orçamento baixo: alerta ao passar
  const orc = page.getByLabel("Orçamento da compra (opcional)");
  await orc.fill("1,00");
  await orc.blur();
  await expect(page.getByText(/Passou do orçamento de R\$ 1,00/)).toBeVisible();

  // recarregar offline: tudo preservado
  await page.reload();
  await expect(page.getByRole("heading", { name: "Modo compra" })).toBeVisible();
  await expect(linha(page, "Melao Japones").getByRole("button", { name: "Desfazer peguei: Melao Japones" })).toBeVisible();
  await linha(page, "Melao Japones").getByRole("button", { name: "Editar Melao Japones" }).click();
  await expect(linha(page, "Melao Japones").getByLabel(/Preço unitário de Melao Japones/)).toHaveValue("8,00");
  await expect(linha(page, "Chiclete").getByText("Extra", { exact: true })).toBeVisible();
  await expect(linha(page, "Banana Prata").getByRole("button", { name: "Desfazer não peguei: Banana Prata" })).toBeVisible();
  await expect(page.getByText("3 de 17 itens")).toBeVisible(); // melão, goiaba e o extra
  await expect(page.getByText(/Passou do orçamento/)).toBeVisible();

  // ordem no grupo: pendentes primeiro, pegos depois e "não peguei" por último
  const grupo = page.getByRole("list").nth(0).getByRole("listitem");
  await expect(grupo.first()).not.toContainText("Melao Japones");
  await expect(grupo.last()).toContainText("Banana Prata");

  // desfazer o peguei e o não peguei
  await linha(page, "Melao Japones").getByRole("button", { name: "Desfazer peguei: Melao Japones" }).click();
  await expect(page.getByText("2 de 17 itens")).toBeVisible();
  await linha(page, "Banana Prata").getByRole("button", { name: "Desfazer não peguei: Banana Prata" }).click();
  await expect(linha(page, "Banana Prata").getByRole("button", { name: "Peguei Banana Prata", exact: true })).toBeVisible();

  await expect(page.getByRole("link", { name: "Terminar compra" })).toHaveAttribute("href", /^\/importar\?lista=/);
  semViolacaoDeCsp(erros);
});

test("tudo resolvido: aparece o atalho para terminar a compra e a seção concluída vai para baixo", async ({ page }) => {
  await prepararLista(page);
  await expect(page.getByTestId("compra-resolvida")).toHaveCount(0);
  for (let i = 0; i < 15; i++) await page.getByRole("button", { name: /^Peguei / }).first().click();
  await expect(page.getByText("15 de 16 itens")).toBeVisible();
  await page.getByRole("button", { name: /^Não peguei / }).first().click();
  await expect(page.getByTestId("compra-resolvida")).toBeVisible();
  await expect(page.getByTestId("compra-resolvida").getByRole("link", { name: /Terminar compra/ })).toHaveAttribute("href", /^\/importar\?lista=/);
});

test("cada seção mostra quantos itens já foram pegos", async ({ page }) => {
  await prepararLista(page);
  const secao = page.getByRole("heading", { level: 2, name: /^Hortifruti/ });
  await expect(secao).toContainText("0/16");
  await page.getByRole("button", { name: /^Peguei / }).first().click();
  await expect(secao).toContainText("1/16");
});
