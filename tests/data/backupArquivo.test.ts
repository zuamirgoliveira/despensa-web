import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspecionarBackup } from "@/data/backup";
import { guardarCopia, registrarCopiaFeita, type AmbienteArquivo } from "@/data/backupArquivo";
import { criarRepositorios } from "@/data/indexeddb";
import type { Repositorios } from "@/data/repositorios";

let repos: Repositorios;
beforeEach(async () => {
  repos = await criarRepositorios({ indexedDB: new IDBFactory() });
  const casa = await repos.iniciar();
  const perfil = (await repos.perfis.obterDaCasa(casa.id))!;
  await repos.perfis.salvar({ ...perfil, localizacaoCasa: { lat: -8.063, lng: -34.871 } });
});
afterEach(() => repos.fechar());

const AGORA = new Date("2026-11-05T17:30:00Z");
const ultimo = async () => (await repos.perfis.listar())[0].ultimoBackupEm;

function ambiente(compartilhar: AmbienteArquivo["compartilhar"]) {
  const baixar = vi.fn();
  const entregues: File[] = [];
  const amb: AmbienteArquivo = {
    criar: (conteudo, nome) => new File([conteudo], nome, { type: "application/json" }),
    compartilhar: async (arq, titulo) => {
      entregues.push(arq);
      return compartilhar(arq, titulo);
    },
    baixar,
  };
  return { amb, baixar, entregues };
}

describe("guardarCopia", () => {
  it("compartilhado: entrega o arquivo, registra a data e informa o que foi guardado", async () => {
    const { amb, baixar, entregues } = ambiente(async () => "compartilhado");
    const r = await guardarCopia(repos, amb, { agora: AGORA });
    expect(r).toMatchObject({ via: "compartilhado", nome: "despensa-backup-2026-11-05.json" });
    expect(r.contagens).toMatchObject({ casas: 1, perfis: 1 });
    expect(baixar).not.toHaveBeenCalled();
    expect(await ultimo()).toBe("2026-11-05T17:30:00.000Z");
    // o arquivo entregue é uma cópia válida e íntegra
    const insp = await inspecionarBackup(await entregues[0].text());
    expect(insp).toMatchObject({ integridade: "ok", temPosicaoDeCasa: true });
  });

  it("cancelar o menu não conta como cópia feita", async () => {
    const { amb, baixar } = ambiente(async () => "cancelado");
    const r = await guardarCopia(repos, amb, { agora: AGORA });
    expect(r.via).toBe("cancelado");
    expect(baixar).not.toHaveBeenCalled();
    expect(await ultimo()).toBeUndefined();
  });

  it("sem compartilhar no navegador, baixa o arquivo e registra", async () => {
    const { amb, baixar } = ambiente(async () => "indisponivel");
    const r = await guardarCopia(repos, amb, { agora: AGORA });
    expect(r.via).toBe("baixado");
    expect(baixar).toHaveBeenCalledOnce();
    expect(await ultimo()).toBe("2026-11-05T17:30:00.000Z");
  });

  it("soBaixar pula o menu de compartilhar", async () => {
    const compartilhar = vi.fn(async () => "compartilhado" as const);
    const { amb, baixar } = ambiente(compartilhar);
    const r = await guardarCopia(repos, amb, { agora: AGORA, soBaixar: true });
    expect(r.via).toBe("baixado");
    expect(compartilhar).not.toHaveBeenCalled();
    expect(baixar).toHaveBeenCalledOnce();
  });

  it("incluirPosicaoDeCasa: false entrega o arquivo sem as coordenadas (e a posição continua no aparelho)", async () => {
    const { amb, entregues } = ambiente(async () => "compartilhado");
    await guardarCopia(repos, amb, { agora: AGORA, incluirPosicaoDeCasa: false });
    const texto = await entregues[0].text();
    expect(texto).not.toContain("-8.063");
    expect((await inspecionarBackup(texto)).temPosicaoDeCasa).toBe(false);
    expect((await repos.perfis.listar())[0].localizacaoCasa).toEqual({ lat: -8.063, lng: -34.871 });
  });

  it("o dia no nome do arquivo é o de Recife (00h30 UTC ainda é o dia anterior em Recife)", async () => {
    const { amb } = ambiente(async () => "compartilhado");
    const r = await guardarCopia(repos, amb, { agora: new Date("2026-11-06T00:30:00Z") });
    expect(r.nome).toBe("despensa-backup-2026-11-05.json");
  });
});

describe("registrarCopiaFeita", () => {
  it("grava Perfil.ultimoBackupEm", async () => {
    await registrarCopiaFeita(repos, AGORA);
    expect(await ultimo()).toBe("2026-11-05T17:30:00.000Z");
  });
});
