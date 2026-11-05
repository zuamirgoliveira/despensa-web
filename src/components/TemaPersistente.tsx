"use client";

import { useEffect } from "react";
import { aplicarPreferencia, lerPreferencia } from "@/lib/tema";

/**
 * Reaplica o tema salvo em <html data-tema>. O `theme-init.js` aplica antes da pintura, mas o React
 * apaga os atributos do <html> quando a hidratação falha e ele refaz a página no cliente (acontece se
 * um proxy/CDN alterar o HTML, ex.: tags injetadas pelo Cloudflare). Sem isto, o tema escolhido
 * voltaria ao padrão a cada recarga. Também reage a mudanças feitas em outra aba.
 */
export function TemaPersistente() {
  useEffect(() => {
    const reaplicar = (): void => {
      const pref = lerPreferencia(window.localStorage);
      const atual = document.documentElement.getAttribute("data-tema");
      const esperado = pref === "sistema" ? null : pref;
      if (atual !== esperado) aplicarPreferencia(pref, document);
    };
    reaplicar();
    const obs = new MutationObserver(reaplicar);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    window.addEventListener("storage", reaplicar);
    return () => {
      obs.disconnect();
      window.removeEventListener("storage", reaplicar);
    };
  }, []);
  return null;
}
