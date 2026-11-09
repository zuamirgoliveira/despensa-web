import { expect, test } from "@playwright/test";
import { pularEstimativa, semViolacaoDeCsp, vigiarConsole } from "./util";

const CHAVE = "26261120300157005613651290000538591088539888";
const URL_QR = `https://nfce.sefaz.pe.gov.br:444/nfce-web/consultarNFCe?p=${CHAVE}|2|1|1|A889BEB8C3F7BD9C6FBCD31ABE7502218F4123B1`;

// resposta SIMULADA do proxy: os testes nunca chamam a SEFAZ real
const RESULTADO = {
  nota: {
    loja: { nome: "MERCADO TESTE", cnpj: "20300157005613", endereco: "AVENIDA TESTE, 10, CASA CAIADA, OLINDA, PE" },
    itens: [
      { descricao: "REFRI COCA COLA ZERO 2L PET", codigo: "11976", quantidade: 1, unidade: "UNID", valorUnitarioCentavos: 1098, valorTotalCentavos: 1098 },
      { descricao: "CENOURA", codigo: "52", quantidade: 0.42, unidade: "KG", valorUnitarioCentavos: 350, valorTotalCentavos: 147 },
    ],
    numero: 53859,
    serie: 129,
    emissao: "2026-11-07T19:43:53",
    protocolo: null,
    chave: CHAVE,
    totalItens: 2,
    valorPagarCentavos: 1245,
    somaItensCentavos: 1245,
    pagamento: "Cartão de Crédito",
    cpfNaNota: false,
  },
  avisos: [],
  erros: [],
};

test("QR compartilhado com o app: busca a nota sozinho, sem captcha nem colar texto", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  const corpos: unknown[] = [];
  await page.route("**/api/nfce", (route) => {
    corpos.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RESULTADO) });
  });
  await page.goto(`/importar?text=${encodeURIComponent(URL_QR)}`);
  await expect(page.getByText("Nota buscada na SEFAZ")).toBeVisible();
  await expect(page.getByText("MERCADO TESTE")).toBeVisible();
  expect(corpos).toEqual([{ url: URL_QR }]);

  // o texto do QR não vai para o campo de colar
  await expect(page.getByLabel("Texto copiado da página da SEFAZ")).toHaveCount(0); // passos manuais saem da frente

  // a nota já diz "2L": o tamanho entra no nome do produto e o app não precisa perguntar
  await expect(page.getByLabel("Nome do produto").first()).toHaveValue(/2l$/);
  await expect(page.getByRole("group", { name: /Tamanho de/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Salvar compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
  await expect(page.getByText(/MERCADO TESTE/)).toBeVisible();
  semViolacaoDeCsp(erros);
});

test("falha da busca: avisa e mantém o passo a passo manual", async ({ page }) => {
  await page.route("**/api/nfce", (route) => route.fulfill({ status: 504, contentType: "application/json", body: JSON.stringify({ erro: "sefaz_demorou" }) }));
  await page.goto(`/importar?text=${encodeURIComponent(URL_QR)}`);
  await expect(page.getByText(/A SEFAZ demorou demais/)).toBeVisible();
  await expect(page.getByText(/Guardei o QR/)).toBeVisible();
  await expect(page.getByLabel("Texto copiado da página da SEFAZ")).toBeVisible();
});

test("sem internet no mercado: guarda o QR, avisa no Início e busca depois; a nota guarda o QR e reabre sem captcha", async ({ page, context }) => {
  const { erros } = vigiarConsole(page);
  let online = false;
  await page.route("**/api/nfce", (route) =>
    online
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RESULTADO) })
      : route.fulfill({ status: 504, contentType: "application/json", body: JSON.stringify({ erro: "sefaz_demorou" }) }),
  );
  await page.goto(`/importar?text=${encodeURIComponent(URL_QR)}`);
  await expect(page.getByText(/Guardei o QR/)).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("1 nota lida pelo QR está esperando busca.")).toBeVisible();

  online = true;
  await page.goto("/importar");
  const fila = page.getByLabel("Notas esperando busca");
  await expect(fila).toContainText("Nota de");
  await fila.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("Nota buscada na SEFAZ")).toBeVisible();
  // com a busca automática funcionando, os passos manuais saem da frente
  await expect(page.getByText("2. Consultar na SEFAZ")).toHaveCount(0);
  await expect(page.getByText("3. Colar o texto da nota")).toHaveCount(0);

  await page.getByRole("button", { name: /Salvar compra/ }).click();
  await pularEstimativa(page);
  await expect(page).toHaveURL(/\/compras$/);
  await page.goto("/");
  await expect(page.getByText(/esperando busca/)).toHaveCount(0); // saiu da fila ao importar

  // Abrir SEFAZ usa o QR guardado: abre a nota direto
  await context.route("https://nfce.sefaz.pe.gov.br:444/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>nota simulada</p>" }));
  await page.goto("/compras");
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Abrir SEFAZ" }).click()]);
  expect(popup.url()).toBe(URL_QR);
  semViolacaoDeCsp(erros);
});
