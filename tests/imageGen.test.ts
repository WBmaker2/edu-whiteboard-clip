import { describe, expect, it } from "vitest";
import {
  base64ToBlob,
  defaultImageModel,
  extractImageFromGemini,
  extractImageFromImagen,
  imageEndpoint,
  imageModelChain,
  imageRequestBody,
  isImagenModel,
  parseImageResponse,
} from "../src/lib/imageGen";

describe("imageGen", () => {
  it("detects Imagen models", () => {
    expect(isImagenModel("imagen-4.0-generate-001")).toBe(true);
    expect(isImagenModel("IMAGEN-3.0-generate-002")).toBe(true);
    expect(isImagenModel("gemini-2.5-flash-image")).toBe(false);
  });

  it("uses the matching endpoint per model family", () => {
    expect(imageEndpoint("imagen-4.0-generate-001")).toContain(":predict");
    expect(imageEndpoint("gemini-2.5-flash-image")).toContain(":generateContent");
  });

  it("builds a predict body for Imagen and a contents body for Gemini", () => {
    const imagen = imageRequestBody("imagen-4.0-generate-001", "a cat", "9:16") as any;
    expect(imagen.instances[0].prompt).toBe("a cat");
    expect(imagen.parameters.aspectRatio).toBe("9:16");

    const gemini = imageRequestBody("gemini-2.5-flash-image", "a cat", "16:9") as any;
    expect(gemini.contents[0].parts[0].text).toBe("a cat");
    expect(gemini.instances).toBeUndefined();
  });

  it("extracts an image from an Imagen response", () => {
    const extracted = extractImageFromImagen({
      predictions: [{ bytesBase64Encoded: "AAAA", mimeType: "image/jpeg" }],
    });
    expect(extracted).toEqual({ base64: "AAAA", mime: "image/jpeg" });
    expect(extractImageFromImagen({ predictions: [] })).toBeNull();
  });

  it("extracts an inline image from a Gemini response", () => {
    const extracted = extractImageFromGemini({
      candidates: [
        { content: { parts: [{ text: "here" }, { inlineData: { data: "BBBB", mimeType: "image/png" } }] } },
      ],
    });
    expect(extracted).toEqual({ base64: "BBBB", mime: "image/png" });
    expect(extractImageFromGemini({ candidates: [{ content: { parts: [{ text: "no image" }] } }] })).toBeNull();
  });

  it("routes response parsing by model family", () => {
    const payload = { predictions: [{ bytesBase64Encoded: "CCCC" }] };
    expect(parseImageResponse("imagen-4.0-generate-001", payload)).toEqual({
      base64: "CCCC",
      mime: "image/png",
    });
    expect(parseImageResponse("gemini-2.5-flash-image", payload)).toBeNull();
  });

  it("decodes base64 into a typed blob", () => {
    const blob = base64ToBlob("QUJD", "image/png");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(3);
  });

  it("lists models without duplicates and defaults to the first", () => {
    const chain = imageModelChain("imagen-4.0-generate-001");
    expect(new Set(chain).size).toBe(chain.length);
    expect(chain[0]).toBe("imagen-4.0-generate-001");
    expect(defaultImageModel().length).toBeGreaterThan(0);
  });
});
