import type { Coordenadas } from "@/domain/types";

export type ErroLocalizacao = "negada" | "indisponivel" | "tempo_esgotado" | "sem_suporte";

export class LocalizacaoError extends Error {
  constructor(public readonly motivo: ErroLocalizacao) {
    super(motivo);
    this.name = "LocalizacaoError";
  }
}

/**
 * Captura a posição UMA vez, por ação explícita do usuário ("Estou em casa agora"). Nunca rastreia:
 * não há `watchPosition` em lugar nenhum (há teste estático). Alta precisão desligada.
 */
export function capturarPosicaoUmaVez(): Promise<Coordenadas> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new LocalizacaoError("sem_suporte"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new LocalizacaoError(e.code === e.PERMISSION_DENIED ? "negada" : e.code === e.TIMEOUT ? "tempo_esgotado" : "indisponivel")),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 0 },
    );
  });
}
