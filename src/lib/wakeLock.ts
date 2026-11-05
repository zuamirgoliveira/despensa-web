type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockApi = { request: (tipo: "screen") => Promise<WakeLockSentinelLike> };

/**
 * Mantém a tela acesa enquanto o modo compra está aberto (Screen Wake Lock API). Sem suporte ou com
 * falha, não faz nada (silencioso). Reobtém o bloqueio quando a aba volta a ficar visível.
 * Devolve a função que libera o bloqueio.
 */
export function manterTelaAcesa(): () => void {
  const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
  if (!api) return () => undefined;
  let sentinela: WakeLockSentinelLike | undefined;
  let ativo = true;

  const pedir = (): void => {
    api.request("screen").then(
      (s) => {
        if (ativo) sentinela = s;
        else void s.release();
      },
      () => undefined,
    );
  };
  const aoVoltar = (): void => {
    if (document.visibilityState === "visible" && ativo) pedir();
  };
  pedir();
  document.addEventListener("visibilitychange", aoVoltar);
  return () => {
    ativo = false;
    document.removeEventListener("visibilitychange", aoVoltar);
    void sentinela?.release().catch(() => undefined);
  };
}
