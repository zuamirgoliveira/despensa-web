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
