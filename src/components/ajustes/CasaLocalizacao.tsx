"use client";

import { useState } from "react";
import { Alert, Button, Card, Dialog, Icone, Input } from "@/components/ui";
import { criarRepositorios } from "@/data";
import type { Perfil } from "@/domain/types";
import { arredondarCoordenadas, formatarCoordenadas, lerCoordenadas } from "@/lib/coordenadas";
import { capturarPosicaoUmaVez, LocalizacaoError } from "@/lib/localizacao";

const MENSAGEM: Record<string, string> = {
  negada: "Sem permissão de localização. Digite ou cole as coordenadas abaixo.",
  indisponivel: "Não consegui obter a posição agora. Digite ou cole as coordenadas abaixo.",
  tempo_esgotado: "A localização demorou demais. Tente de novo ou digite as coordenadas abaixo.",
  sem_suporte: "Este aparelho não informa a localização. Digite ou cole as coordenadas abaixo.",
};

export function CasaLocalizacao({ perfil, aoSalvar }: { perfil: Perfil; aoSalvar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [manual, setManual] = useState("");
  const [msg, setMsg] = useState<{
    texto: string;
    tipo: "erro" | "info";
  } | null>(null);

  async function guardar(posicao: { lat: number; lng: number } | undefined, arredondar = perfil.arredondarLocalizacao): Promise<void> {
    const repos = await criarRepositorios();
    await repos.perfis.salvar({
      ...perfil,
      arredondarLocalizacao: arredondar,
      localizacaoCasa: posicao ? (arredondar ? arredondarCoordenadas(posicao) : posicao) : undefined,
    });
    aoSalvar();
  }

  async function estouEmCasa(): Promise<void> {
    setMsg({ texto: "Obtendo a posição...", tipo: "info" });
    try {
      await guardar(await capturarPosicaoUmaVez());
      setMsg(null);
    } catch (e) {
      setMsg({
        texto: MENSAGEM[e instanceof LocalizacaoError ? e.motivo : "indisponivel"],
        tipo: "erro",
      });
    }
  }

  async function salvarManual(): Promise<void> {
    const c = lerCoordenadas(manual);
    if (!c)
      return setMsg({
        texto: 'Coordenadas inválidas. Use o formato "-8.0631, -34.8711" (latitude, longitude).',
        tipo: "erro",
      });
    await guardar(c);
    setManual("");
    setMsg(null);
  }

  const definida = perfil.localizacaoCasa !== undefined;
  const aberto = !definida || editando;

  const campos = (
    <>
      <p className="text-sm text-suave">
        Usada só para estimar distância e custo das idas. Fica neste aparelho e é capturada uma única vez, quando você toca no botão: o app nunca acompanha onde
        você está.
      </p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={perfil.arredondarLocalizacao}
          onChange={(e) => void guardar(perfil.localizacaoCasa, e.target.checked)}
        />
        Arredondar a posição (guarda só ≈ 100 m de precisão)
      </label>
      <Button onClick={() => void estouEmCasa()}>Estou em casa agora</Button>
      <Input
        rotulo="Ou digite/cole as coordenadas"
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        placeholder="-8.0631, -34.8711"
        ajuda="Dica: no Google Maps, toque e segure no ponto e copie as coordenadas."
      />
      <div className={definida ? "grid grid-cols-2 gap-2" : undefined}>
        <Button variante="secundario" onClick={() => void salvarManual()}>
          Salvar coordenadas
        </Button>
        {definida ? (
          <Button variante="secundario" onClick={() => setEditando(false)}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </>
  );

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm">Localização da casa</h2>
      <p aria-label="Localização atual" className="flex items-center gap-2">
        {definida ? <Icone nome="ok" className="shrink-0 text-sucesso" /> : null}
        <span>{definida ? `Definida: ${formatarCoordenadas(perfil.localizacaoCasa!)}` : "Ainda não definida."}</span>
      </p>
      {definida && !editando ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variante="secundario" onClick={() => setEditando(true)}>
            Alterar
          </Button>
          <Button variante="secundario" onClick={() => setRemovendo(true)}>
            Remover
          </Button>
        </div>
      ) : null}
      {aberto ? campos : null}
      {msg ? <Alert tipo={msg.tipo === "erro" ? "erro" : "info"}>{msg.texto}</Alert> : null}
      <Dialog
        aberto={removendo}
        titulo="Remover a localização da casa?"
        rotuloConfirmar="Remover"
        perigo
        aoConfirmar={() => {
          setRemovendo(false);
          void guardar(undefined);
        }}
        aoCancelar={() => setRemovendo(false)}
      >
        <p>Sem a casa, o app não consegue estimar a distância e o custo das idas. Você pode definir de novo quando quiser.</p>
      </Dialog>
    </Card>
  );
}
