import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { envelhecerEstoques, semViolacaoDeCsp, vigiarConsole, pularEstimativa } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

async function importarNota(page: Page) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra|Substituir compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
}

test("sem itens, a revisão avisa que não há nada para revisar", async ({ page }) => {
  await page.goto("/conferencia");
  await expect(page.getByText("Nada para conferir")).toBeVisible();
});

test("revisar 5 itens desatualizados: níveis e tempo persistem; o resto segue na fila", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await importarNota(page);
  await envelhecerEstoques(page); // a quantidade dos 16 itens está sem confirmar há meses

  await page.goto("/conferencia");
  await expect(page.getByText("Produto 1 de 16")).toBeVisible();
  await expect(page.getByText(/Faz tempo que você não confere|Provavelmente acabando/)).toBeVisible();

  const nome = async () => (await page.getByRole("heading", { level: 2 }).first().textContent()) ?? "";
  const primeiro = await nome();
  await page.getByRole("button", { name: "Cheio", exact: true }).click();
  await expect(page.getByText("Produto 2 de 16")).toBeVisible();
  await page.getByRole("button", { name: "Metade", exact: true }).click();
  await page.getByRole("button", { name: "Acabando", exact: true }).click();
  await page.getByRole("button", { name: "Acabou", exact: true }).click();

  // voltar e pular
  await expect(page.getByText("Produto 5 de 16")).toBeVisible();
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByText("Produto 4 de 16")).toBeVisible();
  await page.getByRole("button", { name: "Pular" }).click();
  await expect(page.getByText("Produto 5 de 16")).toBeVisible();

  // atalho "Mesmo que o estimado"
  await page.getByRole("button", { name: /Mesmo que o estimado/ }).click();
  await expect(page.getByText("Produto 6 de 16")).toBeVisible();

  await page.getByRole("button", { name: "Concluir antes" }).click();
  await expect(page.getByText("Conferência concluída")).toBeVisible();
  await expect(page.getByText(/5 de 16 produtos conferidos em/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar à despensa" })).toHaveAttribute("href", "/despensa");

  // persistiu: a importação já deixou os 16 produtos como "cheio"; as 5 respostas atualizaram o estoque
  // (backup: os 4 níveis aparecem, 16 registros de estoque e 1 conferência com o tempo)
  await page.goto("/ajustes");
  const baixa = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar o arquivo" }).click();
  const arquivo = JSON.parse(readFileSync((await (await baixa).path()) as string, "utf8"));
  const niveis: string[] = arquivo.colecoes.estoques.map((e: { nivel: string }) => e.nivel);
  expect(niveis).toHaveLength(16);
  expect(new Set(niveis)).toEqual(new Set(["cheio", "metade", "acabando", "acabou"]));
  expect(niveis.filter((n) => n !== "cheio").length).toBeGreaterThanOrEqual(3); // metade, acabando e acabou (+ o estimado); o resto segue cheio
  expect(arquivo.colecoes.conferencias).toHaveLength(1);
  expect(arquivo.colecoes.conferencias[0]).toMatchObject({ produtosConferidos: 5 });
  expect(arquivo.colecoes.conferencias[0].duracaoSegundos).toBeGreaterThanOrEqual(0);

  // reabrir: só sobram os 11 itens que ainda não foram revisados
  await page.goto("/conferencia");
  await expect(page.getByText("Produto 1 de 11")).toBeVisible();
  expect(primeiro.length).toBeGreaterThan(0);
  semViolacaoDeCsp(erros);
});

test("sair no meio mantém as respostas já dadas", async ({ page }) => {
  await importarNota(page);
  await envelhecerEstoques(page);
  await page.goto("/conferencia");
  await page.getByRole("button", { name: "Acabou", exact: true }).click();
  await page.getByRole("button", { name: "Acabou", exact: true }).click();
  await page.goto("/ajustes"); // sai sem concluir
  const baixa = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar o arquivo" }).click();
  const arquivo = JSON.parse(readFileSync((await (await baixa).path()) as string, "utf8"));
  const niveis: string[] = arquivo.colecoes.estoques.map((e: { nivel: string }) => e.nivel);
  expect(niveis.filter((n) => n === "acabou")).toHaveLength(2); // as duas respostas; os outros 14 seguem cheios da importação
  expect(arquivo.colecoes.conferencias).toHaveLength(0); // sem concluir, não registra tempo
});
