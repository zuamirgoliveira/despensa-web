import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders } from "@/lib/security-headers";

const h = (k: string) => securityHeaders.find((x) => x.key === k)?.value;

describe("security-headers", () => {
  it("define os headers simples", () => {
    expect(h("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(h("X-Content-Type-Options")).toBe("nosniff");
    expect(h("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(h("Permissions-Policy")).toBe("camera=(self), microphone=(), geolocation=(self)");
  });

  it("CSP contém cada diretiva esperada", () => {
    const csp = h("Content-Security-Policy")!;
    for (const d of [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp.split("; ")).toContain(d);
    }
  });

  it("acrescenta origens de mapas em connect-src", () => {
    expect(buildCsp(["https://maps.exemplo.com"])).toContain("connect-src 'self' https://maps.exemplo.com;");
  });
});
