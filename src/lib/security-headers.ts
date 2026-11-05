/** Fonte única dos headers de segurança (AGENTS.md seção 9). */

export type Header = { key: string; value: string };

/** Origem do serviço de mapas permitida em `connect-src` (definida na C-28). */
export const MAPS_ORIGINS: readonly string[] = [];

export function buildCsp(mapsOrigins: readonly string[] = MAPS_ORIGINS): string {
  const connect = ["'self'", ...mapsOrigins].join(" ");
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export const securityHeaders: Header[] = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
  { key: "Content-Security-Policy", value: buildCsp() },
];
