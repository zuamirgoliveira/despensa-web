import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { pularEstimativa, semViolacaoDeCsp, vigiarConsole, prepararDespensa } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");
const CHAVE_ORIGINAL = "2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720";
const CHAVES = [
  ["68904", "2626 1108 8682 3100 0638 6500 2000 0689 0410 2077 8728"],
  ["68905", "2626 1108 8682 3100 0638 6500 2000 0689 0510 2077 8725"],
];

/** Nota do mesmo mercado em outra data, com o preço do melão alterado. */
function nota(numero: string, chave: string, dia: string, precoMelao: string): string {
  return NOTA.replace("Número: 68903", `Número: ${numero}`)
    .replace("04/11/2026 10:33:31", `${dia}/11/2026 10:33:31`)
    .replace(CHAVE_ORIGINAL, chave)
    .replace("Vl. Unit.: 7,88", `Vl. Unit.: ${precoMelao}`);
}

async function salvar(page: Page, texto: string) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(texto);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: "Salvar compra" }).click();
  await pularEstimativa(page);
  await prepararDespensa(page);
}

const melao = (page: Page) => page.getByRole("listitem").filter({ hasText: "Melao Japones" }).first();

test("2 compras não geram alerta; a 3ª com preço 33% acima da média gera na lista e no modo compra", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await salvar(page, NOTA); // R$ 7,88
  await salvar(page, nota(CHAVES[0][0], CHAVES[0][1], "05", "7,88"));
  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  await expect(page.getByText(/acima da sua média/)).toHaveCount(0); // só 2 compras

  await salvar(page, nota(CHAVES[1][0], CHAVES[1][1], "06", "10,50")); // +33,2% sobre a média de R$ 7,88
  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(melao(page).getByText("Preço 33% acima da sua média")).toBeVisible();
  await expect(page.getByText(/acima da sua média/)).toHaveCount(1); // só o melão subiu

  await page.getByRole("link", { name: "Iniciar compra" }).click();
  await expect(melao(page).getByText("Preço 33% acima da sua média")).toBeVisible();
  semViolacaoDeCsp(erros);
});

test("o limiar de Ajustes muda o resultado", async ({ page }) => {
  await salvar(page, NOTA);
  await salvar(page, nota(CHAVES[0][0], CHAVES[0][1], "05", "7,88"));
  await salvar(page, nota(CHAVES[1][0], CHAVES[1][1], "06", "10,50"));
  await page.goto("/ajustes");
  await page.getByLabel(/Alerta de preço/).fill("40");
  await page.getByRole("button", { name: "Salvar regras e custos" }).click();
  await expect(page.getByText("Ajustes salvos.").first()).toBeVisible();
  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  await expect(page.getByText(/acima da sua média/)).toHaveCount(0); // 33% < 40%
});
