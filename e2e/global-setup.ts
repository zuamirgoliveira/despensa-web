import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

export const CAMERA_Y4M = "test-results/camera-qr.y4m";

/** Gera o vídeo falso da câmera (QR da nota) com ffmpeg. Sem ffmpeg, o teste da câmera é pulado. */
export default function globalSetup(): void {
  mkdirSync("test-results", { recursive: true });
  try {
    execFileSync(
      "ffmpeg",
      [
        "-y", "-loglevel", "error", "-loop", "1", "-i", "tests/fixtures/fotos/qr-nota.png", "-t", "3", "-r", "10",
        "-vf", "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2:white",
        "-pix_fmt", "yuv420p", CAMERA_Y4M,
      ],
      { stdio: "inherit" },
    );
  } catch {
    console.warn("ffmpeg não encontrado: o teste da câmera ao vivo será pulado.");
  }
  if (!existsSync(CAMERA_Y4M)) process.env.SEM_CAMERA_FALSA = "1";
}
