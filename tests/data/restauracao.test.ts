// Restauração do backup: atômica (entra tudo ou nada), com modos mesclar e substituir.
import { readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackupInvalidoError, compararComAparelho, exportar, importar, inspecionarBackup, restaurarBackup } from "@/data/backup";
import { aoMudar, type NomeColecao } from "@/data/eventos";
import { criarRepositorios } from "@/data/indexeddb";
import { DadoInvalidoError } from "@/data/indexeddb/colecao";
import type { Repositorios } from "@/data/repositorios";
import type { Estoque } from "@/domain/types";

/** Protótipo de IDBObjectStore do fake-indexeddb (para simular falhas no meio da gravação). */
async function prototipoDaLoja(): Promise<{ put: (this: unknown, ...args: unknown[]) => unknown; name?: string }> {
  const req = new IDBFactory().open("sonda", 1);
  return new Promise((resolve, reject) => {
    req.onupgradeneeded = () => {
      const loja = req.result.createObjectStore("a");
      resolve(Object.getPrototypeOf(loja));
      req.result.close();
    };
    req.onerror = () => reject(req.error);
  });
}

const V1 = readFileSync(new URL("../fixtures/backups/v1-seed.json", import.meta.url), "utf8");
const abertos: Repositorios[] = [];
const novoAparelho = async (): Promise<Repositorios> => {
  const r = await criarRepositorios({ indexedDB: new IDBFactory() });
  abertos.push(r);
  return r;
};
afterEach(() => {
  vi.restoreAllMocks();
  while (abertos.length) abertos.pop()?.fechar();
});

/** Cópia de segurança (v2) feita a partir do seed, com estoque em 3 produtos (o seed não traz estoque). */
async function copiaDoSeed(): Promise<string> {
  const origem = await novoAparelho();
  await importar(origem, V1);
  const casa = (await origem.casas.listar())[0];
  const niveis = ["cheio", "metade", "acabando"] as const;
  for (const [i, p] of (await origem.produtos.listar()).slice(0, 3).entries()) {
    await origem.estoques.salvar({
      id: `00000000-0000-4000-8000-00000000000${i + 1}`,
      casaId: casa.id,
      produtoId: p.id,
      quantidade: i, nivel: niveis[i],
      confirmadoEm: "2026-11-01T10:00:00.000Z",
    });
  }
  return JSON.stringify(await exportar(origem, new Date("2026-11-05T17:30:00Z")), null, 2);
}

/** Estado do aparelho para comparar antes e depois (sem a data do export). */
const estado = async (r: Repositorios) => (await exportar(r, new Date(0))).colecoes;

let alvo: Repositorios;
beforeEach(async () => {
  alvo = await novoAparelho();
});

describe("restaurar em aparelho vazio (troca de aparelho)", () => {
  it("restaura tudo, remove a casa padrão vazia e não deixa duas casas", async () => {
    const json = await copiaDoSeed();
    const padrao = (await alvo.casas.listar())[0];
    const resumo = await restaurarBackup(alvo, json, "mesclar");
    expect(resumo).toMatchObject({ compras: 12, mercados: 2 });
    expect(await alvo.casas.listar()).toHaveLength(1);
    expect((await alvo.casas.listar())[0].id).not.toBe(padrao.id);
    expect(await alvo.compras.listar()).toHaveLength(12);
    expect((await alvo.perfis.listar()).every((p) => p.casaId !== padrao.id)).toBe(true);
    expect((await alvo.agendas.listar()).every((a) => a.casaId !== padrao.id)).toBe(true);
  });

  it("grava Perfil.ultimoBackupEm com a data da cópia restaurada", async () => {
    await restaurarBackup(alvo, await copiaDoSeed(), "substituir");
    expect((await alvo.perfis.listar())[0].ultimoBackupEm).toBe("2026-11-05T17:30:00.000Z");
  });
});

describe("modos com dados no aparelho", () => {
  async function aparelhoComDadosProprios(): Promise<void> {
    const casa = (await alvo.casas.listar())[0];
    await alvo.produtos.salvar({
      id: "99999999-9999-4999-8999-999999999999",
      casaId: casa.id,
      nome: "Produto só daqui",
      categoria: "outros",
      unidade: "un",
      meta: 1,
      metaManual: false, recorrente: true,
      frequencia: "semanal",
      tipoIda: "mercado_semanal",
      vidaUtilDias: 90,
      contavel: false,
      ativo: true,
    });
  }

  it("mesclar mantém o que só existe aqui e copia o resto", async () => {
    await aparelhoComDadosProprios();
    await restaurarBackup(alvo, await copiaDoSeed(), "mesclar");
    const nomes = (await alvo.produtos.listar()).map((p) => p.nome);
    expect(nomes).toContain("Produto só daqui");
    expect(await alvo.compras.listar()).toHaveLength(12);
    // com dados próprios a casa padrão do aparelho NÃO é removida: tem dados
    expect(await alvo.casas.listar()).toHaveLength(2);
  });

  it("substituir apaga o que só existe aqui e deixa igual à cópia", async () => {
    await aparelhoComDadosProprios();
    await restaurarBackup(alvo, await copiaDoSeed(), "substituir");
    expect((await alvo.produtos.listar()).map((p) => p.nome)).not.toContain("Produto só daqui");
    expect(await alvo.casas.listar()).toHaveLength(1);
    const copia = (await inspecionarBackup(await copiaDoSeed())).backup.colecoes;
    expect((await alvo.compras.listar()).map((c) => c.chave).sort()).toEqual(copia.compras.map((c) => c.chave).sort());
    expect((await alvo.produtos.listar()).map((p) => p.id).sort()).toEqual(copia.produtos.map((p) => p.id).sort());
  });

  it("mesclar duas vezes é idempotente", async () => {
    const json = await copiaDoSeed();
    await restaurarBackup(alvo, json, "mesclar");
    const depoisDe1 = await estado(alvo);
    await restaurarBackup(alvo, json, "mesclar");
    expect(await estado(alvo)).toEqual(depoisDe1);
  });

  it("mesclar mantém a posição de casa deste aparelho quando a cópia não a traz; substituir não", async () => {
    const origem = await novoAparelho();
    await importar(origem, V1);
    const semPosicao = JSON.stringify(await exportar(origem, new Date("2026-11-05T17:30:00Z"), { incluirPosicaoDeCasa: false }));

    const mesmo = await novoAparelho();
    await importar(mesmo, V1);
    const perfil = (await mesmo.perfis.listar())[0];
    await mesmo.perfis.salvar({ ...perfil, localizacaoCasa: { lat: -8.063, lng: -34.871 } });
    await restaurarBackup(mesmo, semPosicao, "mesclar");
    expect((await mesmo.perfis.listar())[0].localizacaoCasa).toEqual({ lat: -8.063, lng: -34.871 });

    const outro = await novoAparelho();
    await importar(outro, V1);
    const p2 = (await outro.perfis.listar())[0];
    await outro.perfis.salvar({ ...p2, localizacaoCasa: { lat: -8.063, lng: -34.871 } });
    await restaurarBackup(outro, semPosicao, "substituir");
    expect((await outro.perfis.listar())[0].localizacaoCasa).toBeUndefined();
  });

  it("mesclar não volta o ultimoBackupEm para trás", async () => {
    const json = await copiaDoSeed(); // exportada em 05/11/2026
    await restaurarBackup(alvo, json, "mesclar");
    const perfil = (await alvo.perfis.listar())[0];
    await alvo.perfis.salvar({ ...perfil, ultimoBackupEm: "2026-12-01T10:00:00.000Z" });
    await restaurarBackup(alvo, json, "mesclar");
    expect((await alvo.perfis.listar())[0].ultimoBackupEm).toBe("2026-12-01T10:00:00.000Z");
  });
});

describe("estoque: índice único por produto", () => {
  it("mesclar: o estoque da cópia substitui o local do mesmo produto, sem erro", async () => {
    const json = await copiaDoSeed();
    await restaurarBackup(alvo, json, "mesclar");
    const copia = (await inspecionarBackup(json)).backup.colecoes;
    const da = copia.estoques[0];
    // o aparelho tem o estoque do MESMO produto com OUTRO identificador e outro nível
    await alvo.estoques.apagar(da.id);
    const local: Estoque = { ...da, id: "88888888-8888-4888-8888-888888888888", nivel: "acabou" };
    await alvo.estoques.salvar(local);
    await restaurarBackup(alvo, json, "mesclar");
    const doProduto = (await alvo.estoques.listar()).filter((e) => e.produtoId === da.produtoId);
    expect(doProduto).toHaveLength(1);
    expect(doProduto[0]).toMatchObject({ id: da.id, nivel: da.nivel });
  });
});

describe("tudo ou nada", () => {
  for (const modo of ["mesclar", "substituir"] as const) {
    it(`${modo}: uma falha no meio da gravação não deixa nada pela metade`, async () => {
      const json = await copiaDoSeed();
      // o aparelho já tem dados próprios (o que seria perdido ou duplicado numa falha)
      await restaurarBackup(alvo, V1, "mesclar");
      const casa = (await alvo.casas.listar())[0];
      await alvo.produtos.salvar({
        id: "77777777-7777-4777-8777-777777777777",
        casaId: casa.id,
        nome: "Meu produto",
        categoria: "outros",
        unidade: "un",
        meta: 1,
        metaManual: false, recorrente: true,
        frequencia: "semanal",
        tipoIda: "mercado_semanal",
        vidaUtilDias: 90,
        contavel: false,
        ativo: true,
      });
      const antes = await estado(alvo);

      const proto = await prototipoDaLoja();
      const original = proto.put;
      let chamadas = 0;
      vi.spyOn(proto, "put").mockImplementation(function (this: unknown, ...args: unknown[]) {
        if (++chamadas === 30) throw new Error("falha simulada no meio da gravação");
        return original.apply(this, args);
      });

      await expect(restaurarBackup(alvo, json, modo)).rejects.toThrow(/falha simulada/);
      expect(chamadas).toBeGreaterThanOrEqual(30); // a falha foi no meio, depois de muitas gravações agendadas
      vi.restoreAllMocks();
      expect(await estado(alvo)).toEqual(antes); // nada mudou: nem o que foi gravado antes da falha, nem o que "substituir" apagou
    });
  }

  it("o banco recusando uma gravação DEPOIS de agendada (índice único) aborta a transação inteira", async () => {
    const json = await copiaDoSeed();
    await restaurarBackup(alvo, V1, "mesclar");
    const antes = await estado(alvo);
    const proto = await prototipoDaLoja();
    const original = proto.put;
    let estoques = 0;
    // a 2ª gravação de estoque reaproveita o produto da 1ª com outro id: o banco recusa de forma assíncrona
    let primeiroProduto: string | undefined;
    vi.spyOn(proto, "put").mockImplementation(function (this: unknown, ...args: unknown[]) {
      const loja = (this as { name?: string }).name;
      const valor = args[0] as { produtoId?: string; id?: string };
      if (loja === "estoques") {
        if (++estoques === 1) primeiroProduto = valor.produtoId;
        if (estoques === 2) return original.call(this, { ...valor, id: "11111111-aaaa-4aaa-8aaa-111111111111", produtoId: primeiroProduto });
      }
      return original.apply(this, args);
    });
    await expect(restaurarBackup(alvo, json, "substituir")).rejects.toThrow();
    vi.restoreAllMocks();
    expect(estoques).toBeGreaterThanOrEqual(2);
    expect(await estado(alvo)).toEqual(antes); // o "substituir" (que já tinha agendado clear e dezenas de puts) foi desfeito
  });

  it("registro inválido na cópia: recusa antes de gravar e o aparelho fica como estava", async () => {
    const json = await copiaDoSeed();
    await restaurarBackup(alvo, V1, "mesclar");
    const antes = await estado(alvo);
    const arq = JSON.parse(json);
    arq.meta = undefined; // sem cabeçalho, para a soma não barrar antes
    arq.colecoes.produtos[3].meta = -5; // viola o schema do produto
    await expect(restaurarBackup(alvo, JSON.stringify(arq), "substituir")).rejects.toThrow(BackupInvalidoError);
    expect(await estado(alvo)).toEqual(antes);
  });

  it("chave duplicada na cópia (mesma compra duas vezes) é recusada sem gravar", async () => {
    const json = await copiaDoSeed();
    const arq = JSON.parse(json);
    arq.meta = undefined;
    arq.colecoes.compras.push(arq.colecoes.compras[0]);
    const antes = await estado(alvo);
    await expect(alvo.restaurar(arq.colecoes, "mesclar")).rejects.toThrow(DadoInvalidoError);
    expect(await estado(alvo)).toEqual(antes);
  });

  it("dois estoques do mesmo produto na cópia são recusados (índice único)", async () => {
    const json = await copiaDoSeed();
    const arq = JSON.parse(json);
    arq.colecoes.estoques.push({ ...arq.colecoes.estoques[0], id: "66666666-6666-4666-8666-666666666666" });
    await expect(alvo.restaurar(arq.colecoes, "mesclar")).rejects.toThrow(/duplicada/);
  });

  it("arquivo alterado depois de gerado (soma não confere) é recusado e nada muda", async () => {
    const json = await copiaDoSeed();
    const arq = JSON.parse(json);
    arq.colecoes.compras[0].valorTotalCentavos += 1;
    const antes = await estado(alvo);
    await expect(restaurarBackup(alvo, JSON.stringify(arq), "substituir")).rejects.toThrow(/incompleto ou foi alterado/);
    expect(await estado(alvo)).toEqual(antes);
  });

  it("arquivo cortado ao meio: recusado, aparelho intacto", async () => {
    const json = await copiaDoSeed();
    const antes = await estado(alvo);
    await expect(restaurarBackup(alvo, json.slice(0, json.length / 2), "substituir")).rejects.toThrow(/JSON válido/);
    expect(await estado(alvo)).toEqual(antes);
  });
});

describe("eventos e leitores", () => {
  it("avisa as telas de que todas as coleções mudaram", async () => {
    const vistas = new Set<NomeColecao>();
    const parar = aoMudar((c) => vistas.add(c));
    await restaurarBackup(alvo, await copiaDoSeed(), "mesclar");
    parar();
    expect(vistas.size).toBe(12);
  });
});

describe("compararComAparelho", () => {
  it("aparelho novo (só a casa padrão) é 'vazio'", async () => {
    const insp = await inspecionarBackup(await copiaDoSeed());
    const c = await compararComAparelho(alvo, insp);
    expect(c).toMatchObject({ vazio: true, outraCasa: false, copiaMaisAntiga: false });
    expect(c.compras).toEqual({ soAqui: 0, nosDois: 0, soNaCopia: 12 });
  });

  it("depois de restaurar, tudo é 'nos dois'; compras novas só daqui aparecem como 'soAqui'", async () => {
    const json = await copiaDoSeed();
    await restaurarBackup(alvo, json, "mesclar");
    const casa = (await alvo.casas.listar())[0];
    const base = (await alvo.compras.listar())[0];
    await alvo.compras.salvar({ ...base, chave: "26261108868231000638650020000689031020778720", importadoEm: "2026-12-01T10:00:00.000Z" });
    const c = await compararComAparelho(alvo, await inspecionarBackup(json));
    expect(c.vazio).toBe(false);
    expect(c.compras).toEqual({ soAqui: 1, nosDois: 12, soNaCopia: 0 });
    expect(c.copiaMaisAntiga).toBe(true); // há compra importada depois da data da cópia (05/11/2026)
    expect(c.outraCasa).toBe(false);
    expect(casa.id).toBeTruthy();
  });

  it("aparelho com dados de outra casa: avisa que mesclar deixaria duas casas", async () => {
    const outro = await novoAparelho();
    await importar(outro, V1); // casa do seed
    const json = await copiaDoSeed(); // mesma casa do seed
    const proprio = await novoAparelho();
    const casa = (await proprio.casas.listar())[0];
    await proprio.mercados.salvar({ id: "55555555-5555-4555-8555-555555555555", casaId: casa.id, cnpj: "08868231000638", nome: "Meu mercado", endereco: "", tipo: "supermercado", transporte: "carro" });
    const c = await compararComAparelho(proprio, await inspecionarBackup(json));
    expect(c.vazio).toBe(false);
    expect(c.outraCasa).toBe(true);
  });
});
