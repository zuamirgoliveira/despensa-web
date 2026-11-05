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
  // chave real (fixture Cia Santos) com o último dígito digitado como 8 em vez de 0
  await campo.fill("2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8728");
  await expect(page.getByText("Dígito verificador não confere")).toBeVisible();
  const grupo = page.getByRole("group", { name: "Correções possíveis" });
  await expect(grupo).toBeVisible();
  await expect(campo).toHaveValue("2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8728"); // não mudou sozinho
  await grupo.getByRole("button", { name: "Grupo 11, dígito 4: trocar 8 por 0" }).click();
  await expect(campo).toHaveValue(CHAVE_ESPACADA);
  await expect(page.getByText(/Chave válida: nota 68903, série 2/)).toBeVisible();
  await expect(grupo).toBeHidden();
  semViolacaoDeCsp(erros);
});

test("campo da chave: editar no meio mantém o cursor (apagar e digitar no meio de um grupo)", async ({ page }) => {
  await page.goto("/importar");
  const campo = page.getByLabel("Chave de acesso (44 dígitos)");
  await campo.fill(CHAVE_ESPACADA);
  // cursor no meio do grupo 3 ("8682"→ aqui "8682" é o grupo 3): depois do 1º dígito
  await campo.press("Home");
  for (let i = 0; i < 2 * 5 + 1; i++) await campo.press("ArrowRight"); // 2 grupos + espaços + 1 dígito
  await campo.press("Backspace"); // apaga o '8' do grupo 3
  await expect(campo).toHaveValue("2626 1108 6823 1000 6386 5002 0000 6890 3102 0778 720");
  await campo.press("8"); // digita no mesmo lugar (o cursor não foi para o fim)
  await expect(campo).toHaveValue(CHAVE_ESPACADA);
  await expect(page.getByText(/Chave válida: nota 68903/)).toBeVisible();
  // apagar cruzando o espaço: cursor no início do grupo 11 e Backspace apaga o último dígito do grupo 10
  await campo.press("Home");
  for (let i = 0; i < 10 * 5; i++) await campo.press("ArrowRight");
  await campo.press("Backspace");
  await expect(campo).toHaveValue("2626 1108 8682 3100 0638 6500 2000 0689 0310 2078 720"); // o 7 do grupo 10 saiu e o resto reagrupou
});

test("conferência sugere o produto parecido (outro tamanho) e o usuário escolhe; nada une sozinho", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  // catálogo prévio com "Alho Redinha 500g"; a nota traz "ALHO REDINHA PCT 180" (sem o mesmo tamanho)
  // @ts-expect-error módulo .mjs de script, sem tipos
  const { gerarSeed } = await import("../scripts/seed-dev.mjs");
  const seed = gerarSeed(new Date());
  seed.colecoes.produtos.push({ ...seed.colecoes.produtos[0], id: "00000000-0000-4000-8000-000000000a1c", nome: "Alho Redinha 500g" });
  await page.goto("/ajustes");
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "seed.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(seed)) });
  await expect(page.getByText(/Importado:/)).toBeVisible();

  await page.goto("/importar");
  await lerNota(page, NOTA);
  await expect(page.getByText("Li 16 itens.")).toBeVisible();
  const alho = page.getByRole("group", { name: "Produtos parecidos com Alho Redinha" });
  const campoAlho = page.getByRole("listitem").filter({ hasText: "ALHO REDINHA" }).getByLabel("Nome do produto");
  await expect(alho).toBeVisible();
  await expect(campoAlho).toHaveValue("Alho Redinha"); // não trocou sozinho
  await alho.getByRole("button", { name: "Usar “Alho Redinha 500g” (outro tamanho)" }).click();
  await expect(campoAlho).toHaveValue("Alho Redinha 500g");
  await page.getByRole("button", { name: "Salvar compra" }).click();
  // com a casa do seed já cadastrada a estimativa pode seguir sem perguntar
  await page.getByRole("button", { name: "Decidir depois" }).click({ timeout: 3000 }).catch(() => undefined);
  await expect(page).toHaveURL(/\/compras$/);

  // o catálogo ficou com um único alho (o existente), não dois
  await page.goto("/catalogo");
  await expect(page.getByRole("listitem").filter({ hasText: "Alho Redinha" })).toHaveCount(1);
  await expect(page.getByRole("listitem").filter({ hasText: "Alho Redinha 500g" })).toHaveCount(1);
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
