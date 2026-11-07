"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Details, useToast } from "@/components/ui";
import { criarRepositorios } from "@/data";
import { useRepositorio } from "@/data/useRepositorio";
import { hojeRecife, dataRecife, diasEntre } from "@/lib/datas";
import { estadoArmazenamento, type EstadoArmazenamento } from "@/lib/armazenamento";
import { instanteBR } from "@/lib/format";
import { descreverContagens, guardarCopiaNoNavegador } from "./copiaNavegador";
import { RestaurarBackup } from "./RestaurarBackup";

/** Quando foi a última cópia, em palavras: "hoje", "ontem" ou "há 23 dias". */
function haQuanto(instante: string): string {
  const dias = diasEntre(dataRecife(instante), hojeRecife());
  if (dias <= 0) return "hoje";
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}

export function Backup() {
  const { mostrar } = useToast();
  const [incluirPosicao, setIncluirPosicao] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [armazenamento, setArmazenamento] = useState<EstadoArmazenamento | null>(null);

  const { dados } = useRepositorio(async () => {
    const r = await criarRepositorios();
    const casa = await r.iniciar();
    return {
      ultimoBackupEm: (await r.perfis.obterDaCasa(casa.id))?.ultimoBackupEm,
    };
  }, ["perfis"]);

  useEffect(() => {
    void estadoArmazenamento().then(setArmazenamento);
  }, []);

  async function guardar(soBaixar: boolean): Promise<void> {
    setOcupado(true);
    setResultado(null);
    try {
      const r = await guardarCopiaNoNavegador({
        incluirPosicaoDeCasa: incluirPosicao,
        soBaixar,
      });
      if (r.via === "cancelado") return;
      const quando = instanteBR(new Date().toISOString());
      setResultado(
        r.via === "compartilhado"
          ? `Cópia compartilhada em ${quando}: ${descreverContagens(r.contagens)}. Confira se ela chegou no destino que você escolheu.`
          : `Arquivo ${r.nome} baixado em ${quando}: ${descreverContagens(r.contagens)}. Guarde-o fora do celular (Drive, e-mail).`,
      );
      mostrar("Cópia de segurança feita.");
    } catch {
      mostrar("Não consegui guardar a cópia de segurança.", "erro");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3" id="backup">
      <h2 className="text-sm">Cópia de segurança</h2>
      <p className="text-sm text-suave">Seus dados ficam só neste aparelho. Guarde uma cópia fora do celular (Drive, e-mail) de vez em quando.</p>

      <p aria-label="Última cópia" className="text-sm font-medium">
        {dados?.ultimoBackupEm
          ? `Última cópia: ${instanteBR(dados.ultimoBackupEm)} (${haQuanto(dados.ultimoBackupEm)}).`
          : "Você ainda não guardou nenhuma cópia."}
      </p>

      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-5" checked={incluirPosicao} onChange={(e) => setIncluirPosicao(e.target.checked)} />
        <span>
          Incluir a posição de casa na cópia
          <span className="block text-suave">Desmarcando, o arquivo sai sem as coordenadas (será preciso informá-las de novo ao restaurar).</span>
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <Button disabled={ocupado} onClick={() => void guardar(false)}>
          Guardar uma cópia de segurança
        </Button>
        <Button variante="secundario" disabled={ocupado} onClick={() => void guardar(true)}>
          Baixar o arquivo
        </Button>
      </div>
      {resultado ? <Alert tipo="sucesso">{resultado}</Alert> : null}

      <RestaurarBackup />

      <Details semBorda titulo={<span className="text-sm">Sobre a proteção dos dados</span>}>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-suave">
            Se o celular for perdido ou os dados do navegador forem limpos, a cópia de segurança é a única forma de recuperá-los.
          </p>
          <p aria-label="Armazenamento protegido" className="text-xs text-suave">
            Armazenamento protegido pelo navegador:{" "}
            <strong>
              {armazenamento === null
                ? "verificando..."
                : armazenamento.persistente === true
                  ? "sim"
                  : armazenamento.persistente === false
                    ? "não"
                    : "indisponível"}
            </strong>
            .{" "}
            {armazenamento?.persistente === true
              ? "O navegador não apaga os dados do app por falta de espaço. Isso não substitui a cópia de segurança."
              : "Sem essa proteção, o navegador pode apagar os dados do app se faltar espaço. Instalar o app e usá-lo com frequência ajuda."}
          </p>
        </div>
      </Details>
    </Card>
  );
}
