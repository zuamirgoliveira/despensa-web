import { expect, test } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole } from "./util";

const fundo = (page: import("@playwright/test").Page) => page.evaluate(() => getComputedStyle(document.querySelector("div.bg-fundo")!).backgroundColor);

test.describe("tema", () => {
  test("padrão é Sistema: segue o aparelho, sem atributo data-tema", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-tema", /.+/);
    expect(await fundo(page)).toBe("rgb(6, 15, 38)");
    await page.emulateMedia({ colorScheme: "light" });
    expect(await fundo(page)).toBe("rgb(244, 246, 250)");
  });

  test("escolha em Ajustes vale na hora, persiste ao recarregar e sem flash", async ({ page }) => {
    const { erros } = vigiarConsole(page);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/ajustes");
    await page.getByRole("radio", { name: /Escuro/ }).check();
    await expect(page.locator("html")).toHaveAttribute("data-tema", "escuro");
    expect(await fundo(page)).toBe("rgb(6, 15, 38)");
    expect(await page.evaluate(() => localStorage.getItem("despensa-tema"))).toBe("escuro");

    // o atributo já existe na primeira pintura: theme-init.js roda antes da hidratação
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-tema", "escuro");
    await expect(page.getByRole("radio", { name: /Escuro/ })).toBeChecked();

    // escolher Claro com o aparelho no escuro
    await page.emulateMedia({ colorScheme: "dark" });
    await page.getByRole("radio", { name: /Claro/ }).check();
    expect(await fundo(page)).toBe("rgb(244, 246, 250)");

    // voltar a Sistema remove a escolha
    await page.getByRole("radio", { name: /Sistema/ }).check();
    await expect(page.locator("html")).not.toHaveAttribute("data-tema", /.+/);
    expect(await page.evaluate(() => localStorage.getItem("despensa-tema"))).toBeNull();
    semViolacaoDeCsp(erros);
  });
});

test.describe("layout em telas largas", () => {
  test("a coluna tem no máximo 640 px e fica centralizada", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const caixa = await page.locator("div.bg-fundo").first().boundingBox();
    expect(caixa).not.toBeNull();
    expect(caixa!.width).toBeLessThanOrEqual(640);
    expect(Math.abs(caixa!.x + caixa!.width / 2 - 640)).toBeLessThanOrEqual(1);
    const nav = await page.getByRole("navigation", { name: "Principal" }).boundingBox();
    expect(nav!.width).toBeLessThanOrEqual(640);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
});
