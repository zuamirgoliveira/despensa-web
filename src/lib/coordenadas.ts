import type { Coordenadas } from "@/domain/types";

/** Arredonda a posição (3 casas decimais ≈ 100 m) para guardar menos precisão da casa. */
export function arredondarCoordenadas(c: Coordenadas, casas = 3): Coordenadas {
  const f = 10 ** casas;
  // metade se afasta de zero, igual no hemisfério norte e no sul
  const r = (x: number): number => (Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9)) / f;
  return { lat: r(c.lat), lng: r(c.lng) };
}

/**
 * Lê coordenadas coladas ou digitadas: "-8.0631, -34.8711", "-8.0631 -34.8711" ou "-8.0631;-34.8711".
 * Ponto como separador decimal (o formato do Google Maps). Devolve `undefined` se inválido.
 */
export function lerCoordenadas(texto: string): Coordenadas | undefined {
  const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(texto);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : undefined;
}

export function formatarCoordenadas(c: Coordenadas): string {
  return `${c.lat.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}, ${c.lng.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
}
