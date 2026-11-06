import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole, pularEstimativa, irParaTela, restaurarBackupPelaTela } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

async function importarNota(page: Page) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra|Substituir compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
}

const item = (page: Page, nome: string) => page.getByRole("listitem").filter({ hasText: nome }).first();
const linhas = (page: Page) => page.getByRole("button", { name: /^Diminuir / });

test("despensa vazia orienta a adicionar um item ou importar uma nota", async ({ page }) => {
  await page.goto("/despensa");
  await expect(page.getByText("A despensa está vazia")).toBeVisible();
  await expect(page.getByRole("link", { name: "Atualizar pela nota" }).first()).toHaveAttribute("href", "/importar");
});

test("adicionar item à mão: nasce recorrente e, zerado, entra na lista", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await page.goto("/despensa");
  await page.getByText("Adicionar item", { exact: true }).click();
  await page.getByLabel("Nome do item").fill("Café");
  await page.getByLabel("Quantidade padrão (opcional)").fill("2");
  await page.getByLabel("Quantidade atual (opcional)").fill("0");
  await page.getByRole("button", { name: "Adicionar à despensa" }).click();
  await expect(page.getByText("“Café” entrou na despensa.")).toBeVisible();
  await expect(item(page, "Café")).toContainText("0 de 2");
  await expect(item(page, "Café")).toContainText("Zerado");
  await expect(item(page, "Café")).toContainText("Recorrente");

  await page.getByLabel("Nome do item").fill("café"); // repetido (caixa e acento não contam)
  await page.getByRole("button", { name: "Adicionar à despensa" }).click();
  await expect(page.getByText("“café” já está na despensa.")).toBeVisible();

  await page.goto("/lista");
  await expect(item(page, "Café")).toBeVisible();
  semViolacaoDeCsp(erros);
});

test("a nota popula a despensa: eventuais, quantidades, filtros, +/−, repor sempre, arquivar e mesclar", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await importarNota(page);
  await irParaTela(page, "Despensa");

  await expect(page.getByTestId("resumo-despensa")).toHaveText("16 itens · 0 zerados · 0 com menos da metade");
  await expect(page.getByRole("heading", { name: "Hortifruti" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Eventual" })).toHaveCount(16); // nascem da nota: não vão sozinhos para a lista

  // busca (sem acento nem caixa)
  await page.getByLabel("Buscar item").fill("MELAO");
  await expect(linhas(page)).toHaveCount(1);
  await page.getByLabel("Buscar item").fill("zzz");
  await expect(page.getByText("Nenhum item encontrado.")).toBeVisible();
  await page.getByLabel("Buscar item").fill("melao");

  // quantidade atual de padrão: a nota somou 1,26 kg e o padrão é a média (1,26)
  const melao = item(page, "Melao Japones");
  await expect(melao.getByTestId("quantidade")).toHaveText("1,26 de 1,26 kg");
  await expect(melao).toContainText("No padrão");
  await melao.getByRole("button", { name: "Diminuir Melao Japones" }).click();
  await expect(melao.getByTestId("quantidade")).toHaveText("1,16 de 1,26 kg");
  await expect(melao).toContainText("Abaixo do padrão");
  await melao.getByRole("button", { name: "Aumentar Melao Japones" }).click();
  await melao.getByRole("button", { name: "Aumentar Melao Japones" }).click();
  await expect(melao.getByTestId("quantidade")).toHaveText("1,36 de 1,26 kg"); // acima do padrão é permitido
  await expect(melao).toContainText("Acima do padrão");

  // repor sempre: folha com o padrão sugerido
  await melao.getByRole("button", { name: "Repor sempre", exact: true }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByLabel(/^Quantidade padrão/)).toHaveValue("1,3");
  await dialogo.getByRole("button", { name: "Repor sempre" }).click();
  await expect(page.getByText("Pronto: quando faltar, vai para a lista.")).toBeVisible();
  await expect(melao).toContainText("Recorrente");
  await page.getByLabel("Buscar item").fill("");
  await page.getByRole("button", { name: "Eventuais" }).click();
  await expect(linhas(page)).toHaveCount(15);
  await page.getByRole("button", { name: "Todos" }).click();

  // editar o padrão à mão
  await melao.getByText("Ajustar e editar").click();
  await melao.getByText("Mais opções").click();
  await melao.locator("form").getByLabel(/^Quantidade padrão/).fill("3,5");
  await melao.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByText("Item salvo.")).toBeVisible();
  await expect(melao.getByTestId("quantidade")).toHaveText("1,36 de 3,5 kg");
  await expect(melao).toContainText("Menos da metade"); // 39% do padrão: já entra na lista

  // quantidade exata
  await melao.getByLabel(/^Quantidade atual \(kg\)/).fill("0");
  await melao.getByRole("button", { name: "Definir" }).click();
  await expect(melao.getByTestId("quantidade")).toHaveText("0 de 3,5 kg");
  await expect(melao).toContainText("Zerado");
  await expect(page.getByTestId("resumo-despensa")).toHaveText("16 itens · 1 zerado · 0 com menos da metade");

  // arquivar some; "Mostrar arquivados" traz de volta
  await melao.getByRole("button", { name: "Arquivar" }).click();
  await expect(linhas(page)).toHaveCount(15);
  await page.getByLabel("Mostrar arquivados").check();
  await expect(linhas(page)).toHaveCount(16);
  await expect(melao).toContainText("Arquivado");
  await melao.getByText("Ajustar e editar").click();
  await melao.getByText("Mais opções").click();
  await melao.getByRole("button", { name: "Desarquivar" }).click();
  await page.getByLabel("Mostrar arquivados").uncheck();

  // mesclar Melão em Banana Prata
  await melao.getByRole("button", { name: "Mesclar com outro" }).click();
  const mescla = page.getByRole("dialog");
  await mescla.getByLabel("Mesclar em").selectOption({ label: "Banana Prata" });
  await mescla.getByRole("button", { name: "Mesclar", exact: true }).click();
  await expect(page.getByText("Itens mesclados.")).toBeVisible();
  await expect(linhas(page)).toHaveCount(15);

  // o histórico de preços mostra os dois itens da nota sob Banana Prata
  await irParaTela(page, "Preços");
  const banana = page.getByRole("listitem").filter({ hasText: "Banana Prata" }).first();
  await banana.getByText("Banana Prata").first().click();
  await expect(banana.getByText(/04\/11\/2026/)).toHaveCount(2);
  semViolacaoDeCsp(erros);
});

test("histórico de preço dentro do item", async ({ page }) => {
  await importarNota(page);
  await irParaTela(page, "Despensa");
  const melao = item(page, "Melao Japones");
  await melao.getByText("Ajustar e editar").click();
  await melao.getByText("Preço e compras").click();
  await expect(melao.getByTestId("historico-item")).toContainText("Último:");
  await expect(melao.getByTestId("historico-item")).toContainText("04/11/2026");
});

test("possíveis duplicados: aponta o mesmo produto escrito de outro jeito e só mescla com confirmação", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  // @ts-expect-error módulo .mjs de script, sem tipos
  const { gerarSeed } = await import("../scripts/seed-dev.mjs");
  const seed = gerarSeed(new Date());
  const modelo = seed.colecoes.produtos[0];
  seed.colecoes.produtos.push(
    { ...modelo, id: "00000000-0000-4000-8000-0000000000a1", nome: "Maionese LIZA 500g" },
    { ...modelo, id: "00000000-0000-4000-8000-0000000000a2", nome: "maionese liza 500 g" },
  );
  await page.goto("/ajustes");
  await restaurarBackupPelaTela(page, { name: "seed.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(seed)) });

  await page.goto("/despensa");
  await expect(page.getByRole("heading", { name: "Possíveis duplicados (1)" })).toBeVisible();
  await expect(page.getByText("Mesmo produto escrito de outro jeito.")).toBeVisible();
  const itens = page.getByRole("listitem").filter({ hasText: /maionese liza 500 ?g/i });
  await expect(itens).toHaveCount(3); // o aviso de duplicado + os dois produtos

  await page.getByRole("button", { name: /^Manter “Maionese LIZA 500g”$/ }).click();
  await expect(page.getByRole("dialog", { name: "Mesclar produtos?" })).toBeVisible();
  // cancelar não muda nada
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("heading", { name: "Possíveis duplicados (1)" })).toBeVisible();

  await page.getByRole("button", { name: /^Manter “Maionese LIZA 500g”$/ }).click();
  await page.getByRole("button", { name: "Mesclar", exact: true }).click();
  await expect(page.getByText("Produtos mesclados.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Possíveis duplicados/ })).toHaveCount(0);
  await expect(itens).toHaveCount(1); // sem o aviso, e um produto só
  semViolacaoDeCsp(erros);
});
