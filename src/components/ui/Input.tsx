import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Campo, CLASSE_CONTROLE } from "./Campo";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & { rotulo: string; erro?: string; ajuda?: string };

export function Input({ rotulo, erro, ajuda, className, ...props }: Props) {
  return (
    <Campo rotulo={rotulo} erro={erro} ajuda={ajuda}>
      {(a) => <input {...a} className={cn(CLASSE_CONTROLE, className)} {...props} />}
    </Campo>
  );
}
