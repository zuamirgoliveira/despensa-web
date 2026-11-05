import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole, pularEstimativa, irParaTela } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

async function importarNota(page: Page) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra|Substituir compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
}

const produto = (page: Page, nome: string) => page.getByRole("listitem").filter({ hasText: nome }).first();

test("catálogo vazio orienta a importar uma nota", async ({ page }) => {
  await page.goto("/catalogo");
  await expect(page.getByText("O catálogo está vazio")).toBeVisible();
});

test("a nota popula o catálogo; busca, edição de meta, arquivar e mesclar", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await importarNota(page);
  await irParaTela(page, "Catálogo");

  await expect(page.getByRole("heading", { name: "Hortifruti" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /· Hortifruti semanal/ })).toHaveCount(16);

  // busca (sem acento nem caixa)
  await page.getByLabel("Buscar produto").fill("MELAO");
  await expect(page.getByRole("listitem").filter({ hasText: /· Hortifruti semanal/ })).toHaveCount(1);
  await page.getByLabel("Buscar produto").fill("zzz");
  await expect(page.getByText("Nenhum produto encontrado.")).toBeVisible();
  await page.getByLabel("Buscar produto").fill("melao");

  // editar meta: fica fixada
  const melao = produto(page, "Melao Japones");
  await melao.getByText("Melao Japones").first().click();
  await expect(melao.getByText("Calculada pela média das compras.")).toBeVisible();
  await melao.getByLabel(/^Meta/).fill("3,5");
  await melao.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByText("Produto salvo.")).toBeVisible();
  await expect(melao.getByText(/3,5 kg/)).toBeVisible();
  await expect(melao.getByText("Meta fixada por você: não muda mais com as compras.")).toBeVisible();
  await melao.getByRole("button", { name: "Meta automática" }).click();
  await expect(melao.getByText("Calculada pela média das compras.")).toBeVisible();
  await expect(melao.getByText(/1,26 kg/)).toBeVisible();

  // validação por campo
  await melao.getByLabel("Nome").fill("");
  await melao.getByRole("button", { name: "Salvar produto" }).click();
  await expect(melao.getByText("Informe o nome do produto.")).toBeVisible();
  await melao.getByLabel("Nome").fill("Melão");
  await melao.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Melão" }).first()).toBeVisible();

  // arquivar some da lista; "Mostrar arquivados" traz de volta
  await page.getByLabel("Buscar produto").fill("");
  // o detalhe do Melão continua aberto desde a edição
  await produto(page, "Melão").getByRole("button", { name: "Arquivar" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: /· Hortifruti semanal/ })).toHaveCount(15);
  await page.getByLabel("Mostrar arquivados").check();
  await expect(page.getByRole("listitem").filter({ hasText: /· Hortifruti semanal/ })).toHaveCount(16);
  await expect(produto(page, "Melão").getByText("arquivado")).toBeVisible();
  await produto(page, "Melão").getByText("Melão").first().click(); // reabre o detalhe (o item foi remontado)
  await produto(page, "Melão").getByRole("button", { name: "Desarquivar" }).click();
  await page.getByLabel("Mostrar arquivados").uncheck();

  // mesclar Melão em Banana Prata (o detalhe continua aberto)
  await produto(page, "Melão").getByRole("button", { name: "Mesclar com outro" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Mesclar em").selectOption({ label: "Banana Prata" });
  await dialogo.getByRole("button", { name: "Mesclar" }).click();
  await expect(page.getByText("Produtos mesclados.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: /· Hortifruti semanal/ })).toHaveCount(15);

  // o histórico de preços da compra agora mostra os dois itens sob Banana Prata
  await irParaTela(page, "Preços");
  const banana = page.getByRole("listitem").filter({ hasText: "Banana Prata" }).first();
  await banana.getByText("Banana Prata").first().click();
  await expect(banana.getByText(/04\/11\/2026/)).toHaveCount(2);
  semViolacaoDeCsp(erros);
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
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "seed.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(seed)) });
  await expect(page.getByText(/Importado:/)).toBeVisible();

  await page.goto("/catalogo");
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
