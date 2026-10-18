import type { AssetMeta } from "../types/project";
import { uid } from "./time";
import { IMAGE_FALLBACKS, IMAGE_MODELS } from "../data/presets";
import { backoffMs, geminiQueue, retryAfterMs } from "./geminiQueue";
import { recordCall } from "./requestBudget";
import { decodeBlobImage } from "./assets";

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

export type ImageAspect = "16:9" | "1:1" | "9:16";

export interface ImageGenerationRequest {
  prompt: string;
  apiKey: string;
  aspect?: ImageAspect;
  model?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** AI image generation is available; the user supplies their own Gemini API key. */
export const imageGenerationEnabled = true;

const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Error messages thrown by this module start with `image.` so callers can
 * localize them with the i18n dictionary (see `image.*` keys).
 */
export function imageError(key: string): Error {
  return new Error(key.startsWith("image.") ? key : `image.${key}`);
}

export function isImageErrorKey(message: string): boolean {
  return message.startsWith("image.");
}

export function defaultImageModel(): string {
  return IMAGE_MODELS[0]?.id ?? "imagen-4.0-generate-001";
}

export function imageModelChain(selected?: string): string[] {
  const chain = [selected, ...IMAGE_FALLBACKS].filter(
    (item): item is string => Boolean(item && item.trim()),
  );
  return chain.filter((item, index) => chain.indexOf(item) === index);
}

export function isImagenModel(model: string): boolean {
  return model.trim().toLowerCase().startsWith("imagen");
}

interface ExtractedImage {
  base64: string;
  mime: string;
}

/** Reads the first base64 image payload from an Imagen :predict response. */
export function extractImageFromImagen(payload: any): ExtractedImage | null {
  const prediction = payload?.predictions?.[0];
  const base64 = prediction?.bytesBase64Encoded ?? prediction?.bytes_base64_encoded;
  if (typeof base64 === "string" && base64.length > 0) {
    return { base64, mime: prediction?.mimeType ?? "image/png" };
  }
  return null;
}

/** Reads the first inline image part from a Gemini :generateContent response. */
export function extractImageFromGemini(payload: any): ExtractedImage | null {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    const inline = part?.inlineData ?? part?.inline_data;
    const base64 = inline?.data;
    if (typeof base64 === "string" && base64.length > 0) {
      return { base64, mime: inline?.mimeType ?? inline?.mime_type ?? "image/png" };
    }
  }
  return null;
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime || "image/png" });
}

export function imageEndpoint(model: string): string {
  const action = isImagenModel(model) ? "predict" : "generateContent";
  return `${API_ROOT}/models/${model}:${action}`;
}

export function imageRequestBody(model: string, prompt: string, aspect: ImageAspect): unknown {
  if (isImagenModel(model)) {
    return {
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: aspect },
    };
  }
  return {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };
}

export function parseImageResponse(model: string, payload: any): ExtractedImage | null {
  return isImagenModel(model)
    ? extractImageFromImagen(payload)
    : extractImageFromGemini(payload);
}

function errorMessage(payload: any): string {
  return payload?.error?.message ?? "";
}

async function postImage(
  model: string,
  apiKey: string,
  body: unknown,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(imageEndpoint(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });
}

/**
 * Generates one image asset with the caller's Gemini API key.
 * Tries Imagen (:predict) first, then Gemini image models (:generateContent).
 */
export async function generateImageAsset(
  request: ImageGenerationRequest,
): Promise<AssetMeta> {
  const prompt = request.prompt.trim();
  if (!prompt) throw imageError("image.needPrompt");
  const apiKey = request.apiKey?.trim();
  if (!apiKey) throw imageError("image.needKey");

  const aspect: ImageAspect = request.aspect ?? "16:9";
  const chain = imageModelChain(request.model);
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: Error | null = null;

  for (const model of chain) {
    try {
      const extracted = await geminiQueue.run(
        async (signal) => {
          let attempt = 0;
          for (;;) {
            attempt += 1;
            const response = await postImage(
              model,
              apiKey,
              imageRequestBody(model, prompt, aspect),
              signal,
            );
            if (response.ok) {
              const payload = await response.json();
              const image = parseImageResponse(model, payload);
              if (!image) throw imageError("image.noImage");
              return image;
            }
            const bodyText = await response.text();
            if ((response.status === 429 || response.status >= 500) && attempt <= 2) {
              const wait = retryAfterMs(response) ?? backoffMs(attempt);
              await new Promise((resolve) => setTimeout(resolve, wait));
              continue;
            }
            const detail = errorMessage(safeJson(bodyText));
            throw new Error(detail || "image.httpFailed");
          }
        },
        { timeoutMs, signal: request.signal },
      );

      recordCall();
      const blob = base64ToBlob(extracted.base64, extracted.mime);
      const image = await Promise.race([
        decodeBlobImage(blob),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      return {
        id: uid("asset"),
        kind: "ai",
        source: "ai",
        mime: extracted.mime,
        blob,
        name: prompt.slice(0, 60),
        width: image?.naturalWidth || undefined,
        height: image?.naturalHeight || undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? imageError("image.failed");
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
