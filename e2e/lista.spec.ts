import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole, pularEstimativa, prepararDespensa } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

async function importarNota(page: Page) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra|Substituir compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
  await prepararDespensa(page);
}

const item = (page: Page, nome: string) => page.getByRole("listitem").filter({ hasText: nome }).first();

test("sem dados, a lista fica vazia e leva à despensa", async ({ page }) => {
  await page.goto("/lista");
  await expect(page.getByText("Nada faltando")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para a despensa" })).toHaveAttribute("href", "/despensa");
});

test("lista gerada do catálogo: itens, estimativa, edição, remoção e avulso preservam as edições ao reabrir", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await importarNota(page);
  await page.goto("/lista");

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
  await page.reload(); // a lista é recalculada ao abrir a tela
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

  semViolacaoDeCsp(erros);
});

test("quantidade nunca fica negativa", async ({ page }) => {
  await importarNota(page);
  await page.goto("/lista");
  const quase = item(page, "Coentro"); // unidade: passo 1
  const quantidade = quase.locator("[aria-live=polite]");
  for (let i = 0; i < 6; i++) {
    const antes = (await quantidade.textContent()) ?? "";
    if (/^0 /.test(antes)) break;
    await quase.getByRole("button", { name: "Diminuir Coentro" }).click();
    await expect(quantidade).not.toHaveText(antes); // espera a gravação refletir na tela
  }
  await expect(quase.getByRole("button", { name: "Diminuir Coentro" })).toBeDisabled();
  await expect(quase.locator("[aria-live=polite]")).toHaveText(/^0 /);
});

test("Compartilhar lista abre o menu do sistema com o texto da lista", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __compartilhado: unknown[] }).__compartilhado = [];
    navigator.share = async (dados) => {
      (window as unknown as { __compartilhado: unknown[] }).__compartilhado.push(dados);
    };
  });
  await importarNota(page);
  await page.goto("/lista");
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  await expect(page.getByRole("button", { name: "Regerar lista" })).toHaveCount(0);
  await page.getByRole("button", { name: "Compartilhar lista" }).click();
  const dados = await page.evaluate(() => (window as unknown as { __compartilhado: { title: string; text: string }[] }).__compartilhado[0]);
  expect(dados.title).toBe("Lista de compras");
  expect(dados.text).toMatch(/^Lista de compras \(\d{2}\/\d{2}\/\d{4}\)\n\nHortifruti\n• /);
  expect(dados.text).toMatch(/• .*Melao Japones/);
  expect(dados.text.split("\n").filter((l) => l.startsWith("• "))).toHaveLength(16);
});

test("sem o menu de compartilhar, a lista é copiada", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
  await importarNota(page);
  await page.goto("/lista");
  await page.getByRole("button", { name: "Compartilhar lista" }).click();
  await expect(page.getByText(/Copiei a lista/)).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/• .*Melao Japones/);
});

test("sem itens, Compartilhar lista fica desabilitado", async ({ page }) => {
  await page.goto("/lista");
  await expect(page.getByRole("button", { name: "Compartilhar lista" })).toBeDisabled();
});
