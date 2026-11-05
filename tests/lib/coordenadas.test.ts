import { describe, expect, it } from "vitest";
import { arredondarCoordenadas, formatarCoordenadas, lerCoordenadas } from "@/lib/coordenadas";

describe("arredondarCoordenadas", () => {
  it("3 casas decimais por padrão (≈ 100 m)", () => {
    expect(arredondarCoordenadas({ lat: -8.063149, lng: -34.871139 })).toEqual({ lat: -8.063, lng: -34.871 });
    expect(arredondarCoordenadas({ lat: -8.0636, lng: -34.8715 })).toEqual({ lat: -8.064, lng: -34.872 });
  });
  it("casas configuráveis", () => expect(arredondarCoordenadas({ lat: 1.23456, lng: 2.34567 }, 2)).toEqual({ lat: 1.23, lng: 2.35 }));
});

describe("lerCoordenadas", () => {
  it.each([
    ["-8.0631, -34.8711", { lat: -8.0631, lng: -34.8711 }],
    ["-8.0631,-34.8711", { lat: -8.0631, lng: -34.8711 }],
    ["  -8.0631 -34.8711 ", { lat: -8.0631, lng: -34.8711 }],
    ["-8.0631;-34.8711", { lat: -8.0631, lng: -34.8711 }],
    ["0, 0", { lat: 0, lng: 0 }],
    ["90, 180", { lat: 90, lng: 180 }],
    ["-8, -34", { lat: -8, lng: -34 }],
  ])("%s", (t, esperado) => expect(lerCoordenadas(t)).toEqual(esperado));

  it.each([[""], ["abc"], ["-8.0631"], ["91, 0"], ["0, 181"], ["-8,0631, -34,8711"], ["1,2,3"]])("inválido: %j", (t) => {
    expect(lerCoordenadas(t)).toBeUndefined();
  });
});

describe("formatarCoordenadas", () => {
  it("sem zeros à direita", () => {
    expect(formatarCoordenadas({ lat: -8.063, lng: -34.871 })).toBe("-8.063, -34.871");
    expect(formatarCoordenadas({ lat: -8, lng: -34.5 })).toBe("-8, -34.5");
  });
});
