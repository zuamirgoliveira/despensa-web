import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Campo, CLASSE_CONTROLE } from "./Campo";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & { rotulo: string; erro?: string; ajuda?: string };

export function Select({ rotulo, erro, ajuda, className, children, ...props }: Props) {
  return (
    <Campo rotulo={rotulo} erro={erro} ajuda={ajuda}>
      {(a) => (
        <select {...a} className={cn(CLASSE_CONTROLE, className)} {...props}>
          {children}
        </select>
      )}
    </Campo>
  );
}
