import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

async function importarNota(page: Page) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra|Substituir compra/ }).click();
  await expect(page).toHaveURL(/\/compras$/);
}

test("estados vazios de Compras e Preços", async ({ page }) => {
  await page.goto("/compras");
  await expect(page.getByText("Nenhuma compra ainda")).toBeVisible();
  await page.goto("/precos");
  await expect(page.getByText("Nenhum preço ainda")).toBeVisible();
});

test("compra aparece em Compras (detalhe) e em Preços", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await importarNota(page);
  await expect(page.getByText("R$ 77,24").first()).toBeVisible();
  await expect(page.getByText(/CIA SANTOS/)).toBeVisible();
  await page.getByText(/CIA SANTOS/).click(); // expande o detalhe
  await expect(page.getByRole("cell", { name: "Melao Japones" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "R$ 7,88", exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Preços" }).click();
  await expect(page.getByText("Melao Japones")).toBeVisible();
  await expect(page.getByText("R$ 7,88/kg", { exact: true }).first()).toBeVisible();
  const melao = page.getByRole("listitem").filter({ hasText: "Melao Japones" });
  await melao.getByText("Melao Japones").click();
  await expect(melao.getByText(/Menor R\$ 7,88\/kg · maior R\$ 7,88\/kg/)).toBeVisible();
  semViolacaoDeCsp(erros);
});

test("variação de preço entre duas compras (▲ e ▼)", async ({ page }) => {
  await importarNota(page);
  // segunda compra: outra data e preço do melão 10% maior (R$ 7,88 → 8,67)
  const outra = NOTA.replace("Número: 68903", "Número: 68904")
    .replace("04/11/2026 10:33:31", "11/11/2026 10:33:31")
    .replace("Vl. Unit.: 7,88", "Vl. Unit.: 8,67")
    .replace("Vl. Total\n9,93", "Vl. Total\n10,92")
    .replace("Valor a pagar R$:77,24", "Valor a pagar R$:78,23");
  expect(outra).not.toBe(NOTA);
  // a chave muda junto com o número: remove a linha de chave para não conflitar (vira aviso)
  const semChave = outra.replace(/Chave de acesso:[\s\S]*?(?=Consumidor)/, "");
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(semChave);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await expect(page.getByText(/Informe a chave da nota/)).toBeVisible();
  await page.getByLabel("Chave de acesso (44 dígitos)").fill("26261108868231000638650020000689041020778728");
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: "Salvar compra" }).click();
  await expect(page).toHaveURL(/\/compras$/);
  await page.goto("/precos");
  const melao = page.getByRole("listitem").filter({ hasText: "Melao Japones" });
  await expect(melao.getByText("R$ 8,67/kg").first()).toBeVisible();
  await expect(melao.getByText("▲ 10,0%")).toBeVisible();
});

test("apagar compra pede confirmação própria e respeita Cancelar", async ({ page }) => {
  await importarNota(page);
  let nativo = false;
  page.on("dialog", () => (nativo = true));
  await page.getByRole("button", { name: "Apagar compra" }).click();
  const dialogo = page.getByRole("dialog", { name: "Apagar esta compra?" });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText(/CIA SANTOS/)).toBeVisible();
  await page.getByRole("button", { name: "Apagar compra" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByText("Nenhuma compra ainda")).toBeVisible();
  expect(nativo).toBe(false);
});

test("backup: exportar, apagar tudo e importar de volta restaura os dados", async ({ page }, info) => {
  await importarNota(page);
  await page.goto("/ajustes");
  const baixa = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar backup" }).click();
  const download = await baixa;
  expect(download.suggestedFilename()).toMatch(/^despensa-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const caminho = info.outputPath("backup.json");
  await download.saveAs(caminho);
  const conteudo = JSON.parse(readFileSync(caminho, "utf8"));
  expect(conteudo.versao).toBe(1);
  expect(conteudo.colecoes.compras).toHaveLength(1);
  expect(JSON.stringify(conteudo)).not.toMatch(/cpf/i);

  await page.goto("/compras");
  await page.getByRole("button", { name: "Apagar compra" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByText("Nenhuma compra ainda")).toBeVisible();

  await page.goto("/ajustes");
  await page.getByLabel("Arquivo de backup").setInputFiles(caminho);
  await expect(page.getByText(/Importado: 1 compras/)).toBeVisible();
  await page.goto("/compras");
  await expect(page.getByText("R$ 77,24").first()).toBeVisible();
  await page.goto("/ajustes");

  // arquivo inválido e versão futura
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("não é json") });
  await expect(page.getByText(/não é um JSON válido/)).toBeVisible();
  await page.getByLabel("Arquivo de backup").setInputFiles({
    name: "y.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...conteudo, versao: 99 })),
  });
  await expect(page.getByText(/mais nova que a suportada/)).toBeVisible();
});
