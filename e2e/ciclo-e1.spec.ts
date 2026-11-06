import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { envelhecerEstoques, prepararDespensa, semViolacaoDeCsp, vigiarConsole } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");
const NOTA2 = NOTA.replace(/CENOURA KG\(Código[\s\S]*?\n\n(?=[A-Z])/, "")
  .replace("Qtd. total de itens:16", "Qtd. total de itens:15")
  .replace("Número: 68903", "Número: 68904")
  .replace("04/11/2026 10:33:31", "11/11/2026 10:33:31")
  .replace("2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720", "2626 1108 8682 3100 0638 6500 2000 0689 0410 2077 8728");
const CORS = { "access-control-allow-origin": "*" };

test("ciclo da E1: importar → agenda → conferir → lista → comprar offline → nota → resumo com custo da ida", async ({ page, context }) => {
  const { erros } = vigiarConsole(page);
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00-03:00")); // domingo
  // serviço de mapas simulado (nunca o real)
  await page.route("https://nominatim.openstreetmap.org/**", (r) =>
    r.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify([{ lat: "-7.9847", lon: "-34.8383", display_name: "x" }]) }));
  await page.route("https://routing.openstreetmap.de/**", (r) =>
    r.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ code: "Ok", routes: [{ distance: 10000, duration: 720 }] }) }));

  // casa e agenda (Ajustes)
  await page.goto("/ajustes");
  await page.getByLabel("Ou digite/cole as coordenadas").fill("-8.0631, -34.8711");
  await page.getByRole("button", { name: "Salvar coordenadas" }).click();
  await expect(page.getByLabel("Localização atual")).toContainText("Definida");

  // 1) importar a nota cria o catálogo; informa a ida (carro, 10 km → 20 km × R$ 0,90 = R$ 18,00)
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra/ }).click();
  await page.getByLabel("Estimativa da ida").getByRole("button", { name: "De carro" }).click({ timeout: 20_000 });
  await expect(page.getByLabel("Custo da ida registrado")).toContainText("R$ 18,00");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/compras$/);

  // 2) revisar a despensa (itens desatualizados): um acabou, outro está pela metade
  await envelhecerEstoques(page);
  await page.goto("/conferencia");
  await page.getByRole("button", { name: "Acabou", exact: true }).click();
  await page.getByRole("button", { name: "Metade", exact: true }).click();
  await page.getByRole("button", { name: "Concluir antes" }).click();
  await expect(page.getByRole("link", { name: "Voltar à despensa" })).toBeVisible();
  await page.goto("/despensa");
  await prepararDespensa(page); // a lista da casa leva os recorrentes zerados: marca tudo como tal (semente de teste)
  await page.goto("/lista");

  // 3) lista da ida; o que acabou entra com motivo "Acabou"
  await expect(page.getByText("Acabou", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Iniciar compra" }).click();
  await expect(page.getByRole("heading", { name: "Modo compra" })).toBeVisible();

  // 4) no mercado, sem internet: marca, adiciona extra, "não encontrei"
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.reload();
  await context.setOffline(true);
  await page.getByRole("listitem").filter({ hasText: "Melao Japones" }).first().getByRole("button", { name: "Peguei Melao Japones", exact: true }).click();
  await page.getByLabel("Nome do extra").fill("Chiclete");
  await page.getByRole("button", { name: "Adicionar extra" }).click();
  await page.getByRole("button", { name: "Não peguei Cenoura" }).click();
  await page.reload();
  await expect(page.getByText("2 de 17 itens")).toBeVisible(); // melão + extra
  await context.setOffline(false);

  // 5) volta a ter internet: importa a nota (sem Cenoura) associada à lista
  await page.getByRole("link", { name: "Terminar compra" }).click();
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA2);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await expect(page.getByLabel("Associar esta nota à lista")).not.toHaveValue("");
  await page.getByRole("button", { name: /Salvar compra/ }).click();

  // 6) resumo: reconciliação, estoque e custo da ida (mercado já conhecido: sem nova pergunta)
  await expect(page).toHaveURL(/\/resumo\?lista=/);
  await expect(page.getByText("Comprado (15)")).toBeVisible();
  await expect(page.getByText("Faltou (2)")).toBeVisible(); // Cenoura e o extra Chiclete (não veio na nota)
  await expect(page.getByLabel("Custo da ida")).toContainText("Custo da ida R$ 18,00 · custo real");
  await expect(page.getByText("Cenoura", { exact: true })).toBeVisible();

  // a Cenoura que faltou volta na próxima lista
  await page.goto("/lista?ida=hortifruti_semanal");
  await expect(page.getByRole("listitem").filter({ hasText: "Cenoura" }).first()).toBeVisible();
  semViolacaoDeCsp(erros);
});
