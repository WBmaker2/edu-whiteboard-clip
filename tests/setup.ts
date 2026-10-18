import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}

if (typeof URL.createObjectURL !== "function") {
  let blobCounter = 0;
  URL.createObjectURL = () => `blob:mock-${(blobCounter += 1)}`;
  URL.revokeObjectURL = () => undefined;
}

