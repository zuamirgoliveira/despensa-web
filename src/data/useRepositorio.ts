"use client";

import { useEffect, useRef, useState } from "react";
import { aoMudar, type NomeColecao } from "./eventos";

export type EstadoConsulta<T> = { dados: T | undefined; carregando: boolean; erro: Error | undefined };

/**
 * Executa `consulta` e a reexecuta sempre que uma das `colecoes` mudar.
 * `consulta` pode mudar a cada render; a mais recente é a usada.
 */
export function useRepositorio<T>(consulta: () => Promise<T>, colecoes: readonly NomeColecao[]): EstadoConsulta<T> {
  const [estado, setEstado] = useState<EstadoConsulta<T>>({ dados: undefined, carregando: true, erro: undefined });
  const consultaRef = useRef(consulta);
  useEffect(() => {
    consultaRef.current = consulta;
  });
  const chave = colecoes.join(",");

  useEffect(() => {
    let ativo = true;
    const alvo = new Set<string>(chave.split(",").filter(Boolean));
    const executar = (): void => {
      consultaRef.current().then(
        (dados) => ativo && setEstado({ dados, carregando: false, erro: undefined }),
        (e: unknown) =>
          ativo && setEstado((s) => ({ ...s, carregando: false, erro: e instanceof Error ? e : new Error(String(e)) })),
      );
    };
    executar();
    const cancelar = aoMudar((c) => {
      if (alvo.has(c)) executar();
    });
    return () => {
      ativo = false;
      cancelar();
    };
  }, [chave]);

  return estado;
}
