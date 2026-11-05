import type { SVGProps } from "react";

export type NomeIcone = "info" | "aviso" | "erro" | "ok";

const CAMINHOS: Record<NomeIcone, string> = {
  info: "M12 10.5v6M12 7.5h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  aviso: "M12 9.5v4.5M12 17.5h.01M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z",
  erro: "M15 9l-6 6M9 9l6 6M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  ok: "M8 12.5l3 3 5-6M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
};

/** Ícones de estado: acompanham a cor para que ela não seja o único sinal. Decorativos (aria-hidden). */
export function Icone({ nome, className, ...props }: { nome: NomeIcone } & Omit<SVGProps<SVGSVGElement>, "children">) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
