import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole, pularEstimativa } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

/** Segunda nota do mesmo mercado: sem Cenoura e Goiaba, número 68904 (chave com DV válido). */
function segundaNota(): string {
  let t = NOTA.replace(/CENOURA KG\(Código[\s\S]*?\n\n(?=[A-Z])/, "").replace(/GOIABA KG\(Código[\s\S]*?6,36\n/, "");
  t = t.replace("Qtd. total de itens:16", "Qtd. total de itens:14");
  t = t.replace("Número: 68903", "Número: 68904").replace("04/11/2026 10:33:31", "11/11/2026 10:33:31");
  t = t.replace("2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720", "2626 1108 8682 3100 0638 6500 2000 0689 0410 2077 8728");
  return t;
}

async function salvarNota(page: Page, texto: string) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(texto);
  await page.getByRole("button", { name: "Ler nota" }).click();
}

test("fluxo completo: lista → compra → nota → resumo, com estoque e pendências", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  // 1ª nota: povoa o catálogo (e deixa tudo cheio)
  await salvarNota(page, NOTA);
  await page.getByRole("button", { name: /Salvar compra|Substituir compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/); // sem lista aberta: vai para Compras

  // lista da ida de hortifruti e modo compra
  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  await page.getByRole("link", { name: "Iniciar compra" }).click();
  await page.getByRole("listitem").filter({ hasText: "Melao Japones" }).first().getByRole("button", { name: "Peguei", exact: true }).click();
  await page.getByRole("link", { name: "Terminar compra" }).click();
  await expect(page).toHaveURL(/\/importar\?lista=/);

  // 2ª nota, associada à lista aberta (já selecionada)
  const texto = segundaNota();
  expect(texto).not.toContain("CENOURA");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(texto);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await expect(page.getByText("Li 14 itens.")).toBeVisible();
  await expect(page.getByLabel("Associar esta nota à lista")).toContainText("Hortifruti semanal");
  await expect(page.getByLabel("Associar esta nota à lista")).not.toHaveValue("");
  await page.getByRole("button", { name: /Salvar compra/ }).click();

  // resumo
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/resumo\?lista=/);
  await expect(page.getByRole("heading", { name: "Resumo da compra" })).toBeVisible();
  await expect(page.getByText("Comprado (14)")).toBeVisible();
  await expect(page.getByText("Faltou (2)")).toBeVisible();
  await expect(page.getByText("Fora da lista (0)")).toBeVisible();
  await expect(page.getByLabel("Total gasto")).not.toHaveText("R$ 0,00");
  await expect(page.getByLabel("Custo da ida")).toHaveText("Custo da ida: estimativa pendente.");
  // o grupo "Faltou" já abre sozinho quando há itens
  await expect(page.getByText("Ficaram pendentes e voltam na próxima ida.")).toBeVisible();
  await expect(page.getByText("Cenoura", { exact: true })).toBeVisible();
  await expect(page.getByText("Goiaba", { exact: true })).toBeVisible();

  // a lista fechou: a mesma ida gera uma nova lista, trazendo de volta quem faltou
  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(page.getByRole("heading", { name: "Hortifruti", exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Cenoura" }).first()).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Goiaba" }).first()).toBeVisible();
  semViolacaoDeCsp(erros);
});

test("nota com item fora da lista conta como emergência em ida de reposição", async ({ page }) => {
  await salvarNota(page, NOTA);
  await page.getByRole("button", { name: /Salvar compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  // remove a Cenoura da lista: ela virá na nota, mas não estava na lista
  await page.getByRole("button", { name: "Remover Cenoura" }).click();
  await page.getByRole("link", { name: "Iniciar compra" }).click();
  await page.getByRole("link", { name: "Terminar compra" }).click();
  // nota completa (com Cenoura): troca só número, data e chave
  const completa = NOTA.replace("Número: 68903", "Número: 68904").replace("04/11/2026 10:33:31", "11/11/2026 10:33:31").replace("2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720", "2626 1108 8682 3100 0638 6500 2000 0689 0410 2077 8728");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(completa);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/resumo\?lista=/);
  await expect(page.getByText("Fora da lista (1)")).toBeVisible();
  await expect(page.getByText(/1 item conta como compra de emergência/)).toBeVisible();
  await expect(page.getByText("emergência", { exact: true })).toBeVisible();
});

test("resumo sem lista informa que não há resumo", async ({ page }) => {
  await page.goto("/resumo?lista=nao-existe");
  await expect(page.getByText("Resumo não encontrado")).toBeVisible();
});
