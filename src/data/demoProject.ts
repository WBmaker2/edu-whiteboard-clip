import type { Beat, Project, Scene, SceneType } from "../types/project";
import { buildWindows } from "../lib/time";

interface SeedBeat {
  label: string;
  desc: string;
  narration: string;
  iconType: string;
}

interface SeedScene {
  type: SceneType;
  title: string;
  subtitle: string;
  beats: SeedBeat[];
  duration: number;
}

const SEEDS: SeedScene[] = [
  {
    type: "intro",
    title: "빛을 먹고 사는 식물의 비밀",
    subtitle: "광합성은 빛 에너지를 화학 에너지로 바꾸는 생명의 공장입니다.",
    duration: 11,
    beats: [
      {
        label: "햇빛 에너지",
        desc: "태양빛이 잎에 도착",
        narration: "식물은 햇빛을 받아 스스로 양분을 만드는 놀라운 능력을 가지고 있습니다.",
        iconType: "Sun",
      },
      {
        label: "엽록체",
        desc: "잎 속 작은 공장",
        narration: "잎 속 엽록체에는 빛을 흡수하는 녹색 색소인 엽록소가 가득 들어 있습니다.",
        iconType: "Leaf",
      },
      {
        label: "광합성",
        desc: "빛에서 양분으로",
        narration: "이 과정을 통해 식물은 빛 에너지를 당과 같은 화학 에너지로 저장합니다.",
        iconType: "Lightbulb",
      },
    ],
  },
  {
    type: "body",
    title: "1단계: 빛을 흡수하는 엽록소",
    subtitle: "엽록소가 특정 파장의 빛을 붙잡아 에너지로 바꿉니다.",
    duration: 12,
    beats: [
      {
        label: "빛 흡수",
        desc: "파장을 선택적으로 흡수",
        narration: "엽록소는 붉은빛과 푸른빛을 주로 흡수하고 녹색빛은 반사합니다.",
        iconType: "Sun",
      },
      {
        label: "전자 들뜸",
        desc: "에너지가 전자를 밀어올림",
        narration: "흡수한 빛 에너지는 전자를 높은 에너지 상태로 끌어올립니다.",
        iconType: "Zap",
      },
      {
        label: "물 분해",
        desc: "물이 산소와 수소로",
        narration: "이때 물 분자가 분해되면서 산소가 공기 중으로 방출됩니다.",
        iconType: "Droplets",
      },
    ],
  },
  {
    type: "body",
    title: "2단계: 에너지 운반체 만들기",
    subtitle: "빛 반응에서 만들어진 에너지 운반체가 다음 단계를 준비합니다.",
    duration: 12,
    beats: [
      {
        label: "ATP 합성",
        desc: "에너지 저장 분자 생성",
        narration: "전자 전달 과정에서 ATP라는 에너지 저장 분자가 만들어진다.",
        iconType: "BatteryCharging",
      },
      {
        label: "NADPH",
        desc: "수소 운반체 완성",
        narration: "동시에 NADPH가 생성되어 수소와 전자를 운반할 준비를 마칩니다.",
        iconType: "Atom",
      },
      {
        label: "빛 반응",
        desc: "틸라코이드 막에서",
        narration: "이 모든 반응은 엽록체 안의 틸라코이드 막에서 빠르게 진행됩니다.",
        iconType: "Cpu",
      },
    ],
  },
  {
    type: "body",
    title: "3단계: 탄소를 붙여 포도당 만들기",
    subtitle: "캘빈 회로가 이산화탄소를 고정해 당을 합성합니다.",
    duration: 12,
    beats: [
      {
        label: "CO2 고정",
        desc: "공기 중 탄소 포집",
        narration: "캘빈 회로에서는 이산화탄소가 루비스코 효소에 의해 고정됩니다.",
        iconType: "Coffee",
      },
      {
        label: "당 합성",
        desc: "탄소 골격 연결",
        narration: "고정된 탄소는 여러 단계를 거쳐 포도당으로 조립됩니다.",
        iconType: "Star",
      },
      {
        label: "산소 배출",
        desc: "부산물은 공기로",
        narration: "광합성의 부산물로 만들어진 산소는 우리가 호흡하는 공기가 됩니다.",
        iconType: "HeartPulse",
      },
    ],
  },
  {
    type: "outro",
    title: "오늘의 정리: 식물이 만드는 순환",
    subtitle: "광합성은 생태계의 에너지와 산소를 공급하는 핵심 과정입니다.",
    duration: 10,
    beats: [
      {
        label: "빛에서 화학으로",
        desc: "에너지 전환의 핵심",
        narration: "빛 에너지는 화학 에너지로 전환되어 식물과 동물의 먹이가 됩니다.",
        iconType: "Zap",
      },
      {
        label: "산소 순환",
        desc: "호흡과 맞물린 고리",
        narration: "광합성으로 만들어진 산소는 생물의 호흡에 다시 사용됩니다.",
        iconType: "HeartPulse",
      },
      {
        label: "탄소 순환",
        desc: "지구를 지키는 균형",
        narration: "식물은 이산화탄소를 흡수해 기후를 조절하는 중요한 역할을 합니다.",
        iconType: "ShieldCheck",
      },
    ],
  },
];

export const DEMO_TOPIC = "광합성이 빛을 양분으로 바꾸는 과정";

export function createDemoProject(): Project {
  const scenes: Scene[] = SEEDS.map((seed, sceneIndex) => {
    const beats: Beat[] = seed.beats.map((beat, beatIndex) => ({
      id: `demo_${sceneIndex}_${beatIndex}`,
      ...beat,
    }));
    return {
      id: `demo_scene_${sceneIndex}`,
      type: seed.type,
      title: seed.title,
      subtitle: seed.subtitle,
      beats,
      duration: seed.duration,
      windows: buildWindows(beats, seed.duration),
      audioSource: "none",
    };
  });

  return {
    version: 2,
    aspect: "16:9",
    assets: {},
    topic: DEMO_TOPIC,
    themeId: "paper",
    visualStyle: "diagram",
    layoutStyle: "adaptive",
    voice: "Kore",
    model: "gemini-3.8-flash",
    ttsModel: "gemini-3.8-flash-tts",
    bgmId: "none",
    scenes,
    savedAt: new Date().toISOString(),
  };
}
