import { describe, expect, it } from "vitest";
import { editarChave } from "@/lib/campoChave";

const CHAVE = "2626 1141 4993 3900 0161 6500 5000 1238 5490 5136 4469";

describe("editarChave", () => {
  it("digitar no fim agrupa de 4 em 4 e deixa o cursor no fim", () => {
    expect(editarChave("1234", "12345", 5)).toEqual({ texto: "1234 5", cursor: 6 });
    expect(editarChave("", "26261", 5)).toEqual({ texto: "2626 1", cursor: 6 });
  });

  it("apagar um dígito no meio mantém o cursor no lugar (não pula para o fim)", () => {
    // "2626 1141 49|93 3900": cursor depois do 2º dígito do 3º grupo; Backspace apaga o '9' (índice 11)
    const antes = "2626 1141 4993 3900";
    const depois = "2626 1141 493 3900"; // como o navegador deixa o campo, cursor em 11
    const r = editarChave(antes, depois, 11, "deleteContentBackward");
    expect(r.texto).toBe("2626 1141 4933 900"); // o resto reagrupa
    expect(r.cursor).toBe(11); // continua logo depois do '4', onde estava (não vai para o fim)
  });

  it("Backspace logo depois de um espaço apaga o último dígito do grupo anterior", () => {
    const antes = "2626 1141 4993";
    const depois = "2626 11414993"; // navegador apagou só o espaço (cursor em 9)
    const r = editarChave(antes, depois, 9, "deleteContentBackward");
    expect(r.texto).toBe("2626 1144 993");
    expect(r.cursor).toBe(8); // depois do 3º dígito do grupo 2
  });

  it("Delete antes de um espaço apaga o primeiro dígito do próximo grupo", () => {
    const antes = "2626 1141 4993";
    const depois = "2626 11414993"; // navegador apagou o espaço; cursor em 9? (Delete mantém o cursor em 9)
    const r = editarChave(antes, depois, 9, "deleteContentForward");
    expect(r.texto).toBe("2626 1141 993");
    expect(r.cursor).toBe(9);
  });

  it("inserir dígito no meio empurra o resto e o cursor fica depois do inserido", () => {
    const antes = "2626 1141";
    const depois = "2626 1X141".replace("X", "9"); // digitou '9' depois do 1º dígito do grupo 2 (cursor em 7)
    const r = editarChave(antes, depois, 7, "insertText");
    expect(r.texto).toBe("2626 1914 1");
    expect(r.cursor).toBe(7);
  });

  it("colar uma chave inteira (com espaços, pontos, letras) normaliza e limita a 44 dígitos", () => {
    const r = editarChave("", `${CHAVE}99`, CHAVE.length + 2, "insertFromPaste");
    expect(r.texto).toBe(CHAVE);
    expect(r.cursor).toBe(CHAVE.length);
    expect(editarChave("", "2626.1141-4993 abc", 18).texto).toBe("2626 1141 4993");
  });

  it("limpar o campo", () => {
    expect(editarChave("2626", "", 0, "deleteContentBackward")).toEqual({ texto: "", cursor: 0 });
  });
});
