import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole, pularEstimativa } from "./util";

const CHAVE = "26261108868231000638650020000689031020778720";
const CHAVE_ESPACADA = "2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720";
const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

async function lerNota(page: Page, texto: string) {
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(texto);
  await page.getByRole("button", { name: "Ler nota" }).click();
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

test("chave com um dígito divergente: oferece as trocas de 1 dígito e nunca aplica sozinho", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await page.goto("/importar");
  const campo = page.getByLabel("Chave de acesso (44 dígitos)");
  // chave de nota real de impressão pontilhada, transcrita com o 9 do grupo 10 que no papel é 5
  await campo.fill("2626 1141 4993 3900 0161 6500 5000 1238 5490 9136 4469");
  await expect(page.getByText("Dígito verificador não confere")).toBeVisible();
  const grupo = page.getByRole("group", { name: "Correções possíveis" });
  await expect(grupo).toBeVisible();
  await expect(campo).toHaveValue("2626 1141 4993 3900 0161 6500 5000 1238 5490 9136 4469"); // não mudou sozinho
  await grupo.getByRole("button", { name: "Grupo 10, dígito 1: trocar 9 por 5" }).click();
  await expect(campo).toHaveValue("2626 1141 4993 3900 0161 6500 5000 1238 5490 5136 4469");
  await expect(page.getByText(/Chave válida: nota 123854, série 5/)).toBeVisible();
  await expect(grupo).toBeHidden();
  semViolacaoDeCsp(erros);
});

test("chave: parcial, inválida e válida", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await page.goto("/importar");
  const campo = page.getByLabel("Chave de acesso (44 dígitos)");
  await campo.fill("123");
  await expect(page.getByText("3/44 dígitos")).toBeVisible();
  await campo.fill(CHAVE.slice(0, 30) + "9" + CHAVE.slice(31));
  await expect(page.getByText(/Dígito verificador não confere/)).toBeVisible();
  await campo.fill(CHAVE_ESPACADA);
  await expect(page.getByText(/Chave válida: nota 68903, série 2, PE, 11\/2026, CNPJ 08\.868\.231\/0006-38/)).toBeVisible();
  await expect(campo).toHaveValue(CHAVE_ESPACADA);
  semViolacaoDeCsp(erros);
});

test("botão da SEFAZ copia a chave e abre a consulta", async ({ page, context }) => {
  await page.goto("/importar");
  const botao = page.getByRole("button", { name: "Copiar chave e abrir SEFAZ" });
  await expect(botao).toBeDisabled();
  await page.getByLabel("Chave de acesso (44 dígitos)").fill(CHAVE);
  await expect(botao).toBeEnabled();
  const aberta = context.waitForEvent("page");
  await botao.click();
  const popup = await aberta;
  expect(popup.url()).toContain("nfce.sefaz.pe.gov.br/nfce-web/consNfce");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CHAVE);
  await popup.close();
});

test("texto da nota: 16 itens, total, salvar, duplicada e apelido lembrado", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await page.goto("/importar");
  await lerNota(page, NOTA);
  await expect(page.getByText("Li 16 itens.")).toBeVisible();
  await expect(page.getByText("R$ 77,24").first()).toBeVisible();
  await expect(page.getByText("novo", { exact: true })).toHaveCount(16);
  await expect(page.getByLabel("Nome do produto").first()).toHaveValue("Melao Japones");
  await page.getByLabel("Nome do produto").first().fill("Melão");
  await page.getByRole("button", { name: "Salvar compra" }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);

  // reimportar: aviso de duplicada, apelido lembrado (nenhum "novo"), nome escolhido preservado
  await page.goto("/importar");
  await lerNota(page, NOTA);
  await expect(page.getByText(/Esta nota já foi importada/)).toBeVisible();
  await expect(page.getByText("novo", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Nome do produto").first()).toHaveValue("Melão");
  await expect(page.getByRole("button", { name: "Substituir compra" })).toBeEnabled();
  semViolacaoDeCsp(erros);
});

test("total adulterado gera aviso e ainda permite salvar; item faltando bloqueia", async ({ page }) => {
  await page.goto("/importar");
  await lerNota(page, NOTA.replace("Valor a pagar R$:77,24", "Valor a pagar R$:80,00"));
  await expect(page.getByText(/difere do valor a pagar/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Salvar compra|Substituir compra/ })).toBeEnabled();

  await lerNota(page, NOTA.replace(/GOIABA KG[\s\S]*?6,36\n/, ""));
  await expect(page.getByText(/16 itens, mas li 15/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Salvar compra|Substituir compra/ })).toBeDisabled();
});

test("chave do texto diferente da chave do passo 1 é erro", async ({ page }) => {
  await page.goto("/importar");
  const outra = "26261108868231000638650020000689041020778728"; // mesmo mercado, número 68904 (DV válido)
  await page.getByLabel("Chave de acesso (44 dígitos)").fill(outra);
  await lerNota(page, NOTA);
  await expect(page.getByText(/chave do texto colado é diferente/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Salvar compra|Substituir compra/ })).toBeDisabled();
});

test("texto sem relação com a nota mostra erros", async ({ page }) => {
  await page.goto("/importar");
  await lerNota(page, "qualquer coisa");
  await expect(page.getByText(/Não encontrei nenhum item/)).toBeVisible();
});

test("Compartilhar: /importar?text=... lê a nota e limpa a URL", async ({ page }) => {
  await page.goto("/importar?text=" + encodeURIComponent(NOTA));
  await expect(page.getByText("Li 16 itens.")).toBeVisible();
  await expect(page).toHaveURL(/\/importar$/);
  await expect(page.getByLabel("Chave de acesso (44 dígitos)")).toHaveValue(CHAVE_ESPACADA);
});
