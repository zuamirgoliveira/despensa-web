import { describe, expect, it } from "vitest";
import { hojeRecife } from "@/lib/datas";

describe("hojeRecife", () => {
  it("usa o fuso de Recife (UTC-3): 01h UTC ainda é o dia anterior", () => {
    expect(hojeRecife(new Date("2026-11-05T01:00:00Z"))).toBe("2026-11-04");
    expect(hojeRecife(new Date("2026-11-05T03:00:00Z"))).toBe("2026-11-05");
    expect(hojeRecife(new Date("2026-12-31T23:59:00Z"))).toBe("2026-12-31");
    expect(hojeRecife(new Date("2027-01-01T02:59:00Z"))).toBe("2026-12-31");
  });
});
