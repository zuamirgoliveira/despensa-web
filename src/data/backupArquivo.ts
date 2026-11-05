// Guardar uma cópia de segurança: gera o arquivo, entrega (compartilhar ou baixar) e registra a data.
import { hojeRecife } from "@/lib/datas";
import { exportar } from "./backup";
import type { Repositorios } from "./repositorios";

/** Como o arquivo sai do app (injetável nos testes). */
export type AmbienteArquivo = {
  criar: (conteudo: string, nome: string) => File;
  compartilhar: (arquivo: File, titulo: string) => Promise<"compartilhado" | "cancelado" | "indisponivel">;
  baixar: (arquivo: File) => void;
};

export type ResultadoCopia = {
  via: "compartilhado" | "baixado" | "cancelado";
  nome: string;
  /** Contagens do que foi guardado (para o usuário conferir). */
  contagens: Record<string, number>;
};

export type OpcoesCopia = {
  incluirPosicaoDeCasa?: boolean;
  /** Pula o menu de compartilhar e baixa o arquivo. */
  soBaixar?: boolean;
  agora?: Date;
};

/** Registra em `Perfil.ultimoBackupEm` que a cópia foi feita (base do lembrete). */
export async function registrarCopiaFeita(repos: Repositorios, agora: Date = new Date()): Promise<void> {
  const casa = await repos.iniciar();
  const perfil = await repos.perfis.obterDaCasa(casa.id);
  if (perfil) await repos.perfis.salvar({ ...perfil, ultimoBackupEm: agora.toISOString() });
}

export async function guardarCopia(repos: Repositorios, ambiente: AmbienteArquivo, opcoes: OpcoesCopia = {}): Promise<ResultadoCopia> {
  const agora = opcoes.agora ?? new Date();
  const dados = await exportar(repos, agora, { incluirPosicaoDeCasa: opcoes.incluirPosicaoDeCasa ?? true });
  const nome = `despensa-backup-${hojeRecife(agora)}.json`;
  const arquivo = ambiente.criar(JSON.stringify(dados, null, 2), nome);
  const contagens = dados.meta?.contagens ?? {};

  if (!opcoes.soBaixar) {
    const r = await ambiente.compartilhar(arquivo, "Despensa: cópia de segurança");
    if (r === "cancelado") return { via: "cancelado", nome, contagens };
    if (r === "compartilhado") {
      await registrarCopiaFeita(repos, agora);
      return { via: "compartilhado", nome, contagens };
    }
  }
  ambiente.baixar(arquivo);
  await registrarCopiaFeita(repos, agora);
  return { via: "baixado", nome, contagens };
}
