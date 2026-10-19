export const MIN_SEPARATION = 0.9;

export function checkInvariants({ animals }) {
  const problems = [];

  for (const animal of animals) {
    const position = animal.group.position;
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      problems.push({
        code: "position-not-finite",
        message: `${animal.speciesId} 의 위치가 유한하지 않습니다.`,
      });
    }

    for (const attachment of animal.attachments ?? []) {
      if (attachment.reach < attachment.hostRadius) {
        problems.push({
          code: "attachment-buried",
          message: `${animal.speciesId} 의 ${attachment.label}이(가) 몸체 안에 파묻혀 있습니다 (최외곽 ${attachment.reach.toFixed(3)} < 표면 ${attachment.hostRadius.toFixed(3)}).`,
        });
      }
    }
  }

  for (let i = 0; i < animals.length; i += 1) {
    for (let j = i + 1; j < animals.length; j += 1) {
      const a = animals[i].group.position;
      const b = animals[j].group.position;
      const distance = Math.hypot(a.x - b.x, a.z - b.z);
      if (distance < MIN_SEPARATION) {
        problems.push({
          code: "overlap",
          message: `두 동물이 겹쳐 있습니다 (거리 ${distance.toFixed(2)} < ${MIN_SEPARATION}).`,
        });
      }
    }
  }

  if (animals.length >= 2) {
    const spread = new Set(
      animals.map((animal) => `${Math.round(animal.group.position.x * 4)},${Math.round(animal.group.position.z * 4)}`),
    );
    if (spread.size === 1) {
      problems.push({
        code: "clustered",
        message: "모든 동물이 같은 지점에 모여 있습니다.",
      });
    }
  }

  return problems;
}
