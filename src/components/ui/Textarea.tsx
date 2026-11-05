import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Campo, CLASSE_CONTROLE } from "./Campo";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & { rotulo: string; erro?: string; ajuda?: string };

export function Textarea({ rotulo, erro, ajuda, className, ...props }: Props) {
  return (
    <Campo rotulo={rotulo} erro={erro} ajuda={ajuda}>
      {(a) => <textarea {...a} className={cn(CLASSE_CONTROLE, "min-h-24", className)} {...props} />}
    </Campo>
  );
}
