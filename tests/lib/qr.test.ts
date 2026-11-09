import { describe, expect, it } from "vitest";

import { camerasTraseiras } from "@/lib/qr";

describe("camerasTraseiras", () => {
  it("lista as câmeras que não são a frontal, na ordem do aparelho", () => {
    const d = [
      { deviceId: "a", label: "camera2 1, facing front", kind: "videoinput" },
      { deviceId: "b", label: "camera2 0, facing back", kind: "videoinput" },
      { deviceId: "c", label: "camera2 2, facing back", kind: "videoinput" },
      { deviceId: "m", label: "", kind: "audioinput" },
    ] as MediaDeviceInfo[];
    expect(camerasTraseiras(d)).toEqual(["b", "c"]);
  });
});
