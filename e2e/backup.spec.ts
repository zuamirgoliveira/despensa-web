import { readFileSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { abrirSecao, pularEstimativa, restaurarBackupPelaTela, semViolacaoDeCsp, vigiarConsole } from "./util";

const NOTA = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");

async function importarNota(page: Page) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(NOTA);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: /Salvar compra|Substituir compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
}

/** Seed de 3 meses (12 compras) com a posição de casa preenchida. */
async function seed(): Promise<Buffer> {
  // @ts-expect-error módulo .mjs de script, sem tipos
  const { gerarSeed } = await import("../scripts/seed-dev.mjs");
  const s = gerarSeed(new Date());
  s.colecoes.perfis[0].localizacaoCasa = { lat: -8.063, lng: -34.871 };
  return Buffer.from(JSON.stringify(s));
}

/** Aparelho novo e vazio (outro contexto = outro IndexedDB) com uma cópia v2 baixada do seed. */
async function copiaV2DoSeed(browser: Browser, caminho: string): Promise<void> {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const p = await ctx.newPage();
  await p.goto("/ajustes");
  await restaurarBackupPelaTela(p, { name: "seed.json", mimeType: "application/json", buffer: await seed() });
  const baixa = p.waitForEvent("download");
  await p.getByRole("button", { name: "Baixar o arquivo" }).click();
  await (await baixa).saveAs(caminho);
  await ctx.close();
}

/** Simula o menu de compartilhar do Android: guarda o arquivo recebido em window.__recebido. */
async function simularCompartilhar(page: Page, comportamento: "ok" | "cancelar"): Promise<void> {
  await page.addInitScript((c) => {
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d: { files: File[] }) => {
        if (c === "cancelar") throw new DOMException("cancelado", "AbortError");
        (window as unknown as { __recebido: { nome: string; texto: Promise<string> } }).__recebido = { nome: d.files[0].name, texto: d.files[0].text() };
      },
    });
  }, comportamento);
}

test("lembrete no Início: sem cópia lembra; depois de guardar o lembrete some e Ajustes mostra a data", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await page.goto("/");
  await expect(page.getByLabel("Lembrete de cópia de segurança")).toHaveCount(0); // sem compras não há o que perder
  await importarNota(page);
  await page.goto("/");
  const lembrete = page.getByLabel("Lembrete de cópia de segurança");
  await expect(lembrete).toContainText("Você ainda não guardou nenhuma cópia de segurança");

  const baixa = page.waitForEvent("download"); // sem menu de compartilhar neste navegador: baixa o arquivo
  await lembrete.getByRole("button", { name: "Guardar cópia agora" }).click();
  expect((await baixa).suggestedFilename()).toMatch(/^despensa-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(lembrete).toHaveCount(0);

  await page.goto("/ajustes");
  await expect(page.getByLabel("Última cópia")).toContainText(/Última cópia: \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} \(hoje\)/);
  semViolacaoDeCsp(erros);
});

test("guardar pelo menu de compartilhar: entrega a cópia íntegra e registra; cancelar não conta", async ({ page }) => {
  await simularCompartilhar(page, "ok");
  await importarNota(page);
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Guardar uma cópia de segurança" }).click();
  await expect(page.getByText(/Cópia compartilhada em .*Confira se ela chegou/)).toBeVisible();
  await expect(page.getByLabel("Última cópia")).toContainText("(hoje)");
  const recebido = await page.evaluate(async () => {
    const r = (window as unknown as { __recebido: { nome: string; texto: Promise<string> } }).__recebido;
    return { nome: r.nome, json: JSON.parse(await r.texto) };
  });
  expect(recebido.nome).toMatch(/^despensa-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(recebido.json).toMatchObject({ versao: 3, meta: { contagens: { compras: 1, produtos: 16 } } });
  expect(JSON.stringify(recebido.json)).not.toMatch(/cpf/i);
});

test("fechar o menu de compartilhar não conta como cópia feita", async ({ page }) => {
  await simularCompartilhar(page, "cancelar");
  await importarNota(page);
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Guardar uma cópia de segurança" }).click();
  await expect(page.getByText("Você ainda não guardou nenhuma cópia.")).toBeVisible();
  await expect(page.getByText(/Cópia compartilhada/)).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByLabel("Lembrete de cópia de segurança")).toBeVisible();
});

test("a posição de casa vai por padrão e pode ser deixada de fora", async ({ page }) => {
  await page.goto("/ajustes");
  await restaurarBackupPelaTela(page, { name: "seed.json", mimeType: "application/json", buffer: await seed() });
  const baixar = async () => {
    const baixa = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar o arquivo" }).click();
    return JSON.parse(readFileSync((await (await baixa).path()) as string, "utf8"));
  };
  const com = await baixar();
  expect(com.colecoes.perfis[0].localizacaoCasa).toEqual({ lat: -8.063, lng: -34.871 });
  expect(com.meta.incluiPosicaoDeCasa).toBe(true);

  await page.getByLabel("Incluir a posição de casa na cópia").uncheck();
  const sem = await baixar();
  expect(sem.colecoes.perfis[0].localizacaoCasa).toBeUndefined();
  expect(sem.meta.incluiPosicaoDeCasa).toBe(false);
});

test("armazenamento protegido: a tela informa o estado", async ({ page }) => {
  await page.goto("/ajustes");
  await abrirSecao(page, "Sobre a proteção dos dados");
  await expect(page.getByLabel("Armazenamento protegido")).toContainText(/Armazenamento protegido pelo navegador: (sim|não|indisponível)/);
});

test("aparelho novo: conferência da cópia e restauração direta", async ({ browser }, info) => {
  const caminho = info.outputPath("copia.json");
  await copiaV2DoSeed(browser, caminho);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const { erros } = vigiarConsole(page);
  await page.goto("/ajustes");
  await page.getByLabel("Arquivo de backup").setInputFiles(caminho);
  const conferencia = page.getByLabel("Conferir a cópia");
  await expect(conferencia).toContainText("12 compras");
  await expect(conferencia).toContainText("Arquivo íntegro e compatível");
  await expect(conferencia).toContainText("Compras de");
  await expect(conferencia.getByRole("button", { name: /^Mesclar/ })).toHaveCount(0); // aparelho vazio: sem perguntas
  await conferencia.getByRole("button", { name: "Restaurar", exact: true }).click();
  await expect(page.getByText(/^Restaurado: 12 compras/)).toBeVisible();
  await expect(page.getByLabel("Última cópia")).toContainText("(hoje)"); // a data da cópia restaurada
  await page.goto("/compras");
  await expect(page.getByRole("button", { name: "Apagar compra" })).toHaveCount(12);
  semViolacaoDeCsp(erros);
  await ctx.close();
});

test("verificar sem aplicar: fechar a conferência não muda nada", async ({ page }) => {
  await importarNota(page);
  await page.goto("/ajustes");
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "seed.json", mimeType: "application/json", buffer: await seed() });
  await expect(page.getByLabel("Conferir a cópia")).toBeVisible();
  await page.getByRole("button", { name: "Fechar sem restaurar" }).click();
  await expect(page.getByLabel("Conferir a cópia")).toHaveCount(0);
  await page.goto("/compras");
  await expect(page.getByRole("button", { name: "Apagar compra" })).toHaveCount(1);
});

test("aparelho com dados: sempre pergunta; mesclar mantém o que só existe aqui", async ({ page }) => {
  await importarNota(page); // 1 compra só deste aparelho
  await page.goto("/ajustes");
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "seed.json", mimeType: "application/json", buffer: await seed() });
  const conferencia = page.getByLabel("Conferir a cópia");
  await expect(conferencia.getByRole("group", { name: "O que fazer com o que já está neste aparelho" })).toBeVisible();
  await expect(conferencia.getByRole("button", { name: "Restaurar", exact: true })).toHaveCount(0);
  await conferencia.getByRole("button", { name: /^Mesclar/ }).click();

  const dialogo = page.getByRole("dialog", { name: "Mesclar a cópia com este aparelho?" });
  await expect(dialogo).toContainText("é mantido");
  await expect(dialogo).toContainText("1 compra");
  await dialogo.getByRole("button", { name: "Cancelar" }).click(); // cancelar não aplica nada
  await expect(page.getByText(/^Restaurado:/)).toHaveCount(0);

  await conferencia.getByRole("button", { name: /^Mesclar/ }).click();
  await dialogo.getByRole("button", { name: "Mesclar", exact: true }).click();
  await expect(page.getByText(/^Restaurado: 12 compras/)).toBeVisible();
  await page.goto("/compras");
  await expect(page.getByRole("button", { name: "Apagar compra" })).toHaveCount(13); // 12 da cópia + a daqui
});

test("substituir tudo: confirmação dupla, 'Entendi' obrigatório e o que só existia aqui é apagado", async ({ page }) => {
  await importarNota(page);
  await page.goto("/ajustes");
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "seed.json", mimeType: "application/json", buffer: await seed() });
  await page.getByLabel("Conferir a cópia").getByRole("button", { name: /^Substituir tudo/ }).click();

  const primeira = page.getByRole("dialog", { name: "Substituir tudo deste aparelho?" });
  await expect(primeira).toContainText("será apagado");
  await primeira.getByRole("button", { name: "Continuar" }).click();

  const ultima = page.getByRole("dialog", { name: "Última confirmação" });
  await expect(ultima).toContainText("não tem volta");
  const apagar = ultima.getByRole("button", { name: "Apagar e restaurar" });
  await expect(apagar).toBeDisabled(); // sem marcar "Entendi" não dá para seguir
  await ultima.getByLabel(/Entendi que isto apaga/).check();
  await expect(apagar).toBeEnabled();
  await apagar.click();

  await expect(page.getByText(/^Restaurado: 12 compras/)).toBeVisible();
  await page.goto("/compras");
  await expect(page.getByRole("button", { name: "Apagar compra" })).toHaveCount(12); // a compra da nota daqui foi apagada
});

test("na última confirmação dá para guardar uma cópia do que está aqui antes de apagar", async ({ page }) => {
  await importarNota(page);
  await page.goto("/ajustes");
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "seed.json", mimeType: "application/json", buffer: await seed() });
  await page.getByLabel("Conferir a cópia").getByRole("button", { name: /^Substituir tudo/ }).click();
  await page.getByRole("dialog", { name: "Substituir tudo deste aparelho?" }).getByRole("button", { name: "Continuar" }).click();
  const ultima = page.getByRole("dialog", { name: "Última confirmação" });
  const baixa = page.waitForEvent("download");
  await ultima.getByRole("button", { name: "Guardar uma cópia do que está aqui agora" }).click();
  const arquivo = JSON.parse(readFileSync((await (await baixa).path()) as string, "utf8"));
  expect(arquivo.colecoes.compras).toHaveLength(1); // a cópia de segurança é do que está no aparelho agora
  await expect(ultima).toContainText("Cópia de segurança guardada.");
});

test("arquivo adulterado, cortado ou de versão nova: bloqueia e não mexe no aparelho", async ({ browser, page }, info) => {
  const caminho = info.outputPath("copia.json");
  await copiaV2DoSeed(browser, caminho);
  await importarNota(page);
  await page.goto("/ajustes");

  // adulterado: valor de uma compra mudou depois de gerado
  const arq = JSON.parse(readFileSync(caminho, "utf8"));
  arq.colecoes.compras[0].valorTotalCentavos += 1;
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "adulterado.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(arq)) });
  const conferencia = page.getByLabel("Conferir a cópia");
  await expect(conferencia).toContainText("incompleto ou foi alterado");
  await expect(conferencia.getByRole("button", { name: /^(Restaurar|Mesclar|Substituir tudo)/ })).toHaveCount(0);
  await conferencia.getByRole("button", { name: "Fechar sem restaurar" }).click();

  // cortado
  const bruto = readFileSync(caminho, "utf8");
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "cortado.json", mimeType: "application/json", buffer: Buffer.from(bruto.slice(0, bruto.length / 2)) });
  await expect(page.getByText(/não é um JSON válido/)).toBeVisible();

  // versão mais nova
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "futuro.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...arq, versao: 99 })) });
  await expect(page.getByText(/mais nova que a suportada/)).toBeVisible();

  await page.goto("/compras");
  await expect(page.getByRole("button", { name: "Apagar compra" })).toHaveCount(1); // intacto
});

test("cópia antiga (v1, sem soma): abre com aviso e restaura", async ({ page }) => {
  await page.goto("/ajustes");
  await page.getByLabel("Arquivo de backup").setInputFiles("tests/fixtures/backups/v1-seed.json");
  await expect(page.getByLabel("Conferir a cópia")).toContainText("Arquivo de uma versão antiga do app");
  await expect(page.getByLabel("Conferir a cópia")).toContainText("não tem a posição de casa");
});
