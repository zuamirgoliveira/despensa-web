import { expect, type Page } from "@playwright/test";

/** Falha o teste se aparecer violação de CSP (ou erro de console) durante o uso. */
export function vigiarConsole(page: Page): { erros: string[] } {
  const erros: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || /Content Security Policy/i.test(m.text())) erros.push(m.text());
  });
  page.on("pageerror", (e) => erros.push(e.message));
  return { erros };
}

export function semViolacaoDeCsp(erros: string[]): void {
  expect(erros.filter((e) => /Content Security Policy/i.test(e))).toEqual([]);
}

/** Depois de salvar uma nota de mercado novo a tela pergunta a distância da ida; os testes seguem sem responder. */
export async function pularEstimativa(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Decidir depois" }).click();
}

/** Vai para uma tela pela navegação: na barra, ou pelo menu "Mais" quando não cabe nela. */
export async function irParaTela(page: Page, nome: string): Promise<void> {
  const nav = page.getByRole("navigation", { name: "Principal" });
  const naBarra = nav.getByRole("link", { name: nome, exact: true });
  if (await naBarra.isVisible()) return naBarra.click();
  await nav.getByRole("button", { name: "Mais" }).click();
  await nav.getByRole("link", { name: nome, exact: true }).click();
}

type ArquivoBackup = string | { name: string; mimeType: string; buffer: Buffer };

/**
 * Restaura uma cópia pela tela (Ajustes → Restaurar ou verificar uma cópia), cumprindo as confirmações.
 * Aparelho vazio: "Restaurar". Com dados: escolhe o modo (padrão: mesclar); "substituir" passa pela
 * confirmação dupla e marca "Entendi".
 */
export async function restaurarBackupPelaTela(page: Page, arquivo: ArquivoBackup, modo: "mesclar" | "substituir" = "mesclar"): Promise<void> {
  await page.getByLabel("Arquivo de backup").setInputFiles(arquivo);
  const conferencia = page.getByLabel("Conferir a cópia");
  await expect(conferencia).toBeVisible();
  const direto = conferencia.getByRole("button", { name: "Restaurar", exact: true });
  if (await direto.count()) {
    await direto.click();
  } else if (modo === "mesclar") {
    await conferencia.getByRole("button", { name: /^Mesclar/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Mesclar", exact: true }).click();
  } else {
    await conferencia.getByRole("button", { name: /^Substituir tudo/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("dialog").getByLabel(/Entendi que isto apaga/).check();
    await page.getByRole("dialog").getByRole("button", { name: "Apagar e restaurar" }).click();
  }
  await expect(page.getByText(/^Restaurado:/)).toBeVisible();
}

/**
 * Prepara a despensa para testes que dependem da lista da casa: todos os itens viram recorrentes e zerados
 * (a lista é "recorrentes zerados ou abaixo do padrão"). Escreve direto no IndexedDB e recarrega a página;
 * é só semente de teste, os fluxos de tela têm seus próprios testes.
 */
export async function prepararDespensa(page: Page, opcoes: { zerar?: boolean } = {}): Promise<void> {
  const zerar = opcoes.zerar ?? true;
  await page.waitForURL((u) => !u.pathname.startsWith("/importar")); // espera a navegação de depois de salvar a nota
  await page.evaluate(async (zerarTudo) => {
    const db = await new Promise<IDBDatabase>((ok, erro) => {
      const r = indexedDB.open("despensa");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error);
    });
    await new Promise<void>((ok, erro) => {
      const tx = db.transaction(["produtos", "estoques"], "readwrite");
      const produtos = tx.objectStore("produtos");
      produtos.getAll().onsuccess = (e) => {
        for (const p of (e.target as IDBRequest).result) produtos.put({ ...p, recorrente: true });
      };
      if (zerarTudo) {
        const estoques = tx.objectStore("estoques");
        estoques.getAll().onsuccess = (e) => {
          for (const s of (e.target as IDBRequest).result) estoques.put({ ...s, quantidade: 0, nivel: "acabou", quantidadeExata: undefined });
        };
      }
      tx.oncomplete = () => ok();
      tx.onerror = () => erro(tx.error);
    });
    db.close();
  }, zerar);
  await page.reload();
}

/** Deixa a quantidade de todos os itens "sem confirmação há meses" (entram na revisão da despensa). Semente de teste, via IndexedDB. */
export async function envelhecerEstoques(page: Page): Promise<void> {
  await page.waitForURL((u) => !u.pathname.startsWith("/importar"));
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, erro) => {
      const r = indexedDB.open("despensa");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error);
    });
    await new Promise<void>((ok, erro) => {
      const tx = db.transaction("estoques", "readwrite");
      const estoques = tx.objectStore("estoques");
      estoques.getAll().onsuccess = (e) => {
        for (const s of (e.target as IDBRequest).result) estoques.put({ ...s, confirmadoEm: "2026-01-10T10:00:00.000Z" });
      };
      tx.oncomplete = () => ok();
      tx.onerror = () => erro(tx.error);
    });
    db.close();
  });
}

/** Abre uma seção recolhível de Ajustes (Regras, Custo da ida, Sobre a proteção…) pelo texto do título, se estiver fechada. */
export async function abrirSecao(page: Page, titulo: string | RegExp): Promise<void> {
  const secao = page.locator("details", { has: page.locator("summary", { hasText: titulo }) });
  if (!(await secao.evaluate((d) => (d as HTMLDetailsElement).open))) await secao.locator("summary").click();
}
