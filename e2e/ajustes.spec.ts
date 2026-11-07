import { expect, test } from "@playwright/test";
import { abrirSecao, semViolacaoDeCsp, vigiarConsole } from "./util";

const cartao = (page: import("@playwright/test").Page, titulo: string) =>
  page.getByRole("heading", { name: titulo, exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");

test("valores iniciais vêm do seed (agenda e custos)", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await page.goto("/ajustes");
  // fechados, os cards mostram só o resumo
  await expect(page.getByLabel("Resumo: Feira mensal")).toHaveText("Dia 5 do mês · sem mercado habitual");
  await expect(page.getByLabel("Resumo: Mercado semanal")).toContainText("Sábado");
  await expect(page.getByLabel("Resumo: Hortifruti semanal")).toContainText("Quarta");
  await expect(page.getByLabel("Folga em dias")).toBeHidden();
  await expect(page.getByLabel("Resumo das regras")).toHaveText("Folga 2 d · Alerta 20% · Janela 60 d");
  await expect(page.getByLabel("Resumo dos custos")).toHaveText(/Carro R\$ 0,90\/km · Bike R\$ 0,05\/km/);
  await abrirSecao(page, "Regras da lista");
  await abrirSecao(page, "Custo da ida");
  await page.getByRole("button", { name: "Alterar Feira mensal" }).click();
  await expect(cartao(page, "Feira mensal").getByLabel("Dia do mês")).toHaveValue("5");
  await page.getByRole("button", { name: "Alterar Mercado semanal" }).click();
  await expect(cartao(page, "Mercado semanal").getByLabel("Dia da semana")).toHaveValue("6");
  await page.getByRole("button", { name: "Alterar Hortifruti semanal" }).click();
  await expect(cartao(page, "Hortifruti semanal").getByLabel("Dia da semana")).toHaveValue("3");
  await expect(page.getByLabel("Folga em dias")).toHaveValue("2");
  await expect(page.getByLabel(/Alerta de preço/)).toHaveValue("20");
  await expect(page.getByLabel("Consumo do carro (km por litro)")).toHaveValue("10");
  await expect(page.getByLabel(/Preço do combustível/)).toHaveValue("6,00");
  await expect(page.getByLabel(/Desgaste do carro/)).toHaveValue("0,30");
  await expect(page.getByLabel(/Bike elétrica/)).toHaveValue("0,05");
  await expect(page.getByText("Carro: R$ 0,90 por km · Bike elétrica: R$ 0,05 por km")).toBeVisible();
  semViolacaoDeCsp(erros);
});

test("salvar e recarregar mantém os valores; o seed não volta a sobrescrever", async ({ page }) => {
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Alterar Feira mensal" }).click();
  await cartao(page, "Feira mensal").getByLabel("Dia do mês").selectOption("31");
  await cartao(page, "Feira mensal").getByRole("button", { name: "Salvar agenda" }).click();
  await expect(page.getByText("Ajustes salvos.")).toBeVisible();
  await expect(page.getByLabel("Resumo: Feira mensal")).toContainText("Dia 31 do mês"); // fechou sozinho
  await expect(cartao(page, "Feira mensal").getByLabel("Dia do mês")).toBeHidden();

  await abrirSecao(page, "Regras da lista");
  await page.getByLabel("Folga em dias").fill("3");
  await page.getByRole("button", { name: "Salvar regras", exact: true }).click();
  await expect(page.getByText("Ajustes salvos.").first()).toBeVisible();
  await expect(page.getByLabel("Folga em dias")).toBeHidden(); // fechou ao salvar
  await expect(page.getByLabel("Resumo das regras")).toContainText("Folga 3 d");

  await abrirSecao(page, "Custo da ida");
  await page.getByLabel("Consumo do carro (km por litro)").fill("12,5");
  await page.getByLabel(/Preço do combustível/).fill("6,49");
  await page.getByLabel(/Bike elétrica/).fill("0,08");
  await expect(page.getByText(/Carro: R\$ 0,82 por km · Bike elétrica: R\$ 0,08 por km/)).toBeVisible();
  await page.getByRole("button", { name: "Salvar custos" }).click();
  await expect(page.getByLabel("Consumo do carro (km por litro)")).toBeHidden();

  await page.reload();
  await page.getByRole("button", { name: "Alterar Feira mensal" }).click();
  await abrirSecao(page, "Regras da lista");
  await abrirSecao(page, "Custo da ida");
  await expect(cartao(page, "Feira mensal").getByLabel("Dia do mês")).toHaveValue("31");
  await expect(page.getByLabel("Folga em dias")).toHaveValue("3");
  await expect(page.getByLabel("Consumo do carro (km por litro)")).toHaveValue("12,5");
  await expect(page.getByLabel(/Preço do combustível/)).toHaveValue("6,49");
  await expect(page.getByLabel(/Bike elétrica/)).toHaveValue("0,08");
});

test("validação por campo e agenda sem dia", async ({ page }) => {
  await page.goto("/ajustes");
  await abrirSecao(page, "Regras da lista");
  await abrirSecao(page, "Custo da ida");
  await page.getByLabel("Folga em dias").fill("-2");
  await page.getByLabel("Consumo do carro (km por litro)").fill("0");
  await page.getByRole("button", { name: "Salvar regras", exact: true }).click();
  await expect(page.getByText("Informe a folga em dias (0 a 30).")).toBeVisible();
  await expect(page.getByText("Informe os km por litro (maior que zero).")).toBeVisible();
  await expect(page.getByText("Corrija os campos destacados.").first()).toBeVisible();

  await page.getByRole("button", { name: "Alterar Mercado semanal" }).click();
  await cartao(page, "Mercado semanal").getByLabel("Dia da semana").selectOption("");
  await cartao(page, "Mercado semanal").getByRole("button", { name: "Salvar agenda" }).click();
  await expect(cartao(page, "Mercado semanal").getByText("Escolha o dia da semana.")).toBeVisible();
});
