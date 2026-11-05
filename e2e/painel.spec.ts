import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { pularEstimativa, semViolacaoDeCsp, vigiarConsole } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");
const NOTA2 = NOTA.replace("Número: 68903", "Número: 68904")
  .replace("2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720", "2626 1108 8682 3100 0638 6500 2000 0689 0410 2077 8728");

async function salvar(page: Page, texto: string) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(texto);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: "Salvar compra" }).click();
  await pularEstimativa(page);
}

const metrica = (page: Page, nome: string) => page.getByLabel(nome, { exact: true });

test("sem compras: orientação em vez de zeros", async ({ page }) => {
  await page.goto("/painel");
  await expect(page.getByText("O painel começa com a primeira nota")).toBeVisible();
  await expect(page.getByText(/não há números para mostrar/)).toBeVisible();
});

test("com compras, conferência e ruptura: métricas do mês e comparação com o mês anterior", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  // as duas notas são importadas hoje (o mês atual); o mês anterior fica sem dados
  await salvar(page, NOTA);
  await salvar(page, NOTA2);
  await page.goto("/conferencia?ida=hortifruti_semanal");
  await page.getByRole("button", { name: "Acabou", exact: true }).click();
  await page.getByRole("button", { name: "Concluir antes" }).click();

  await page.goto("/painel");
  await expect(page.getByRole("heading", { name: "Painel do objetivo" })).toBeVisible();
  await expect(metrica(page, "Idas ao mercado").getByText("Mês anterior: 0")).toBeVisible(); // contagem: zero idas no mês anterior
  await expect(page.getByLabel("Idas ao mercado: valor do mês")).toHaveText(/^2(▲|▼|=)?$/);
  await expect(page.getByLabel("Itens já no catálogo: valor do mês")).toHaveText(/^50%(▲|▼|=)?$/); // 0 de 16 + 16 de 16
  await expect(page.getByLabel("Rupturas: valor do mês")).toHaveText(/^1(▲|▼|=)?$/);
  await expect(page.getByLabel("Tempo médio de conferência: valor do mês")).toContainText(/\d+ s/);
  await expect(metrica(page, "Tempo médio de conferência")).toContainText("Dentro da meta de menos de 3 minutos.");
  await expect(page.getByLabel("Compras de emergência: valor do mês")).toHaveText(/^0(▲|▼|=)?$/);
  await expect(metrica(page, "Idas ao mercado")).toContainText("Sem lista: 2");
  await expect(page.getByLabel("Minutos em idas: valor do mês")).toHaveText(/^0 min(▲|▼|=)?$/);
  semViolacaoDeCsp(erros);
});
