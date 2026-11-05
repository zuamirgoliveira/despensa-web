import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole } from "./util";

const CHAVE_ESPACADA = "2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720";
const FOTO_REAL = "tests/fixtures/foto-nota-real.jpeg";
const campo = (page: Page) => page.getByLabel("Chave de acesso (44 dígitos)");
const enviar = (page: Page, arquivo: string) => page.getByLabel("Enviar imagem da nota").setInputFiles(arquivo);

test("QR em imagem enviada preenche a chave e oferece o link do QR", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await page.goto("/importar");
  await enviar(page, "tests/fixtures/fotos/qr-nota.png");
  await expect(page.getByText("QR Code encontrado na imagem.")).toBeVisible();
  await expect(campo(page)).toHaveValue(CHAVE_ESPACADA);
  await expect(page.getByRole("button", { name: /Abrir o link do QR/ })).toBeVisible();
  await expect(page.getByAltText("Prévia da foto da nota")).toBeVisible();
  semViolacaoDeCsp(erros);
});

test("câmera ao vivo (vídeo falso com QR) preenche a chave e desliga a câmera", async ({ page }) => {
  test.skip(!existsSync("test-results/camera-qr.y4m"), "ffmpeg não disponível para gerar o vídeo falso");
  const { erros } = vigiarConsole(page);
  await page.goto("/importar");
  await page.getByRole("button", { name: "Escanear QR" }).click();
  await expect(page.getByText("QR Code lido.")).toBeVisible({ timeout: 15_000 });
  await expect(campo(page)).toHaveValue(CHAVE_ESPACADA);
  // a câmera foi parada: o vídeo some e não há trilhas ativas
  await expect(page.locator("video")).toHaveCount(0);
  semViolacaoDeCsp(erros);
});

test("fechar a câmera desliga o stream", async ({ page }) => {
  test.skip(!existsSync("test-results/camera-qr.y4m"), "ffmpeg não disponível para gerar o vídeo falso");
  await page.goto("/importar");
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as unknown as { __trilhas: MediaStreamTrack[] }).__trilhas = [];
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await original(c);
      (window as unknown as { __trilhas: MediaStreamTrack[] }).__trilhas.push(...s.getTracks());
      return s;
    };
  });
  await page.getByRole("button", { name: "Escanear QR" }).click();
  await expect(page.locator("video")).toBeVisible();
  await page.getByRole("button", { name: "Fechar câmera" }).click();
  // mesmo que a câmera ainda estivesse abrindo ao fechar, todas as trilhas acabam encerradas
  await expect
    .poll(() =>
      page.evaluate(() => {
        const t = (window as unknown as { __trilhas: MediaStreamTrack[] }).__trilhas;
        return t.length > 0 && t.every((x) => x.readyState === "ended");
      }),
    )
    .toBe(true);
});

test("foto real da nota: chave correta (exata ou candidata única)", async ({ page }) => {
  test.skip(!existsSync(FOTO_REAL), "foto real não versionada: coloque em tests/fixtures/foto-nota-real.jpeg");
  test.setTimeout(180_000);
  const { erros } = vigiarConsole(page);
  await page.goto("/importar");
  await enviar(page, FOTO_REAL);
  const preenchido = page.getByText(/Chave válida: nota 68903/);
  const candidatas = page.getByRole("group", { name: "Chaves candidatas" });
  await expect(preenchido.or(candidatas)).toBeVisible({ timeout: 150_000 });
  if (await candidatas.isVisible()) {
    const botoes = candidatas.getByRole("button");
    await expect(botoes).toHaveCount(1);
    await expect(botoes.first()).toContainText(CHAVE_ESPACADA);
    await expect(campo(page)).toHaveValue(""); // nunca preenche sozinho a partir de candidatas
    await botoes.first().click();
  }
  await expect(campo(page)).toHaveValue(CHAVE_ESPACADA);
  semViolacaoDeCsp(erros);
});

test("nota de impressão pontilhada (foto real, sem QR): não adivinha; oferece a leitura aproximada para corrigir", async ({ page }) => {
  test.setTimeout(180_000);
  const { erros } = vigiarConsole(page);
  await page.goto("/importar");
  await enviar(page, "tests/fixtures/fotos/nota-pontilhada.png");
  const aproximada = page.getByRole("group", { name: "Leitura aproximada" });
  const candidatas = page.getByRole("group", { name: "Chaves candidatas" });
  const certa = page.getByText(/Chave válida: nota 123854/);
  await expect(aproximada.or(candidatas).or(certa)).toBeVisible({ timeout: 150_000 });
  if (await aproximada.isVisible()) {
    await expect(campo(page)).toHaveValue(""); // nunca preenche sozinho
    await aproximada.getByRole("button", { name: "Usar para corrigir" }).click();
    const digitos = (await campo(page).inputValue()).replace(/\D/g, "");
    expect(digitos.length).toBeGreaterThanOrEqual(36);
    await expect(page.getByText(/Dígito verificador não confere|\/44 dígitos|CNPJ|modelo/).first()).toBeVisible(); // ainda é inválida
  }
  semViolacaoDeCsp(erros);
});

for (const [nome, arquivo] of [
  ["ruído", "ruido.png"],
  ["chave com dígito verificador errado", "chave-dv-invalido.png"],
  ["texto sem chave", "sem-chave.png"],
] as const) {
  test(`imagem ruim (${nome}) nunca preenche a chave`, async ({ page }) => {
    test.setTimeout(180_000);
    const { erros } = vigiarConsole(page);
    await page.goto("/importar");
    await enviar(page, `tests/fixtures/fotos/${arquivo}`);
    const fim = page
      .getByText(/Não encontrei a chave|Li números demais|Escolha a chave|Li a chave na foto|QR Code encontrado/)
      .first();
    await expect(fim).toBeVisible({ timeout: 150_000 });
    // jamais uma chave errada: ou o campo fica vazio, ou (se algo foi lido) só a chave certa
    const valor = await campo(page).inputValue();
    expect(valor === "" || valor === CHAVE_ESPACADA).toBe(true);
    semViolacaoDeCsp(erros);
  });
}
