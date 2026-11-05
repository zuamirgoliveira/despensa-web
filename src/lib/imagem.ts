/** Arquivo de imagem → canvas, respeitando a orientação EXIF e limitando o lado maior. */
export async function arquivoParaCanvas(file: Blob, maxLado = 2200): Promise<HTMLCanvasElement> {
  let origem: ImageBitmap | HTMLImageElement;
  try {
    origem = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    origem = await new Promise<HTMLImageElement>((ok, falha) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        ok(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        falha(new Error("Não consegui abrir essa imagem."));
      };
      img.src = url;
    });
  }
  const esc = Math.min(1, maxLado / Math.max(origem.width, origem.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(origem.width * esc));
  c.height = Math.max(1, Math.round(origem.height * esc));
  c.getContext("2d")?.drawImage(origem, 0, 0, c.width, c.height);
  if ("close" in origem) origem.close();
  return c;
}

/** Redimensiona para que o lado maior seja `lado` (nunca amplia). */
export function reduzirCanvas(canvas: HTMLCanvasElement, lado: number): HTMLCanvasElement {
  const esc = lado / Math.max(canvas.width, canvas.height);
  if (esc >= 1) return canvas;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(canvas.width * esc));
  c.height = Math.max(1, Math.round(canvas.height * esc));
  c.getContext("2d")?.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}
