export const WAVES = [
  { groups: [{ type: "basic", count: 8, interval: 0.85 }] },
  { groups: [{ type: "basic", count: 10, interval: 0.6 }, { type: "fast", count: 4, interval: 0.55 }] },
  { groups: [{ type: "basic", count: 8, interval: 0.5 }, { type: "tank", count: 3, interval: 1.3 }] },
  { groups: [{ type: "fast", count: 12, interval: 0.35 }, { type: "tank", count: 4, interval: 1.1 }] },
  { groups: [{ type: "boss", count: 1, interval: 1 }, { type: "basic", count: 12, interval: 0.45 }] },
];

export function buildSpawnQueue(wave) {
  const queue = [];
  let time = 0;
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i += 1) {
      queue.push({ type: group.type, time });
      time += group.interval;
    }
  }
  return queue;
}

export function waveEnemyCount(wave) {
  return wave.groups.reduce((sum, group) => sum + group.count, 0);
}
