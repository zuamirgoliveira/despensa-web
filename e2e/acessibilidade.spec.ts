import { expect, test, type Page } from "@playwright/test";

const ROTAS = ["/", "/importar", "/lista", "/compras", "/catalogo", "/precos", "/gastos", "/painel", "/mercados", "/ajustes", "/conferencia"];

/** Nome acessível aproximado: aria-label, aria-labelledby, label associado, texto ou title. */
async function semNomeAcessivel(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ruins: string[] = [];
    const nome = (el: Element): string => {
      const h = el as HTMLElement;
      const label = h.getAttribute("aria-label");
      if (label) return label;
      const por = h.getAttribute("aria-labelledby");
      if (por) return por.split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
      if ("labels" in h && (h as HTMLInputElement).labels?.length) return Array.from((h as HTMLInputElement).labels ?? []).map((l) => l.textContent).join(" ");
      return (h.textContent ?? "").trim() || h.getAttribute("title") || "";
    };
    document.querySelectorAll("button, a[href], input:not([hidden]):not([type=hidden]), select, textarea").forEach((el) => {
      const h = el as HTMLElement;
      if (h.hidden || h.closest("[hidden]") || getComputedStyle(h).display === "none") return;
      if (!nome(el).trim()) ruins.push(`${el.tagName.toLowerCase()}${(el as HTMLInputElement).type ? `[${(el as HTMLInputElement).type}]` : ""}: ${h.outerHTML.slice(0, 80)}`);
    });
    return ruins;
  });
}

/** Alvos de toque visíveis menores que 44 px (para o rótulo ao redor, no caso de checkbox). */
async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ruins: string[] = [];
    document.querySelectorAll("button, a[href], select, input:not([type=hidden]):not([hidden]), textarea, summary").forEach((el) => {
      const h = el as HTMLElement;
      if (getComputedStyle(h).display === "none" || h.closest("[hidden]") || h.closest("dialog:not([open])")) return;
      const alvo = h.tagName === "INPUT" && ((h as HTMLInputElement).type === "checkbox" || (h as HTMLInputElement).type === "radio") ? (h.closest("label") ?? h) : h;
      const r = alvo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.height < 43.5 || r.width < 43.5) ruins.push(`${h.tagName.toLowerCase()} "${(h.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    });
    return ruins;
  });
}

test.describe("acessibilidade e toque (390×844)", () => {
  for (const esquema of ["light", "dark"] as const) {
    for (const rota of ROTAS) {
      test(`${rota} (${esquema}): idioma, título, rótulos e alvos de toque`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: esquema });
        await page.goto(rota);
        await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
        await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /width=device-width/);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await page.waitForLoadState("networkidle");
        expect(await semNomeAcessivel(page)).toEqual([]);
        expect(await alvosPequenos(page)).toEqual([]);
        // sem rolagem horizontal no celular
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      });
    }
  }

  test("360×640: sem rolagem horizontal em todas as rotas", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    for (const rota of ROTAS) {
      await page.goto(rota);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), rota).toBe(true);
    }
  });

  test("foco visível e navegação por teclado na barra inferior", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const foco = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return { tag: el.tagName, contorno: s.outlineStyle !== "none" || s.boxShadow !== "none" };
    });
    expect(foco.tag).toBe("A");
    const nav = page.getByRole("navigation", { name: "Principal" });
    await nav.getByRole("button", { name: "Mais" }).focus();
    await page.keyboard.press("Enter");
    await expect(nav.getByRole("link", { name: "Gastos" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(nav.getByRole("link", { name: "Gastos" })).toBeHidden();
  });
});
