import { describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";

describe("cn", () => {
  it("mescla classes do Tailwind sem conflito", () => {
    expect(cn("p-2", "p-4", false && "hidden")).toBe("p-4");
  });
});
