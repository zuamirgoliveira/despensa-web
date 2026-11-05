// Armazenamento persistente do navegador (navigator.storage). Sem ele, o navegador pode despejar os
// dados do site quando falta espaço. Não protege contra o usuário limpar tudo nem contra perder o aparelho.

export type ArmazenamentoNavegador = {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
};

export type EstadoArmazenamento = {
  /** O navegador oferece a API. */
  suportado: boolean;
  /** `true`: protegido contra despejo; `false`: pode ser despejado; `null`: sem suporte ou sem resposta. */
  persistente: boolean | null;
  usoBytes?: number;
  cotaBytes?: number;
};

const doNavegador = (): ArmazenamentoNavegador | undefined => (typeof navigator === "undefined" ? undefined : navigator.storage);

/** Pede ao navegador para não despejar os dados. Não pergunta nada ao usuário no Chrome; é seguro chamar sempre. */
export async function pedirPersistencia(storage: ArmazenamentoNavegador | undefined = doNavegador()): Promise<boolean | null> {
  if (!storage?.persist) return null;
  try {
    if (await storage.persisted?.()) return true;
    return await storage.persist();
  } catch {
    return null;
  }
}

export async function estadoArmazenamento(storage: ArmazenamentoNavegador | undefined = doNavegador()): Promise<EstadoArmazenamento> {
  if (!storage?.persisted) return { suportado: false, persistente: null };
  try {
    const [persistente, estimativa] = await Promise.all([storage.persisted(), storage.estimate?.()]);
    return { suportado: true, persistente, usoBytes: estimativa?.usage, cotaBytes: estimativa?.quota };
  } catch {
    return { suportado: true, persistente: null };
  }
}
