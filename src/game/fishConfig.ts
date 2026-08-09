import atlasRaw from "./atlas.json";

const atlasJson = atlasRaw as {
  atlasFiles: Record<string, string>;
  fish: Record<string, FishFrame[]>;
};

/**
 * 鱼类配置：数值照搬原 Java 版 fish/FishInfo.plist，
 * 帧动画图片来自原版 TexturePacker 图集（public/fish/*.png + atlas.json 坐标）。
 */

export interface FishFrame {
  atlas: string;
  frame: number;
  x: number;
  y: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  ow: number;
  oh: number;
}

export interface FishType {
  id: number;
  name: string;
  /** 捕到后的分值 */
  worth: number;
  /** 捕鱼概率基准（千分制）：实际概率 = 炮档*10 + catchProbability */
  catchProbability: number;
  /** 游动速度（鱼属性 fishRunSpeed） */
  speed: number;
  /** 帧动画间隔（ms，鱼属性 actSpeed = picActSpeed） */
  actSpeed: number;
  /** 最大旋转角度（鱼属性 maxRotate） */
  maxRotate: number;
  /** 鱼群最大数量（fishShoalMax，0 = 单条） */
  fishShoalMax: number;
  /** 帧动画序列 */
  frames: FishFrame[];
  /** 捕获动画帧（原版 onCatched 播放的动作） */
  catchFrames: FishFrame[];
  /** 占位色（图片加载失败时兜底绘制） */
  color: string;
  emoji: string;
}

/** 图集文件名 → 图片 URL */
export const ATLAS_URLS: Record<string, string> = atlasJson.atlasFiles;

const RAW: Record<
  string,
  { worth: number; catchProbability: number; speed: number; actSpeed: number; maxRotate: number; fishShoalMax: number }
> = {
  fish01: { worth: 2,   catchProbability: 400, speed: 50,  actSpeed: 100, maxRotate: 90,  fishShoalMax: 5 },
  fish02: { worth: 8,   catchProbability: 250, speed: 60,  actSpeed: 200, maxRotate: 90,  fishShoalMax: 5 },
  fish03: { worth: 4,   catchProbability: 150, speed: 70,  actSpeed: 100, maxRotate: 90,  fishShoalMax: 5 },
  fish04: { worth: 15,  catchProbability: 20,  speed: 40,  actSpeed: 100, maxRotate: 70,  fishShoalMax: 5 },
  fish05: { worth: 10,  catchProbability: 190, speed: 70,  actSpeed: 100, maxRotate: 90,  fishShoalMax: 5 },
  fish06: { worth: 12,  catchProbability: 120, speed: 80,  actSpeed: 100, maxRotate: 90,  fishShoalMax: 5 },
  fish07: { worth: 15,  catchProbability: 100, speed: 60,  actSpeed: 100, maxRotate: 90,  fishShoalMax: 5 },
  fish08: { worth: 40,  catchProbability: 80,  speed: 50,  actSpeed: 100, maxRotate: 60,  fishShoalMax: 0 },
  fish09: { worth: 50,  catchProbability: 70,  speed: 50,  actSpeed: 100, maxRotate: 90,  fishShoalMax: 0 },
  fish10: { worth: 60,  catchProbability: 40,  speed: 55,  actSpeed: 100, maxRotate: 60,  fishShoalMax: 0 },
  fish11: { worth: 120, catchProbability: 10,  speed: 50,  actSpeed: 100, maxRotate: 0,   fishShoalMax: 0 },
  fish12: { worth: 120, catchProbability: 10,  speed: 50,  actSpeed: 100, maxRotate: 0,   fishShoalMax: 0 },
  fish13: { worth: 100, catchProbability: 15,  speed: 50,  actSpeed: 100, maxRotate: 0,   fishShoalMax: 0 },
  fish14: { worth: 70,  catchProbability: 20,  speed: 60,  actSpeed: 100, maxRotate: 60,  fishShoalMax: 0 },
  fish15: { worth: 80,  catchProbability: 20,  speed: 80,  actSpeed: 100, maxRotate: 70,  fishShoalMax: 0 },
  fish16: { worth: 150, catchProbability: 5,   speed: 40,  actSpeed: 100, maxRotate: 0,   fishShoalMax: 0 },
  fish17: { worth: 90,  catchProbability: 30,  speed: 120, actSpeed: 100, maxRotate: 360, fishShoalMax: 0 },
};

const COLORS = [
  "#4fd1e5", "#7dd3fc", "#f9a8d4", "#fbbf24", "#f87171",
  "#a78bfa", "#34d399", "#fb923c", "#f472b6", "#2dd4bf",
];

const EMOJIS = ["🐟", "🐠", "🐡", "🦈", "🐋", "🐬", "🦑"];

export const FISH_TYPES: FishType[] = Object.keys(RAW).map((name, i) => ({
  id: i + 1,
  name,
  worth: RAW[name].worth,
  catchProbability: RAW[name].catchProbability,
  speed: RAW[name].speed,
  actSpeed: RAW[name].actSpeed,
  maxRotate: RAW[name].maxRotate,
  fishShoalMax: RAW[name].fishShoalMax,
  frames: atlasJson.fish[name] ?? [],
  catchFrames: atlasJson.fish[`${name}_catch`] ?? [],
  color: COLORS[i % COLORS.length],
  emoji: EMOJIS[i % EMOJIS.length],
}));

/** 炮弹档位：下标 +1 即炮弹花费分数 */
export const CANNON_LEVELS = [1, 2, 3, 4, 5];

/** 初始分数（演示模式；正式版由后端结算） */
export const INITIAL_SCORE = 100;

/** 判断一条鱼是否捕到：与 Java 版 checkCatch 一致 */
export function checkCatch(cannonLevel: number, catchProbability: number): boolean {
  const probability = cannonLevel * 10 + catchProbability;
  return Math.random() * 1000 + 1 <= probability;
}
