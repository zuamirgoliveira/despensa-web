import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { pularEstimativa, semViolacaoDeCsp, vigiarConsole, prepararDespensa } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");
// domingo 08/11/2026: a próxima ida é o hortifruti de quarta (11/11); mercado sábado 14/11; feira 30/11
const DOMINGO = new Date("2026-11-08T12:00:00-03:00");

async function importarNota(page: Page) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
}

test("primeira abertura: boas-vindas com atalhos para adicionar um item ou importar a primeira nota", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
  await expect(page.getByText("Bem-vindo à Despensa")).toBeVisible();
  await expect(page.getByRole("link", { name: "Adicionar o primeiro item" })).toHaveAttribute("href", "/despensa");
  await page.getByRole("link", { name: "Importar a primeira nota" }).click();
  await expect(page).toHaveURL(/\/importar$/);
  semViolacaoDeCsp(erros);
});

test("com dados: estado da despensa, próxima compra da agenda e atalhos", async ({ page }) => {
  await page.clock.setFixedTime(DOMINGO);
  await importarNota(page);
  await page.goto("/");
  await expect(page.getByLabel("Itens faltando")).toHaveText("Nada faltando"); // itens da nota entram no padrão e não recorrentes
  await expect(page.getByText("16 itens na despensa")).toBeVisible();
  await expect(page.getByLabel("Próxima ida")).toHaveText("Hortifruti semanal · 11/11/2026 · em 3 dias");
  await expect(page.getByRole("link", { name: "Ver lista" })).toHaveAttribute("href", "/lista");
  await expect(page.getByRole("link", { name: "Abrir despensa" })).toHaveAttribute("href", "/despensa");
  await expect(page.getByRole("link", { name: "Atualizar pela nota", exact: true })).toBeVisible();
});

test("o que falta e os eventuais que acabaram aparecem no Início", async ({ page }) => {
  await page.clock.setFixedTime(DOMINGO);
  await importarNota(page);
  await prepararDespensa(page); // 16 recorrentes zerados
  await page.goto("/");
  await expect(page.getByLabel("Itens faltando")).toHaveText("16 itens faltando");
  await expect(page.getByText("16 itens na despensa · 16 zerados")).toBeVisible();
});

test("a próxima ida acompanha o dia e considera a compra já feita", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-04T12:00:00-03:00")); // quarta 04/11: hortifruti hoje; nota de 04/11 conta como compra feita
  await importarNota(page);
  await page.goto("/");
  await expect(page.getByLabel("Próxima ida")).toHaveText("Feira mensal · 05/11/2026 · amanhã"); // feira dia 5
  await page.clock.setFixedTime(new Date("2026-11-13T12:00:00-03:00")); // sexta: mercado amanhã (sábado 14)
  await page.reload();
  await expect(page.getByLabel("Próxima ida")).toHaveText("Mercado semanal · 14/11/2026 · amanhã");
});

test("lembretes: estimativa de ida pendente e nota pendente de importar", async ({ page }) => {
  await page.clock.setFixedTime(DOMINGO);
  await importarNota(page);
  await prepararDespensa(page); // a lista da casa leva os recorrentes zerados
  await page.goto("/");
  await expect(page.getByText(/Falta estimar a distância de ida de CIA SANTOS/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver mercados" })).toHaveAttribute("href", "/mercados");

  // lista em compra aberta há 3 dias: lembra de importar a nota
  await page.goto("/lista");
  await expect(page.getByRole("button", { name: /^Remover / })).toHaveCount(16);
  await page.getByRole("link", { name: "Iniciar compra" }).click();
  await expect(page.getByRole("heading", { name: "Modo compra" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(/está aberta\. Importe a nota/)).toHaveCount(0); // ainda é o mesmo dia
  await page.clock.setFixedTime(new Date("2026-11-11T12:00:00-03:00"));
  await page.reload();
  await expect(page.getByText(/A compra da lista de 08\/11\/2026 está aberta/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Importar a nota", exact: true })).toHaveAttribute("href", /^\/importar\?lista=/);
});

test("barra inferior: Início, Despensa, Lista, Importar e o menu Mais", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Principal" });
  for (const nome of ["Início", "Despensa", "Lista", "Importar"]) await expect(nav.getByRole("link", { name: nome, exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Preços" })).toBeHidden();
  const mais = nav.getByRole("button", { name: "Mais" });
  await expect(mais).toHaveAttribute("aria-expanded", "false");

  await mais.click();
  await expect(mais).toHaveAttribute("aria-expanded", "true");
  for (const nome of ["Compras", "Conferir despensa", "Preços", "Painel", "Gastos", "Mercados", "Ajustes"]) await expect(nav.getByRole("link", { name: nome, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(mais).toHaveAttribute("aria-expanded", "false");

  await mais.click();
  await page.mouse.click(10, 300); // toque fora fecha
  await expect(mais).toHaveAttribute("aria-expanded", "false");

  await mais.click();
  await nav.getByRole("link", { name: "Mercados", exact: true }).click();
  await expect(page).toHaveURL(/\/mercados$/);
  await expect(mais).toHaveAttribute("aria-expanded", "false"); // fechou ao navegar
  await expect(mais).toHaveClass(/text-primario/); // "Mais" fica destacado quando a tela atual está nele
  await expect(nav.getByRole("link", { name: "Início", exact: true })).not.toHaveAttribute("aria-current", "page");
});
