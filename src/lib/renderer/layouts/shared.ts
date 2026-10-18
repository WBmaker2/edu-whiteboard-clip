import { CANVAS_WIDTH } from "../core";

export interface NodeSlot {
  x: number;
  radius: number;
  iconSize: number;
  labelSize: number;
  descSize: number;
  slot: number;
}

export function nodeLayout(count: number): NodeSlot[] {
  const safe = Math.max(1, count);
  const slot = 1680 / safe;
  return Array.from({ length: safe }, (_, index) => ({
    x: 120 + slot / 2 + index * slot,
    radius: safe <= 3 ? 60 : safe === 4 ? 48 : 42,
    iconSize: safe <= 3 ? 76 : safe === 4 ? 60 : 52,
    labelSize: safe <= 3 ? 34 : safe === 4 ? 29 : 25,
    descSize: safe <= 3 ? 23 : safe === 4 ? 20 : 18,
    slot,
  }));
}

export function cardLayout(count: number): { width: number; gap: number; centers: number[] } {
  const width = count <= 2 ? 520 : count === 3 ? 420 : count === 4 ? 380 : 310;
  const gap = count <= 2 ? 80 : count === 3 ? 40 : count === 4 ? 28 : 20;
  const total = count * width + Math.max(0, count - 1) * gap;
  const start = (CANVAS_WIDTH - total) / 2;
  const centers = Array.from(
    { length: count },
    (_, index) => start + width / 2 + index * (width + gap),
  );
  return { width, gap, centers };
}
