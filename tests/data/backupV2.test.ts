// Backup v2: cabeçalho (contagens, período, integridade), posição de casa opcional e leitura da v1.
import { readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BackupInvalidoError, exportar, inspecionarBackup, lerBackup, sha256Hex, VERSAO_BACKUP } from "@/data/backup";
import { criarRepositorios } from "@/data/indexeddb";
import type { Repositorios } from "@/data/repositorios";

const V1 = readFileSync(new URL("../fixtures/backups/v1-seed.json", import.meta.url), "utf8");
let repos: Repositorios;

beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
});
afterEach(() => repos.fechar());

async function comDados(): Promise<void> {
  const casa = await repos.iniciar();
  const perfil = (await repos.perfis.obterDaCasa(casa.id))!;
  await repos.perfis.salvar({ ...perfil, localizacaoCasa: { lat: -8.063, lng: -34.871 } });
  await repos.compras.salvar({
    casaId: casa.id,
    chave: "26261108868231000638650020000689031020778720",
    mercadoId: "11111111-1111-4111-8111-111111111111",
    emissao: "2026-10-04T10:33:31",
    valorTotalCentavos: 1000,
    pagamento: "",
    itens: [],
    itensCasados: 0,
    importadoEm: "2026-10-05T12:00:00.000Z",
  });
  await repos.compras.salvar({
    casaId: casa.id,
    chave: "26261108868231000638650020000689041020778730",
    mercadoId: "11111111-1111-4111-8111-111111111111",
    emissao: "2026-11-02T09:00:00",
    valorTotalCentavos: 2000,
    pagamento: "",
    itens: [],
    itensCasados: 0,
    importadoEm: "2026-11-02T12:00:00.000Z",
  });
}

describe("exportar (versão 3)", () => {
  it("traz versão, contagens, período e a soma de verificação do conteúdo", async () => {
    await comDados();
    const b = await exportar(repos, new Date("2026-11-05T17:30:00Z"));
    expect(b.versao).toBe(VERSAO_BACKUP);
    expect(VERSAO_BACKUP).toBe(3);
    expect(b.meta).toMatchObject({
      app: "despensa-web",
      incluiPosicaoDeCasa: true,
      periodo: { de: "2026-10-04", ate: "2026-11-02" },
      contagens: { casas: 1, perfis: 1, compras: 2, produtos: 0 },
    });
    expect(b.meta?.integridade).toEqual({ algoritmo: "SHA-256", valor: await sha256Hex(JSON.stringify(b.colecoes)) });
    expect(b.meta?.integridade.valor).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sem compras não há período", async () => {
    await repos.iniciar();
    expect((await exportar(repos)).meta?.periodo).toBeUndefined();
  });

  it("incluirPosicaoDeCasa: false tira as coordenadas do arquivo, mas mantém o resto do perfil", async () => {
    await comDados();
    const com = JSON.stringify(await exportar(repos));
    const sem = JSON.stringify(await exportar(repos, new Date(), { incluirPosicaoDeCasa: false }));
    expect(com).toContain("-8.063");
    expect(sem).not.toContain("-8.063");
    expect(sem).not.toContain("localizacaoCasa");
    const lido = lerBackup(sem);
    expect(lido.colecoes.perfis[0]).toMatchObject({ folgaDias: 2, limiarAlertaPrecoPct: 20 });
    expect(lido.meta?.incluiPosicaoDeCasa).toBe(false);
    // a posição continua no aparelho
    expect((await repos.perfis.listar())[0].localizacaoCasa).toEqual({ lat: -8.063, lng: -34.871 });
  });

  it("incluiPosicaoDeCasa fica false quando não há posição cadastrada", async () => {
    await repos.iniciar();
    expect((await exportar(repos)).meta?.incluiPosicaoDeCasa).toBe(false);
  });
});

describe("inspecionarBackup (nada é gravado)", () => {
  it("arquivo recém-exportado (com indentação, como é salvo) está íntegro", async () => {
    await comDados();
    const json = JSON.stringify(await exportar(repos, new Date("2026-11-05T17:30:00Z")), null, 2);
    const r = await inspecionarBackup(json);
    expect(r).toMatchObject({
      versao: 3,
      exportadoEm: "2026-11-05T17:30:00.000Z",
      integridade: "ok",
      temPosicaoDeCasa: true,
      periodo: { de: "2026-10-04", ate: "2026-11-02" },
      contagens: { compras: 2, casas: 1 },
    });
  });

  it("detecta conteúdo alterado depois de exportado", async () => {
    await comDados();
    const arquivo = JSON.parse(JSON.stringify(await exportar(repos)));
    arquivo.colecoes.compras[0].valorTotalCentavos = 999999;
    expect((await inspecionarBackup(JSON.stringify(arquivo))).integridade).toBe("falhou");
  });

  it("detecta registro removido (contagem do cabeçalho não confere)", async () => {
    await comDados();
    const arquivo = JSON.parse(JSON.stringify(await exportar(repos)));
    arquivo.colecoes.compras.pop();
    expect((await inspecionarBackup(JSON.stringify(arquivo))).integridade).toBe("falhou");
  });

  it("arquivo cortado ao meio é recusado como JSON inválido", async () => {
    await comDados();
    const json = JSON.stringify(await exportar(repos));
    await expect(inspecionarBackup(json.slice(0, Math.floor(json.length / 2)))).rejects.toThrow(/JSON válido/);
  });

  it("versão mais nova que a suportada pede para atualizar o app", async () => {
    const arquivo = JSON.parse(JSON.stringify(await exportar(repos)));
    await expect(inspecionarBackup(JSON.stringify({ ...arquivo, versao: VERSAO_BACKUP + 1 }))).rejects.toThrow(/mais nova/);
  });

  it("formato desconhecido é recusado com mensagem clara", async () => {
    await expect(inspecionarBackup("{}")).rejects.toBeInstanceOf(BackupInvalidoError);
    await expect(inspecionarBackup('{"versao":2,"exportadoEm":"x","colecoes":{}}')).rejects.toBeInstanceOf(BackupInvalidoError);
  });
});

describe("compatibilidade: arquivo da versão 1 (sem cabeçalho)", () => {
  it("abre sem verificar integridade e informa o que há dentro", async () => {
    const r = await inspecionarBackup(V1);
    expect(r.versao).toBe(1);
    expect(r.integridade).toBe("ausente");
    expect(r.contagens.compras).toBe(12);
    expect(r.contagens.mercados).toBe(2);
    expect(r.periodo).toBeDefined();
    expect((r.periodo as { de: string; ate: string }).de < (r.periodo as { de: string; ate: string }).ate).toBe(true);
    expect(lerBackup(V1).colecoes.compras).toHaveLength(12);
  });
});

describe("backup anterior à versão 3 (estoque só por nível)", () => {
  it("converte o nível em quantidade ao ler e restaura sem perder o estoque", async () => {
    const casaId = "11111111-1111-4111-8111-111111111111";
    const produtoId = "22222222-2222-4222-8222-222222222222";
    const antigo = {
      versao: 2,
      exportadoEm: "2026-11-05T10:00:00.000Z",
      colecoes: {
        casas: [{ id: casaId, nome: "Casa" }], perfis: [], agendas: [], mercados: [], apelidos: [], compras: [], listas: [], itensLista: [],
        produtos: [{ id: produtoId, casaId, nome: "Arroz", unidade: "kg", meta: 4, frequencia: "semanal", tipoIda: "mercado_semanal", vidaUtilDias: 180 }],
        estoques: [{ id: "33333333-3333-4333-8333-333333333333", casaId, produtoId, nivel: "metade", confirmadoEm: "2026-11-01T10:00:00.000Z" }],
      },
    };
    const lido = lerBackup(JSON.stringify(antigo));
    expect(lido.colecoes.estoques[0].quantidade).toBe(2);
    expect(lido.colecoes.produtos[0].recorrente).toBe(true);
  });
});
